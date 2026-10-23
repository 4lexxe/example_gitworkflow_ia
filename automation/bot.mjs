import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { GitHub } from './github.mjs';
import { askModel } from './model.mjs';
import { ProjectSync } from './projects.mjs';
import { STATUSES, TRUSTED, LABELS, command, validatePlan, validateReview,
  closingNumbers, statusFor, markdown } from './policy.mjs';

const root = new URL('../', import.meta.url);
const prompt = name => readFile(new URL(`.github/prompts/${name}.md`, root), 'utf8');
const bullets = list => list.length ? list.map(item => `- ${markdown(item)}`).join('\n') : '- Ninguna.';
const runUrl = () => `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

export async function planIssue(github, number, ask = askModel) {
  const issue = await github.get(`/issues/${number}`);
  if (issue.pull_request || issue.state !== 'open') throw new Error('El PM requiere una issue abierta.');
  const plan = validatePlan(await ask(await prompt('project-manager'), {
    title: issue.title.slice(0, 500), body: (issue.body || '').slice(0, 12000),
    project: 'Laboratorio Node.js sin dependencias. npm test; npm run check; src/pricing.mjs.'
  }));
  await github.comment(number, '<!-- ai-pm-plan -->',
    `## Plan del Project Manager IA\n\n${markdown(plan.summary)}\n\n` +
    `**Tipo:** ${plan.kind} · **Prioridad sugerida:** ${plan.priority}\n\n` +
    `### Criterios de aceptación\n${bullets(plan.acceptanceCriteria)}\n\n` +
    `### Tareas propuestas\n${bullets(plan.tasks)}\n\n` +
    `### Preguntas pendientes\n${bullets(plan.questions)}\n\n` +
    `Plan generado por Copilot. Un mantenedor decide el alcance y la prioridad final. [Ejecución](${runUrl()}).`);
  await github.replaceLabels(number, 'type:', [`type:${plan.kind}`]);
  await github.replaceLabels(number, 'priority:', [`priority:${plan.priority}`]);
  await github.replaceLabels(number, 'ai:', ['ai:planned']);
  // No retroceder una tarea que una persona ya empezó o envió a revisión.
  const latest = await github.get(`/issues/${number}`);
  if (latest.state === 'open' && statusFor(latest) === 'backlog') {
    await github.replaceLabels(number, 'status:', ['status:ready']);
  }
  return plan;
}

export async function reviewPull(github, number, ask = askModel) {
  const pull = await github.get(`/pulls/${number}`);
  if (pull.state !== 'open' || pull.draft) return;
  const sha = pull.head.sha;
  await github.post(`/statuses/${sha}`, { state: 'pending', context: 'AI / review',
    description: 'La IA está analizando el cambio.', target_url: runUrl() });
  try {
    const allFiles = await github.all(`/pulls/${number}/files`);
    let remaining = 28000;
    const files = allFiles.slice(0, 40).map(file => {
      const patch = (file.patch || '').slice(0, Math.max(0, remaining));
      remaining -= patch.length;
      return { filename: file.filename, status: file.status, additions: file.additions,
        deletions: file.deletions, patch, truncated: !file.patch || patch.length < file.patch.length };
    });
    const linked = [];
    for (const linkedNumber of closingNumbers(pull.body || '', github.repo).slice(0, 10)) {
      const issue = await github.get(`/issues/${linkedNumber}`);
      if (!issue.pull_request) linked.push({ number: linkedNumber, title: issue.title, body: (issue.body || '').slice(0, 3000) });
    }
    const review = validateReview(await ask(await prompt('reviewer'), {
      title: pull.title.slice(0, 500), body: (pull.body || '').slice(0, 6000), sha,
      files, linkedIssues: linked, totalFiles: allFiles.length
    }), files);
    // Una revisión del commit anterior nunca debe representar al último commit.
    const current = await github.get(`/pulls/${number}`);
    if (current.head.sha !== sha || current.state !== 'open') {
      await github.post(`/statuses/${sha}`, { state: 'error', context: 'AI / review',
        description: 'Revisión descartada: la pull request cambió durante el análisis.' });
      return;
    }
    const high = review.findings.some(item => item.severity === 'high');
    const incomplete = allFiles.length > files.length || files.some(file => file.truncated);
    const findings = review.findings.length ? review.findings.map(item => {
      const link = `${pull.html_url}/files`;
      return `- **${item.severity.toUpperCase()}** · [${markdown(item.path)}:${item.line}](${link})\n` +
        `  ${markdown(item.problem)}\n  **Propuesta:** ${markdown(item.suggestion)}`;
    }).join('\n\n') : 'No se encontraron problemas concretos en el material analizado.';
    await github.comment(number, '<!-- ai-code-review -->',
      `## Revisión de código por IA\n\n**Commit:** \`${sha}\`\n\n${markdown(review.summary)}\n\n` +
      `### Hallazgos\n${findings}\n\n### Pruebas recomendadas\n${bullets(review.tests)}\n\n` +
      `**Cobertura:** ${files.length}/${allFiles.length} archivos; ${incomplete ? 'análisis parcial (diff ausente o truncado)' : 'diffs disponibles incluidos'}.\n\n` +
      `Esta revisión no ejecuta pruebas ni sustituye la aprobación humana. [Ejecución](${runUrl()}).`);
    await github.replaceLabels(number, 'ai:', [high ? 'ai:changes-requested' : 'ai:reviewed']);
    await github.post(`/statuses/${sha}`, { state: high || incomplete ? 'failure' : 'success', context: 'AI / review',
      description: incomplete ? 'Cobertura parcial: requiere revisión humana.' : high ? 'La IA encontró problemas de severidad alta.' : 'Análisis completado; revisar comentario de IA.', target_url: runUrl() });
    return review;
  } catch (error) {
    await github.post(`/statuses/${sha}`, { state: 'error', context: 'AI / review',
      description: 'No se completó la revisión. Ver comentario de configuración.', target_url: runUrl() });
    throw error;
  }
}

