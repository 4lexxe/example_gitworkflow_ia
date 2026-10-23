const repo = '4lexxe/example_gitworkflow_ia';
const statuses = [
  ['backlog', 'Backlog', '#94a3b8'], ['ready', 'Listo para empezar', '#60a5fa'],
  ['doing', 'En curso', '#fbbf24'], ['review', 'En revisión', '#c4b5fd'],
  ['done', 'Hecho', '#64e2c0']
];
let items = [];
const $ = selector => document.querySelector(selector);
const labelNames = item => item.labels.map(label => label.name);

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function statusOf(item) {
  if (item.state === 'closed') return 'done';
  return statuses.find(([key]) => labelNames(item).includes(`status:${key}`))?.[0] || 'backlog';
}

function card(item) {
  const node = element('a', 'card');
  // URLs construidas localmente: el contenido remoto solo entra como textContent.
  node.href = `https://github.com/${repo}/${item.pull_request ? 'pull' : 'issues'}/${Number(item.number)}`;
  node.target = '_blank'; node.rel = 'noopener noreferrer';
  const top = element('div', 'card-top');
  top.append(element('span', '', `${item.pull_request ? 'PR' : 'TAREA'} #${item.number}`),
    element('span', '', new Date(item.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })));
  const tags = element('div', 'tags');
  const labels = labelNames(item);
  const type = labels.find(label => label.startsWith('type:'))?.slice(5);
  const priority = labels.find(label => label.startsWith('priority:'))?.slice(9);
  if (type) tags.append(element('span', 'badge', type));
  if (priority) tags.append(element('span', `badge priority-${priority}`, { high: 'Alta', medium: 'Media', low: 'Baja' }[priority]));
  if (labels.includes('blocked')) tags.append(element('span', 'badge warning', 'Bloqueada'));
  if (labels.includes('demo')) tags.append(element('span', 'badge', 'Demo'));
  const bottom = element('div', 'card-bottom');
  const ai = labels.includes('ai:unavailable') ? 'IA requiere atención' : labels.includes('ai:changes-requested') ? 'IA encontró problemas' :
    labels.includes('ai:reviewed') ? 'IA revisó' : labels.includes('ai:planned') ? 'IA planificó' : 'Sin análisis IA';
  bottom.append(element('span', labels.some(label => ['ai:unavailable', 'ai:changes-requested'].includes(label)) ? 'badge warning' : 'badge ai', ai),
    element('span', '', `${item.comments} comentarios`));
  node.append(top, element('h4', '', item.title), tags, bottom);
  return node;
}

function render() {
  const search = $('#search').value.trim().toLowerCase();
  const kind = $('#kind').value;
  const filtered = items.filter(item =>
    (kind === 'all' || Boolean(item.pull_request) === (kind === 'pulls')) &&
    `${item.number} ${item.title}`.toLowerCase().includes(search));
  $('#total').textContent = filtered.length;
  const columns = statuses.map(([key, name, color]) => {
    const column = element('section', 'column'); column.style.setProperty('--column-color', color);
    const group = filtered.filter(item => statusOf(item) === key);
    const heading = element('div', 'column-heading');
    heading.append(element('span', 'dot'), element('h3', '', name), element('span', 'count', group.length));
    column.append(heading);
    if (group.length) column.append(...group.map(card));
    else column.append(element('p', 'empty', 'Sin tareas en esta etapa.'));
    return column;
  });
  $('#board').replaceChildren(...columns);
}

async function refresh() {
  $('#refresh').disabled = true;
  try {
    const loaded = [];
    let truncated = false;
    for (let page = 1; page <= 5; page++) {
      const response = await fetch(`https://api.github.com/repos/${repo}/issues?state=all&sort=updated&per_page=100&page=${page}`, {
        headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(response.status === 403 || response.status === 429
        ? 'GitHub limitó las consultas. Esperá unos minutos y actualizá.' : `GitHub respondió HTTP ${response.status}.`);
      const pageItems = await response.json(); loaded.push(...pageItems);
      if (pageItems.length < 100) break;
      if (page === 5) truncated = true;
    }
    items = loaded; render();
    $('#connection').className = 'connection';
    $('#connection').textContent = `● Datos reales de ${repo} · Actualizado ${new Date().toLocaleTimeString('es-AR')}` +
      (truncated ? ' · Mostrando los últimos 500 elementos.' : '');
  } catch (error) {
    $('#connection').className = 'connection error';
    $('#connection').textContent = `No se pudo actualizar. ${error.message} Los datos anteriores pueden estar desactualizados.`;
  } finally { $('#refresh').disabled = false; }
}

$('#search').addEventListener('input', render);
$('#kind').addEventListener('change', render);
$('#refresh').addEventListener('click', refresh);
render(); refresh();
setInterval(() => { if (!document.hidden && !$('#refresh').disabled) refresh(); }, 90000);
