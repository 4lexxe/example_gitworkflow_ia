import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHub } from '../automation/github.mjs';
import { parseJson } from '../automation/model.mjs';
import { command, closingNumbers, validatePlan, validateReview, markdown } from '../automation/policy.mjs';
import { runBot, planIssue, reviewPull, syncPull } from '../automation/bot.mjs';

const issue = () => ({ number: 1, title: 'Agregar envío', body: 'Validar centavos no negativos.', state: 'open',
  author_association: 'OWNER', labels: [{ name: 'status:backlog' }] });
const pull = () => ({ number: 2, title: 'Agregar envío', body: 'Closes #1', state: 'open', draft: false,
  head: { sha: 'abc123' }, author_association: 'OWNER', html_url: 'https://github.com/owner/repo/pull/2' });
const plan = () => ({ summary: 'Agregar envío validado.', kind: 'feature', priority: 'medium',
  acceptanceCriteria: ['Rechazar envío negativo.'], tasks: ['Validar y probar.'], questions: [] });
const review = () => ({ summary: 'Falta validación del envío.', findings: [{ severity: 'high',
  path: 'src/pricing.mjs', line: 5, problem: 'Un envío negativo reduce el total.', suggestion: 'Validar el importe.' }], tests: ['Probar envío negativo.'] });

class MemoryGitHub {
  constructor() {
    this.repo = 'owner/repo'; this.issue = issue(); this.pull = pull();
    this.files = [{ filename: 'src/pricing.mjs', patch: '+ return total + shipping;', additions: 1, deletions: 1 }];
    this.comments = []; this.statuses = []; this.labels = new Map(); this.calls = [];
  }
  async get(path) {
    this.calls.push(['get', path]);
    if (path === '/issues/1') return structuredClone(this.issue);
    if (path === '/pulls/2') return structuredClone(this.pull);
    if (path === '/issues/2') return { ...structuredClone(this.pull), pull_request: {}, labels: [] };
    throw new Error(`Ruta inesperada ${path}`);
  }
  async all(path) {
    if (path === '/pulls/2/files') return this.files;
    if (path === '/pulls?state=open') return [];
    throw new Error(`Ruta inesperada ${path}`);
  }
  async replaceLabels(number, prefix, labels) {
    this.labels.set(`${number}:${prefix}`, labels);
    if (number === 1) this.issue.labels = [...this.issue.labels.filter(item => !item.name.startsWith(prefix)), ...labels.map(name => ({ name }))];
  }
  async comment(number, marker, body) { this.comments.push({ number, marker, body }); }
  async post(path, data) { if (path.startsWith('/statuses/')) this.statuses.push(data); }
}

test('comandos requieren una instrucción exacta', () => {
  assert.deepEqual(command('/pm status doing'), ['status', 'doing']);
  assert.deepEqual(command('/pm plan'), ['plan']);
  for (const input of ['/pm status done', 'texto /pm plan', '/pm plan\nrm -rf /', '/pm status shell']) assert.equal(command(input), null);
});

test('vinculación no captura issues de otros repositorios', () => {
  assert.deepEqual(closingNumbers('Closes #1\nFixes owner/repo#2\nResolves #1\nFixes other/repo#9', 'owner/repo'), [1, 2]);
  assert.deepEqual(closingNumbers('Closes owner/re.po#2', 'owner/repo'), []);
});

test('valida respuestas del modelo y rechaza rutas inventadas', () => {
  assert.equal(validatePlan(plan()).kind, 'feature');
  assert.throws(() => validatePlan({ ...plan(), priority: 'urgent' }));
  assert.throws(() => validatePlan({ ...plan(), tasks: 'ejecutar comando' }));
  assert.throws(() => validateReview(review(), [{ filename: 'README.md' }]));
  assert.throws(() => validateReview({ ...review(), findings: [{ ...review().findings[0], line: -1 }] }, [{ filename: 'src/pricing.mjs' }]));
});

test('parsea JSON sin convertir texto arbitrario en un análisis exitoso', () => {
  assert.deepEqual(parseJson('```json\n{"summary":"ok"}\n```'), { summary: 'ok' });
  assert.throws(() => parseJson('No estoy autenticado.'));
  assert.throws(() => parseJson('[]'));
  assert.match(markdown('<script>@everyone</script>'), /&lt;script&gt;@\u200beveryone/);
});