export async function syncPull(github, number) {
  const pull = await github.get(`/pulls/${number}`);
  await github.replaceLabels(number, 'status:', [`status:${pull.state === 'closed' ? 'done' : pull.draft ? 'doing' : 'review'}`]);
  for (const linkedNumber of closingNumbers(pull.body || '', github.repo).slice(0, 20)) {
    const issue = await github.get(`/issues/${linkedNumber}`);
    if (issue.pull_request) continue;
    let status = issue.state === 'closed' ? 'done' : pull.state === 'open' ? (pull.draft ? 'doing' : 'review') : 'doing';
    if (pull.state === 'closed' && issue.state === 'open') {
      const open = await github.all('/pulls?state=open');
      if (open.some(other => closingNumbers(other.body || '', github.repo).includes(linkedNumber))) status = 'review';
    }
    await github.replaceLabels(linkedNumber, 'status:', [`status:${status}`]);
  }
}

export async function runBot({ github, event, eventName, ask = askModel }) {
  let number = event.issue?.number || event.pull_request?.number || Number(event.inputs?.number);
  let operation;
  if (eventName === 'workflow_dispatch') {
    operation = event.inputs.operation;
    if (operation === 'setup') {
      for (const [name, [color, description]] of Object.entries(LABELS)) {
        const existing = await github.all('/labels');
        if (existing.some(label => label.name === name)) await github.patch(`/labels/${encodeURIComponent(name)}`, { color, description });
        else await github.post('/labels', { name, color, description });
      }
      return;
    }
  } else if (eventName === 'issue_comment') {
    if (!TRUSTED.includes(event.comment?.author_association)) return;
    const parsed = command(event.comment?.body);
    if (!parsed) return;
    if (parsed[0] === 'status') {
      if (event.issue.pull_request || event.issue.state !== 'open' || !STATUSES.includes(parsed[1])) return;
      await github.replaceLabels(number, 'status:', [`status:${parsed[1]}`]);
      return;
    }
    operation = parsed[0];
    if (operation === 'plan' && event.issue.pull_request) return;
    if (operation === 'review' && !event.issue.pull_request) return;
  } else if (eventName === 'issues') {
    const issue = await github.get(`/issues/${number}`);
    if (issue.state === 'closed') {
      await github.replaceLabels(number, 'status:', ['status:done']);
      return;
    }
    if (['opened', 'reopened'].includes(event.action)) {
      await github.replaceLabels(number, 'status:', ['status:backlog']);
    }
    if (event.action === 'labeled' && event.label?.name.startsWith('status:')) {
      const status = event.label.name.slice(7);
      if (STATUSES.includes(status)) {
        await github.replaceLabels(number, 'status:', [`status:${issue.state === 'closed' ? 'done' : status === 'done' ? 'ready' : status}`]);
      }
      return;
    }
    if (!TRUSTED.includes(issue.author_association) || !['opened', 'edited', 'reopened'].includes(event.action)) return;
    operation = 'plan';
  } else if (eventName === 'pull_request_target') {
    await syncPull(github, number);
    if (!TRUSTED.includes(event.pull_request.author_association)) return;
    if (!['opened', 'reopened', 'synchronize', 'ready_for_review', 'edited'].includes(event.action)) return;
    operation = 'review';
  }
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Número de issue/PR inválido.');
  try {
    if (operation === 'plan') await planIssue(github, number, ask);
    else if (operation === 'review') { await syncPull(github, number); await reviewPull(github, number, ask); }
    else if (operation === 'sync') {
      const item = await github.get(`/issues/${number}`);
      if (item.pull_request) await syncPull(github, number);
      else await github.replaceLabels(number, 'status:', [`status:${statusFor(item)}`]);
    } else throw new Error('Operación no reconocida.');
  } catch (error) {
    await github.replaceLabels(number, 'ai:', ['ai:unavailable']);
    await github.comment(number, '<!-- ai-configuration -->',
      `## La IA necesita atención\n\n${markdown(error.message)}\n\n` +
      `No se publicó un análisis exitoso. Consultá [la guía de activación](https://github.com/${github.repo}/blob/main/docs/ACTIVACION.md) ` +
      `y [esta ejecución](${runUrl()}). Después comentá \`/pm ${operation === 'review' ? 'review' : 'plan'}\` para reintentar.\n\n` +
      'Nunca pegues tokens ni claves en una issue o comentario.');
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let github;
  try {
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
    github = new GitHub();
    await runBot({ github, event, eventName: process.env.GITHUB_EVENT_NAME });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (github && process.env.PROJECT_TOKEN && process.env.PROJECT_NUMBER) {
      try {
        const projects = new ProjectSync(new GitHub({ token: process.env.PROJECT_TOKEN }), process.env.PROJECT_NUMBER);
        for (const number of github.changedStatuses) await projects.sync(await github.get(`/issues/${number}`));
      } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
      }
    }
  }
}
