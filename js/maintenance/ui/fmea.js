// Vista "FMEA / AMEF": análisis por activo/componente con escalas controladas (NPR = S×O×D lo calcula
// el servidor), taxonomía configurable de modos de falla y criterios de las escalas.
import * as assets from '../services/assets.js';
import * as catalogs from '../services/catalogs.js';
import { fmea, failureModes, events } from '../services/operations.js';
import { FMEA_FORM, MODE_FORM } from '../domain/schema.js';
import { nprLevel } from '../domain/fmea.js';
import { esc, emptyState, dataTable, badge } from './components.js';
import { openForm } from './form.js';
import { perms, changeState } from './actions.js';
import { assetOptions, componentOptions, modeOptions } from './options.js';
import { toast } from '../../ui.js';

const SUB = [['analisis', 'Análisis FMEA'], ['modos', 'Modos de falla'], ['escalas', 'Escalas S / O / D']];
const filters = { activo: '', estado: '', q: '' };
const STATE = { ABIERTO: 'Abierta', EN_PROCESO: 'En proceso', CERRADO: 'Cerrada' };

export function primaryAction(user, id) {
  const p = perms(user);
  if (id === 'modos') return p.catalogos ? { label: '+ Modo de falla', run: () => openModeForm(user) } : null;
  if (id === 'escalas') return null;
  return p.crear ? { label: '+ Nuevo análisis', run: () => openFMEAForm(user) } : null;
}

export function render(el, { user, id }) {
  const sub = SUB.some(s => s[0] === id) ? id : 'analisis';
  el.innerHTML = `<nav class="mt-subnav">${SUB.map(([k, l]) => `<a href="#/mantenimiento/fmea/${k}" class="${k === sub ? 'active' : ''}">${esc(l)}</a>`).join('')}</nav><div data-sub></div>`;
  const box = el.querySelector('[data-sub]');
  ({ analisis: renderAnalysis, modos: renderModes, escalas: renderScales })[sub](box, user);
}