test('el PM publica criterios y mueve backlog a ready', async () => {
  const github = new MemoryGitHub();
  await planIssue(github, 1, async () => plan());
  assert.deepEqual(github.labels.get('1:status:'), ['status:ready']);
  assert.deepEqual(github.labels.get('1:ai:'), ['ai:planned']);
  assert.match(github.comments[0].body, /Rechazar envío negativo/);
});

test('replanificar no retrocede trabajo que ya está en curso', async () => {
  const github = new MemoryGitHub(); github.issue.labels = [{ name: 'status:doing' }];
  await planIssue(github, 1, async () => plan());
  assert.equal(github.labels.has('1:status:'), false);
});

test('usuarios externos no pueden consumir IA mediante comandos', async () => {
  const github = new MemoryGitHub();
  await runBot({ github, eventName: 'issue_comment', event: { issue: issue(),
    comment: { author_association: 'NONE', body: '/pm plan' } }, ask: () => { throw new Error('No debe consultar IA'); } });
  assert.equal(github.comments.length, 0);
  assert.equal(github.calls.length, 0);
});

test('fallo de IA queda visible y el trabajo no se marca planificado', async () => {
  const github = new MemoryGitHub();
  await assert.rejects(runBot({ github, eventName: 'issues', event: { issue: issue(), action: 'opened' },
    ask: async () => { throw new Error('Sin acceso a Copilot'); } }), /Sin acceso/);
  assert.deepEqual(github.labels.get('1:ai:'), ['ai:unavailable']);
  assert.deepEqual(github.labels.get('1:status:'), ['status:backlog']);
  assert.match(github.comments[0].body, /No se publicó un análisis exitoso/);
});

test('hallazgos altos producen un estado fallido y quedan en el comentario', async () => {
  const github = new MemoryGitHub();
  await reviewPull(github, 2, async () => review());
  assert.equal(github.statuses.at(-1).state, 'failure');
  assert.deepEqual(github.labels.get('2:ai:'), ['ai:changes-requested']);
  assert.match(github.comments[0].body, /abc123/);
});

test('sin hallazgos y con cobertura disponible informa éxito', async () => {
  const github = new MemoryGitHub();
  await reviewPull(github, 2, async () => ({ summary: 'No hay problemas concretos.', findings: [], tests: [] }));
  assert.equal(github.statuses.at(-1).state, 'success');
});

test('no publica una revisión obsoleta cuando cambia el commit', async () => {
  const github = new MemoryGitHub();
  await reviewPull(github, 2, async () => { github.pull.head.sha = 'def456'; return review(); });
  assert.equal(github.comments.length, 0);
  assert.equal(github.labels.has('2:ai:'), false);
  assert.equal(github.statuses.at(-1).state, 'error');
});

test('diff ausente o truncado no se considera una revisión completa', async () => {
  const github = new MemoryGitHub(); github.files[0].patch = undefined;
  await reviewPull(github, 2, async () => ({ summary: 'No hay diff.', findings: [], tests: [] }));
  assert.equal(github.statuses.at(-1).state, 'failure');
  assert.match(github.comments[0].body, /análisis parcial/);
});

test('al abrir un PR mueve su tarea vinculada a revisión', async () => {
  const github = new MemoryGitHub();
  await syncPull(github, 2);
  assert.deepEqual(github.labels.get('1:status:'), ['status:review']);
  assert.deepEqual(github.labels.get('2:status:'), ['status:review']);
});

test('una falla del proveedor deja estado error, nunca success', async () => {
  const github = new MemoryGitHub();
  await assert.rejects(reviewPull(github, 2, async () => { throw new Error('No autorizado'); }));
  assert.equal(github.statuses.at(-1).state, 'error');
});

test('comentarios idempotentes actualizan solo mensajes del bot', async () => {
  const requests = [];
  const github = new GitHub({ repo: 'owner/repo', token: 'test-only', fetchImpl: async (url, options) => {
    requests.push({ url, ...options });
    if (options.method === 'GET') return new Response(JSON.stringify([
      { id: 1, user: { login: 'human' }, body: '<!-- marker -->' },
      { id: 2, user: { login: 'github-actions[bot]' }, body: '<!-- marker --> anterior' }
    ]));
    return new Response('{}');
  } });
  await github.comment(1, '<!-- marker -->', 'nuevo');
  assert.equal(requests[1].method, 'PATCH');
  assert.match(requests[1].url, /issues\/comments\/2$/);
  assert.equal(JSON.parse(requests[1].body).body, '<!-- marker -->\nnuevo');
});
