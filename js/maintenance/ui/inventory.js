// Vista "Inventario de activos": árbol de jerarquía + tabla filtrable.
import * as assets from '../services/assets.js';
import * as hierarchy from '../services/hierarchy.js';
import * as catalogs from '../services/catalogs.js';
import { data } from '../services/api.js';
import { LEVEL_LABEL, ASSET_LEVELS, descendantAssetIds } from '../domain/hierarchy.js';
import { esc, emptyState, dataTable, bindRowLinks, badge, critBadge } from './components.js';
import { openAssetForm, openNodeForm, changeState, perms } from './actions.js';
import { toast } from '../../ui.js';

// Filtros persistentes mientras se navega dentro del módulo
const filters = { q: '', proceso: '', nivel: '', crit: '', estado: '', showInactive: false, node: '' };
const collapsed = new Set();

export function primaryAction(user) {
  if (!perms(user).crear) return null;
  return { label: '+ Nuevo activo', run: () => newAsset(user) };
}

function newAsset(user) {
  if (!hierarchy.byLevel('PROCESO').length) {
    if (!perms(user).jerarquia) return toast('Primero un responsable de la jerarquía debe crear la planta y los procesos');
    return openNodeForm(user, { preset: { NIVEL: hierarchy.byLevel('PLANTA').length ? 'PROCESO' : 'PLANTA' } });
  }
  const sel = filters.node && (hierarchy.get(filters.node) || assets.get(filters.node));
  const preset = {};
  if (sel && hierarchy.get(filters.node)) {
    const n = hierarchy.get(filters.node);
    if (n.NIVEL !== 'PLANTA') Object.assign(preset, { NIVEL_JERARQUIA: 'EQUIPO', ID_PADRE: n.ID_NODO });
  }
  openAssetForm(user, { preset });
}