function renderAnalysis(el, user) {
  const p = perms(user);
  const all = fmea.all();
  if (!all.length) {
    el.innerHTML = `<div class="panel">${emptyState({ icon: '△', title: 'Sin análisis FMEA', text: 'Analice funciones, fallas funcionales, modos, efectos y causas por activo o componente. Las fallas reales se comparan automáticamente contra este análisis.', action: p.crear ? '<button class="btn btn-primary" data-new>+ Nuevo análisis</button>' : '' })}</div>`;
    el.querySelector('[data-new]')?.addEventListener('click', () => openFMEAForm(user));
    return;
  }
  const realCount = id => events.where(e => e.ID_FMEA === id).length;
  el.innerHTML = `<div class="panel mt-filters"><div class="toolbar">
      <input type="search" data-f="q" placeholder="Buscar función, efecto, causa…" value="${esc(filters.q)}" aria-label="Buscar">
      <select data-f="activo" aria-label="Activo"><option value="">Activo: todos</option>${assetOptions().map(o => `<option value="${esc(o.value)}" ${o.value === filters.activo ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
      <select data-f="estado" aria-label="Estado de la acción"><option value="">Acción: todas</option>${Object.entries(STATE).map(([k, v]) => `<option value="${k}" ${k === filters.estado ? 'selected' : ''}>${v}</option>`).join('')}</select>
    </div></div><div class="panel" data-table></div>`;
  const draw = () => {
    const q = filters.q.toLowerCase();
    const scope = filters.activo ? new Set([filters.activo, ...assets.descendants(filters.activo).map(a => a.ID_ACTIVO)]) : null;
    const list = all.filter(f => (!scope || scope.has(f.ID_ACTIVO)) && (!filters.estado || f.ESTADO === filters.estado) &&
      (!q || `${f.FUNCION} ${f.FALLA_FUNCIONAL} ${f.EFECTO_FALLA} ${f.CAUSA_POTENCIAL} ${f.MODO_FALLA}`.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.NPR) - Number(a.NPR));
    el.querySelector('[data-table]').innerHTML = `<div class="mt-panel-head"><h3>Análisis <span class="muted">(${list.length}, ordenados por NPR)</span></h3></div>` + dataTable(list, [
      { label: 'NPR', html: f => `<span class="status ${nprLevel(f.NPR)}">${esc(f.NPR)}</span>` },
      { label: 'S·O·D', html: f => esc(`${f.SEVERIDAD}·${f.OCURRENCIA}·${f.DETECCION}`) },
      { label: 'Activo / componente', html: f => esc(assets.get(f.ID_ACTIVO)?.CODIGO_ACTIVO || f.ID_ACTIVO) + (f.COMPONENTE ? `<div class="metric-note">${esc(f.COMPONENTE)}</div>` : '') },
      { label: 'Modo de falla', key: 'MODO_FALLA' },
      { label: 'Efecto', html: f => esc(String(f.EFECTO_FALLA).slice(0, 70)) },
      { label: 'Causa', html: f => esc(String(f.CAUSA_POTENCIAL).slice(0, 70)) },
      { label: 'Acción', html: f => (f.ACCION_RECOMENDADA ? esc(String(f.ACCION_RECOMENDADA).slice(0, 60)) + '<br>' : '') + badge(f.ESTADO === 'CERRADO' ? 'CERRADO' : 'ABIERTO', STATE[f.ESTADO]) },
      { label: 'Fallas reales', html: f => { const n = realCount(f.ID_FMEA); return n ? `<b>${n}</b>` : '<span class="muted">0</span>'; } },
      { label: '', html: f => `<div class="toolbar mt-row-actions">${p.editar && f.ESTADO_REGISTRO === 'ACTIVO' ? `<button class="btn btn-secondary btn-sm" data-edit="${esc(f.ID_FMEA)}">Editar</button>` : ''}${p.anular ? `<button class="btn btn-secondary btn-sm" data-void="${esc(f.ID_FMEA)}">Anular</button>` : ''}</div>` }
    ], { empty: 'Ningún análisis coincide con los filtros' });
    el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openFMEAForm(user, { item: fmea.get(b.dataset.edit) }));
    el.querySelectorAll('[data-void]').forEach(b => b.onclick = () => changeState(user, fmea, b.dataset.void, 'ANULADO', `el análisis ${b.dataset.void}`));
  };
  draw();
  el.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener(inp.type === 'search' ? 'input' : 'change', () => { filters[inp.dataset.f] = inp.value; draw(); }));
}

function renderModes(el, user) {
  const p = perms(user);
  const all = failureModes.all().sort((a, b) => String(a.CODIGO).localeCompare(String(b.CODIGO)));
  const cats = all.filter(m => Number(m.NIVEL) === 1);
  const count = id => events.where(e => e.ID_MODO_FALLA === id).length;
  if (!all.length) { el.innerHTML = `<div class="panel">${emptyState({ icon: '≡', title: 'Sin taxonomía de modos de falla', text: 'El servidor crea la taxonomía base al ejecutar instalar.' })}</div>`; return; }
  el.innerHTML = `<div class="panel"><p class="metric-note">Taxonomía de dos niveles: categoría (MEC, ELE, HID…) y modo (MEC-ROD, ELE-MOT…). Cada falla selecciona un código para calcular Pareto, fallas recurrentes y MTBF por modo.</p>
    <div class="mt-modes">${cats.map(c => `<div class="mt-mode-cat"><div class="mt-panel-head"><h4><code>${esc(c.CODIGO)}</code> ${esc(c.NOMBRE)} ${c.ESTADO_REGISTRO !== 'ACTIVO' ? badge(c.ESTADO_REGISTRO) : ''}</h4>${p.catalogos && c.ESTADO_REGISTRO === 'ACTIVO' ? `<button class="btn btn-secondary btn-sm" data-add="${esc(c.CODIGO)}">+ Modo</button>` : ''}</div>
      <ul>${all.filter(m => m.CODIGO_PADRE === c.CODIGO).map(m => `<li class="${m.ESTADO_REGISTRO !== 'ACTIVO' ? 'inactive' : ''}"><code>${esc(m.CODIGO)}</code> ${esc(m.NOMBRE)} <span class="muted">· ${count(m.ID_MODO_FALLA)} falla(s)</span>${p.catalogos ? ` <button class="mt-link" data-toggle="${esc(m.ID_MODO_FALLA)}">${m.ESTADO_REGISTRO === 'ACTIVO' ? 'inactivar' : 'activar'}</button>` : ''}</li>`).join('') || '<li class="muted">Sin modos</li>'}</ul></div>`).join('')}</div></div>`;
  el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => openModeForm(user, b.dataset.add + '-'));
  el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => { const m = failureModes.get(b.dataset.toggle); changeState(user, failureModes, m.ID_MODO_FALLA, m.ESTADO_REGISTRO === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO', `el modo ${m.CODIGO}`); });
}

function renderScales(el) {
  el.innerHTML = `<div class="grid3">${['SEVERIDAD', 'OCURRENCIA', 'DETECCION'].map(cat => `<div class="panel"><h3>${esc(cat === 'DETECCION' ? 'Detección' : cat[0] + cat.slice(1).toLowerCase())}</h3>
    <table class="mt-table mt-scale"><tbody>${catalogs.entries(cat).map(c => `<tr><td><b>${esc(c.CODIGO)}</b></td><td>${esc(String(c.VALOR).replace(/^\d+\s*–\s*/, ''))}<div class="metric-note">${esc(c.DESCRIPCION || '')}</div></td></tr>`).join('')}</tbody></table></div>`).join('')}</div>
    <p class="metric-note">Los criterios son editables en Catálogos (SEVERIDAD, OCURRENCIA, DETECCION). En el formulario solo se puede elegir un valor de la escala: no se admite texto libre.</p>`;
}

export function openFMEAForm(user, { item = null, preset = {} } = {}) {
  const editing = !!item;
  openForm({
    title: editing ? `Editar ${item.ID_FMEA}` : (preset.ID_EVENTO_ORIGEN ? 'Incorporar falla real al FMEA' : 'Nuevo análisis FMEA'),
    form: FMEA_FORM, editing, width: 'wide',
    values: editing ? item : { ESTADO: 'ABIERTO', ...preset },
    refreshOn: ['ID_ACTIVO'],
    optionsFor: { ID_ACTIVO: assetOptions, ID_COMPONENTE: v => componentOptions(v.ID_ACTIVO), ID_MODO_FALLA: modeOptions, ID_EVENTO_ORIGEN: v => events.where(e => e.ID_ACTIVO === v.ID_ACTIVO || e.ID_EVENTO === v.ID_EVENTO_ORIGEN).map(e => ({ value: e.ID_EVENTO, label: `${e.ID_EVENTO} · ${String(e.FECHA_EVENTO).slice(0, 10)}` })) },
    hidden: name => name === 'ID_EVENTO_ORIGEN' && !editing && !preset.ID_EVENTO_ORIGEN,
    preview: v => {
      const s = Number(v.SEVERIDAD), o = Number(v.OCURRENCIA), d = Number(v.DETECCION);
      if (!s || !o || !d) return '<span class="muted">NPR = S × O × D (se calcula al seleccionar las tres escalas)</span>';
      const npr = s * o * d;
      return `NPR calculado: <span class="status ${nprLevel(npr)}">${npr}</span> <span class="metric-note">(${s} × ${o} × ${d}) · el servidor lo recalcula al guardar</span>`;
    },
    submitLabel: editing ? 'Guardar' : 'Crear análisis',
    onSubmit: async d => {
      const r = editing ? await fmea.update(item.ID_FMEA, d, user) : await fmea.create(d, user);
      toast(`${r.ID_FMEA} guardado · NPR ${r.NPR}`);
    }
  });
}

export function openModeForm(user, prefix = '') {
  openForm({
    title: 'Nuevo modo de falla', form: MODE_FORM, values: { CODIGO: prefix },
    onSubmit: async d => { const r = await failureModes.create(d, user); toast(`Modo ${r.CODIGO} creado`); }
  });
}
