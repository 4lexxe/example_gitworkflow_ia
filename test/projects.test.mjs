import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectSync, statusOption } from '../automation/projects.mjs';

const options = ['Backlog', 'Ready', 'In progress', 'In review', 'Done'].map((name, index) => ({ id: String(index), name }));

test('acepta los estados de la plantilla Kanban de GitHub y sus nombres en español', () => {
  assert.equal(statusOption(options, 'ready').name, 'Ready');
  assert.equal(statusOption(options, 'review').name, 'In review');
  assert.equal(statusOption([{ id: 'es', name: 'En curso' }], 'doing').id, 'es');
});

test('agrega la issue y actualiza Status con el ID real de la opción del Project', async () => {
  const requests = [];
  const github = { repo: 'owner/repo', request: async (method, path, payload) => {
    requests.push({ method, path, ...payload });
    if (payload.query.includes('user(login:')) return { data: { user: { projectV2: {
      id: 'project', url: 'https://github.com/users/owner/projects/2',
      fields: { nodes: [{ id: 'status', name: 'Status', options }] }
    } } } };
    if (payload.query.includes('addProjectV2ItemById')) return { data: { addProjectV2ItemById: { item: { id: 'card' } } } };
    return { data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'card' } } } };
  } };
  await new ProjectSync(github, 2).sync({ node_id: 'issue', state: 'open', labels: [{ name: 'status:review' }] });
  assert.deepEqual(requests[1].variables, { project: 'project', content: 'issue' });
  assert.deepEqual(requests[2].variables, { project: 'project', item: 'card', field: 'status', option: '3' });
});

test('informa un error de Projects sin publicar el token ni aparentar una sincronización exitosa', async () => {
  const github = { repo: 'owner/repo', request: async () => ({ errors: [{ message: 'Not authorized' }] }) };
  await assert.rejects(new ProjectSync(github, 2).load(), /permisos/);
});