export function render(el, { user }) {
  const canEdit = perms(user).jerarquia; // plantas, procesos y líneas
  const tree = hierarchy.tree({ showInactive: filters.showInactive });
  const hasNodes = hierarchy.nodes().length > 0;

  if (!hasNodes && !assets.list({ includeInactive: true }).length) {
    el.innerHTML = emptyState({
      icon: '⌂', title: 'Aún no hay activos registrados',
      text: 'Empiece por la jerarquía de la planta: <b>Planta → Proceso → Línea</b>. Después registre sistemas, equipos, subequipos y componentes. Cada activo recibe un código único (ej. EQ-PRO-001) que relaciona todo su historial.',
      action: canEdit ? '<button class="btn btn-primary" data-new-node="PLANTA">+ Crear planta</button>' : '<span class="muted">Un supervisor o administrador debe crear la jerarquía.</span>'
    });
    el.querySelector('[data-new-node]')?.addEventListener('click', () => openNodeForm(user, { preset: { NIVEL: 'PLANTA' } }));
    return;
  }

  el.innerHTML = `<div class="mt-inventory">
    <aside class="panel mt-tree-panel">
      <div class="mt-panel-head"><h3>Jerarquía</h3>${canEdit ? '<button class="btn btn-secondary btn-sm" data-add-node>+ Ubicación</button>' : ''}</div>
      <button class="mt-tree-all ${filters.node ? '' : 'active'}" data-node="">Todos los activos</button>
      <div class="mt-tree" role="tree">${tree.map(treeHtml).join('')}</div>
    </aside>
    <section class="mt-inventory-main">
      <div class="panel mt-filters">
        ${filters.node ? selectionBar(canEdit) : ''}
        <div class="toolbar">
          <input type="search" data-f="q" placeholder="Buscar código, nombre, serial, ubicación…" value="${esc(filters.q)}" aria-label="Buscar">
          ${select('proceso', 'Proceso', hierarchy.byLevel('PROCESO').map(n => ({ value: n.ID_NODO, label: n.NOMBRE_NODO })))}
          ${select('nivel', 'Nivel', ASSET_LEVELS.map(l => ({ value: l, label: LEVEL_LABEL[l] })))}
          ${select('crit', 'Criticidad', catalogs.options('CRITICIDAD'))}
          ${select('estado', 'Estado', catalogs.options('ESTADO_ACTIVO'))}
          <label class="mt-check"><input type="checkbox" data-f="showInactive" ${filters.showInactive ? 'checked' : ''}> Ver inactivos</label>
        </div>
      </div>
      <div class="panel" data-table></div>
    </section>
  </div>`;

  const drawTable = () => {
    const list = filtered();
    el.querySelector('[data-table]').innerHTML = `<div class="mt-panel-head"><h3>Activos <span class="muted">(${list.length})</span></h3></div>` +
      dataTable(list, [
        { label: 'Código', html: a => `<b>${esc(a.CODIGO_ACTIVO)}</b>` },
        { label: 'Nombre', key: 'NOMBRE_ACTIVO' },
        { label: 'Nivel', html: a => esc(LEVEL_LABEL[a.NIVEL_JERARQUIA] || a.NIVEL_JERARQUIA) },
        { label: 'Tipo', html: a => esc(catalogs.label('TIPO_ACTIVO', a.TIPO_ACTIVO)) },
        { label: 'Proceso', key: 'PROCESO' },
        { label: 'Línea', html: a => esc(a.LINEA || '—') },
        { label: 'Ubicación', key: 'UBICACION' },
        { label: 'Crit.', html: a => critBadge(a.CRITICIDAD) },
        { label: 'Estado', html: a => badge(a.ESTADO_ACTIVO, catalogs.label('ESTADO_ACTIVO', a.ESTADO_ACTIVO)) + (a.ESTADO_REGISTRO !== 'ACTIVO' ? ' ' + badge(a.ESTADO_REGISTRO) : '') }
      ], { onRowHref: a => `#/mantenimiento/hoja-vida/${a.ID_ACTIVO}`, empty: hasFilters() ? 'Ningún activo coincide con los filtros' : 'Sin activos en esta ubicación' });
    bindRowLinks(el.querySelector('[data-table]'));
  };
  drawTable();

  el.querySelectorAll('[data-f]').forEach(inp => {
    const ev = inp.type === 'search' ? 'input' : 'change';
    inp.addEventListener(ev, () => {
      filters[inp.dataset.f] = inp.type === 'checkbox' ? inp.checked : inp.value;
      if (inp.dataset.f === 'showInactive') render(el, { user }); else drawTable();
    });
  });
  el.querySelectorAll('[data-node]').forEach(b => b.addEventListener('click', () => { filters.node = b.dataset.node; render(el, { user }); }));
  el.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const id = b.dataset.toggle;
    collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
    render(el, { user });
  }));
  el.querySelector('[data-add-node]')?.addEventListener('click', () => openNodeForm(user, { preset: childPreset(filters.node) }));
  bindSelectionBar(el, user);
}

function childPreset(nodeId) {
  const n = nodeId && hierarchy.get(nodeId);
  if (!n) return { NIVEL: hierarchy.byLevel('PLANTA').length ? 'PROCESO' : 'PLANTA' };
  if (n.NIVEL === 'PLANTA') return { NIVEL: 'PROCESO', ID_PADRE: n.ID_NODO };
  if (n.NIVEL === 'PROCESO') return { NIVEL: 'LINEA', ID_PADRE: n.ID_NODO };
  return { NIVEL: 'LINEA', ID_PADRE: n.ID_PADRE };
}

