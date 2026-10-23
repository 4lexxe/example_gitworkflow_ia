import { execFileSync } from 'node:child_process';
import { GitHub } from '../automation/github.mjs';
import { ProjectSync, PROJECT_STATUSES, statusOption } from '../automation/projects.mjs';

// Se ejecuta localmente por el mantenedor. Nunca guarda ni imprime la credencial.
const repo = '4lexxe/example_gitworkflow_ia';
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

try {
  const token = gh('auth', 'token');
  const api = new GitHub({ token, repo });
  // Comprobar permiso antes de crear recursos.
  const result = await api.request('POST', '/graphql', { query: `query {
    viewer { id login projectsV2(first:100) { nodes { id number title } } }
    repository(owner:"4lexxe",name:"example_gitworkflow_ia") { id }
  }` });
  if (result.errors?.length) throw new Error('Falta acceso a Projects. Ejecutá gh auth refresh -s project y reintentá.');
  const title = 'Workflow Lab IA · example_gitworkflow_ia';
  const found = result.data.viewer.projectsV2.nodes.find(project => project.title === title);
  let number = found?.number;
  if (!number) {
    const created = await api.request('POST', '/graphql', { query: `mutation($owner:ID!,$repo:ID!,$title:String!) {
      createProjectV2(input:{ownerId:$owner,repositoryId:$repo,title:$title}) { projectV2 { number } }
    }`, variables: { owner: result.data.viewer.id, repo: result.data.repository.id, title } });
    if (created.errors?.length) throw new Error('No se pudo crear el proyecto. Revisá el permiso project.');
    number = created.data.createProjectV2.projectV2.number;
  }
  const project = new ProjectSync(api, number);
  await project.load();
  // Respetar los estados y sus IDs cuando se usó la plantilla Kanban de GitHub.
  const complete = Object.keys(PROJECT_STATUSES).every(status => statusOption(project.field.options, status));
  if (!complete) {
    const used = new Set();
    const options = Object.entries(PROJECT_STATUSES).map(([status, [name, color]]) => {
      const current = statusOption(project.field.options, status);
      if (current) used.add(current.id);
      return { ...(current ? { id: current.id } : {}), name, color, description: `Estado ${name} del flujo del repositorio` };
    });
    options.push(...project.field.options.filter(option => !used.has(option.id)));
    await project.graphql(`mutation($field:ID!,$options:[ProjectV2SingleSelectFieldOptionInput!]!) {
      updateProjectV2Field(input:{fieldId:$field,singleSelectOptions:$options}) { projectV2Field { ... on ProjectV2SingleSelectField { id } } }
    }`, { field: project.field.id, options });
  }
  await project.graphql(`mutation($project:ID!,$repo:ID!) {
    linkProjectV2ToRepository(input:{projectId:$project,repositoryId:$repo}) { repository { id } }
  }`, { project: project.project.id, repo: result.data.repository.id });
  const views = await project.graphql(`query($id:ID!) { node(id:$id) { ... on ProjectV2 { views(first:20) { nodes { id name } } } } }`, { id: project.project.id });
  if (!views.node.views.nodes.some(view => view.name === 'Kanban IA')) {
    await project.graphql(`mutation($id:ID!) {
      createProjectV2View(input:{projectId:$id,name:"Kanban IA",layout:BOARD_LAYOUT}) { projectV2View { id } }
    }`, { id: project.project.id });
  }
  await project.load();
  for (const item of await api.all('/issues?state=all')) await project.sync(item);
  gh('variable', 'set', 'PROJECT_NUMBER', '--repo', repo, '--body', String(number));
  gh('variable', 'set', 'PROJECT_URL', '--repo', repo, '--body', project.project.url);
  console.log(`Proyecto listo: ${project.project.url}`);
  console.log('Para sincronización automática, guardar PROJECT_TOKEN como secreto de Actions con permiso project (agregar repo solo para repositorios privados).');
} catch (error) {
  console.error(error.message.startsWith('Command failed:') ? 'No se pudo leer la sesión de gh. Ejecutá gh auth status.' : error.message);
  process.exitCode = 1;
}