function selectionBar(canEdit) {
  const n = hierarchy.get(filters.node);
  const a = n ? null : assets.get(filters.node);
  if (!n && !a) { filters.node = ''; return ''; }
  const path = assets.path(filters.node).map(p => esc(p.isNode ? p.name : p.code)).join(' › ');
  const buttons = canEdit && n ? `<button class="btn btn-secondary btn-sm" data-edit-node>Editar</button>${n.ESTADO_REGISTRO === 'ACTIVO' ? '<button class="btn btn-secondary btn-sm" data-state-node="INACTIVO">Inactivar</button>' : '<button class="btn btn-secondary btn-sm" data-state-node="ACTIVO">Reactivar</button>'}` : '';
  return `<div class="mt-selection"><div><span class="metric-note">Filtrando por ${esc(n ? LEVEL_LABEL[n.NIVEL].toLowerCase() : 'activo')}</span><div><b>${path}</b>${n?.CODIGO_NODO ? ` <span class="muted">· ${esc(n.CODIGO_NODO)}</span>` : ''}</div></div><div class="toolbar">${buttons}<button class="btn btn-secondary btn-sm" data-node="">Quitar filtro</button></div></div>`;
}

function bindSelectionBar(el, user) {
  const n = filters.node && hierarchy.get(filters.node);
  if (!n) return;
  el.querySelector('[data-edit-node]')?.addEventListener('click', () => openNodeForm(user, { node: n }));
  el.querySelector('[data-state-node]')?.addEventListener('click', async e => {
    await changeState(user, hierarchy, n.ID_NODO, e.target.dataset.stateNode, n.NOMBRE_NODO);
  });
}

function treeHtml(item) {
  const has = item.children.length > 0;
  const open = !collapsed.has(item.id);
  const inactive = item.rec.ESTADO_REGISTRO !== 'ACTIVO';
  const label = item.isNode ? esc(item.name) : `<span class="mt-code">${esc(item.code)}</span> ${esc(item.name)}`;
  return `<div class="mt-tree-item" role="treeitem" aria-expanded="${has ? open : ''}">
    <div class="mt-tree-row ${filters.node === item.id ? 'active' : ''} ${inactive ? 'inactive' : ''}">
      ${has ? `<button class="mt-tree-toggle" data-toggle="${esc(item.id)}" aria-label="${open ? 'Contraer' : 'Expandir'}">${open ? '▾' : '▸'}</button>` : '<span class="mt-tree-toggle"></span>'}
      <button class="mt-tree-label" data-node="${esc(item.id)}"><span class="mt-level mt-level-${esc(item.level.toLowerCase())}">${esc(LEVEL_LABEL[item.level].slice(0, 3))}</span>${label}</button>
    </div>
    ${has && open ? `<div class="mt-tree-children" role="group">${item.children.map(treeHtml).join('')}</div>` : ''}
  </div>`;
}

function select(key, label, opts) {
  return `<select data-f="${key}" aria-label="${esc(label)}"><option value="">${esc(label)}: todos</option>${opts.map(o => `<option value="${esc(o.value)}" ${String(filters[key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
}

const hasFilters = () => filters.q || filters.proceso || filters.nivel || filters.crit || filters.estado || filters.node;

function filtered() {
  let list = assets.list({ includeInactive: filters.showInactive });
  if (filters.node) {
    const ids = new Set([filters.node, ...descendantAssetIds(data(), filters.node)]);
    list = list.filter(a => ids.has(a.ID_ACTIVO));
  }
  if (filters.proceso) list = list.filter(a => a.ID_PROCESO === filters.proceso);
  if (filters.nivel) list = list.filter(a => a.NIVEL_JERARQUIA === filters.nivel);
  if (filters.crit) list = list.filter(a => String(a.CRITICIDAD) === filters.crit);
  if (filters.estado) list = list.filter(a => a.ESTADO_ACTIVO === filters.estado);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(a => ['CODIGO_ACTIVO', 'NOMBRE_ACTIVO', 'SERIAL', 'MODELO', 'MARCA', 'UBICACION', 'AREA', 'LINEA', 'PROCESO']
      .some(k => String(a[k] ?? '').toLowerCase().includes(q)));
  }
  return list.sort((a, b) => String(a.CODIGO_ACTIVO).localeCompare(String(b.CODIGO_ACTIVO), 'es'));
}
