// Cronograma (diagrama de Gantt) del proyecto: EDT, duraciones, dependencias, ruta crítica y línea base.
// Las fechas las calcula el servidor (Cronograma.gs); aquí se usa la MISMA lógica (schedule.js) para el orden,
// la EDT y la vista previa al editar.
import * as api from '../api.js';
import { programarProyecto, crPredecesoras_, crDia_ } from '../schedule.js';
import { ACTIVITY_FORM, L, label } from '../schema.js';
import { esc, emptyState, confirmDialog } from '../../maintenance/ui/components.js';
import { openForm } from '../../maintenance/ui/form.js';
import { can } from '../../permissions.js';
import { toast } from '../../ui.js';

const view = { zoom: 'semana', baseline: true, onlyCritical: false, selected: '', collapsed: new Set() };
const ROW = 30, HEAD = 46;
const PX = { dia: 26, semana: 9, mes: 3 };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Programa el proyecto con los datos actuales (orden, EDT, fechas, holguras)
export function schedule(p) {
  const acts = api.of('ACTIVIDADES', p.ID_PROYECTO);
  const fest = api.rows('PRY_CATALOGOS').filter(c => c.CATALOGO === 'FESTIVO' && c.ESTADO_REGISTRO === 'ACTIVO').map(c => String(c.CODIGO).slice(0, 10));
  const r = programarProyecto({ FECHA_INICIO: String(p.FECHA_INICIO).slice(0, 10), DIAS_LABORABLES: p.DIAS_LABORABLES }, acts.map(a => ({
    ...a, INICIO_RESTRICCION: d10(a.INICIO_RESTRICCION), FECHA_INICIO_REAL: d10(a.FECHA_INICIO_REAL), FECHA_FIN_REAL: d10(a.FECHA_FIN_REAL), LB_INICIO: d10(a.LB_INICIO), LB_FIN: d10(a.LB_FIN)
  })), fest, api.getState().hoy);
  r.byId = Object.fromEntries(acts.map(a => [a.ID_ACTIVIDAD, a]));
  r.edtToId = Object.fromEntries(r.orden.map(id => [r.actividades[id].EDT, id]));
  r.festivos = fest;
  return r;
}
const d10 = v => (v ? String(v).slice(0, 10) : '');

// IDs ↔ notación EDT de MS Project ("2.1; 2.3SS+2")
export function predsToEdt(text, r) {
  return crPredecesoras_(text).map(p => `${r.actividades[p.id]?.EDT || p.id}${p.tipo !== 'FS' ? p.tipo : ''}${p.lag ? (p.lag > 0 ? '+' : '') + p.lag : ''}`).join('; ');
}
export function edtToPreds(text, r) {
  return String(text || '').split(/[;,]/).map(t => t.trim()).filter(Boolean).map(t => {
    const m = t.toUpperCase().replace(/\s+/g, '').match(/^([\d.]+)(FS|SS|FF)?([+-]\d+)?$/);
    if (!m) throw new Error(`Predecesora no válida: "${t}". Ejemplos: 2.1 · 2.3SS+2 · 3.1FF-1`);
    const id = r.edtToId[m[1]];
    if (!id) throw new Error(`No existe la actividad EDT ${m[1]}`);
    return `${id}:${m[2] || 'FS'}${m[3] ? ':' + m[3] : ''}`;
  }).join(', ');
}

export function render(el, { user, project: p }) {
  const r = schedule(p);
  const edit = can(user, 'proyectos.editar');
  const rows = visibleRows(r);
  if (!r.orden.length) {
    el.innerHTML = `<div class="panel">${emptyState({ icon: '📅', title: 'El cronograma está vacío', text: 'Construya la EDT (estructura de desglose del trabajo): fases o paquetes de trabajo como actividades resumen y, dentro, las tareas con su duración en días hábiles, sus predecesoras, responsable y entregable. Use hitos (duración 0) para marcar inicio, fin y entregas clave.', action: edit ? '<button class="btn btn-primary" data-add="TAREA">+ Actividad</button><button class="btn btn-secondary" data-add="HITO">+ Hito</button>' : '' })}</div>`;
    bindToolbar(el, user, p, r);
    return;
  }
  const sel = view.selected && r.actividades[view.selected] ? view.selected : '';
  const selAct = sel ? r.byId[sel] : null;
  el.innerHTML = `
    <div class="panel pg-toolbar">
      ${edit ? `<div class="toolbar">
        <button class="btn btn-primary btn-sm" data-add="TAREA">+ Actividad</button>
        <button class="btn btn-secondary btn-sm" data-add="HITO">+ Hito</button>
        <span class="pg-sep"></span>
        <button class="btn btn-secondary btn-sm" data-act="sub" ${!selAct || selAct.TIPO === 'HITO' ? 'disabled' : ''} title="Agregar subactividad dentro de la seleccionada">+ Subactividad</button>
        <button class="btn btn-secondary btn-sm" data-act="edit" ${sel ? '' : 'disabled'}>Editar</button>
        <button class="btn btn-secondary btn-sm" data-move="arriba" ${sel ? '' : 'disabled'} title="Subir">↑</button>
        <button class="btn btn-secondary btn-sm" data-move="abajo" ${sel ? '' : 'disabled'} title="Bajar">↓</button>
        <button class="btn btn-secondary btn-sm" data-move="desangrar" ${sel ? '' : 'disabled'} title="Subir de nivel (anular sangría)">←</button>
        <button class="btn btn-secondary btn-sm" data-move="sangrar" ${sel ? '' : 'disabled'} title="Bajar de nivel (aplicar sangría)">→</button>
        <button class="btn btn-danger btn-sm" data-act="del" ${sel ? '' : 'disabled'}>Eliminar</button>
      </div>` : ''}
      <div class="toolbar pg-view">
        <select data-zoom aria-label="Escala">${[['dia', 'Días'], ['semana', 'Semanas'], ['mes', 'Meses']].map(([k, l]) => `<option value="${k}" ${view.zoom === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label class="mt-check"><input type="checkbox" data-bl ${view.baseline ? 'checked' : ''}> Línea base</label>
        <label class="mt-check"><input type="checkbox" data-crit ${view.onlyCritical ? 'checked' : ''}> Solo ruta crítica</label>
        <button class="btn btn-secondary btn-sm" data-today>Ir a hoy</button>
      </div>
    </div>
    ${r.errores.length ? `<div class="mt-alert warn">${r.errores.map(esc).join('<br>')}</div>` : ''}
    <div class="panel pg-wrap"><div class="pg-gantt">
      <div class="pg-left">${table(rows, r, sel)}</div>
      <div class="pg-right" data-scroll>${chart(rows, r, p, sel)}</div>
    </div>
    <div class="mt-legend pg-legend"><span><i style="background:#3b82f6"></i>Tarea</span><span><i style="background:#dc2626"></i>Ruta crítica</span><span><i style="background:#1e293b"></i>Resumen</span><span><i style="background:#9ca3af"></i>Línea base</span><span><i class="pg-diamond"></i>Hito</span><span><i style="background:#ef4444;width:2px"></i>Hoy</span></div></div>`;
  bindToolbar(el, user, p, r);
  el.querySelectorAll('[data-row]').forEach(tr => {
    tr.onclick = e => { if (e.target.closest('[data-toggle]')) return; view.selected = tr.dataset.row; render(el, { user, project: p }); };
    tr.ondblclick = () => edit && openActivityForm(user, p, r, { act: r.byId[tr.dataset.row] });
  });
  el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => { const id = b.dataset.toggle; view.collapsed.has(id) ? view.collapsed.delete(id) : view.collapsed.add(id); render(el, { user, project: p }); });
  el.querySelector('[data-zoom]').onchange = e => { view.zoom = e.target.value; render(el, { user, project: p }); };
  el.querySelector('[data-bl]').onchange = e => { view.baseline = e.target.checked; render(el, { user, project: p }); };
  el.querySelector('[data-crit]').onchange = e => { view.onlyCritical = e.target.checked; render(el, { user, project: p }); };
  const sc = el.querySelector('[data-scroll]');
  const scrollToday = () => { const t = sc.querySelector('[data-todayx]'); if (t) sc.scrollLeft = Math.max(0, Number(t.dataset.todayx) - sc.clientWidth / 3); };
  el.querySelector('[data-today]').onclick = scrollToday;
  if (view.scrollLeft !== undefined) sc.scrollLeft = view.scrollLeft; else scrollToday();
  sc.onscroll = () => { view.scrollLeft = sc.scrollLeft; };
}

function visibleRows(r) {
  const out = [];
  const hidden = new Set();
  for (const id of r.orden) {
    const a = r.byId[id];
    if (hidden.has(a.ID_PADRE)) { hidden.add(id); continue; }
    if (view.collapsed.has(id)) hidden.add(id);
    if (view.onlyCritical && r.actividades[id].ES_RESUMEN === 'NO' && r.actividades[id].CRITICA !== 'SI') continue;
    out.push(id);
  }
  return out;
}

function fmtD(t) { const d = String(t || '').slice(0, 10); return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : ''; }

function table(rows, r, sel) {
  return `<table class="pg-table"><thead><tr><th style="width:48px">EDT</th><th>Nombre de la actividad</th><th>Dur.</th><th>Inicio</th><th>Fin</th><th>Pred.</th><th>Responsable</th><th>%</th></tr></thead><tbody>${rows.map(id => {
    const a = r.byId[id], c = r.actividades[id];
    const resumen = c.ES_RESUMEN === 'SI';
    const late = c.ESTADO_CALC === 'ATRASADA';
    return `<tr data-row="${esc(id)}" class="${resumen ? 'sum' : ''} ${id === sel ? 'sel' : ''} ${c.CRITICA === 'SI' && !resumen ? 'crit' : ''}" title="${esc(a.ENTREGABLE ? 'Entregable: ' + a.ENTREGABLE : a.NOMBRE)}">
      <td class="pg-edt">${esc(c.EDT)}</td>
      <td class="pg-name" style="padding-left:${6 + (c.NIVEL - 1) * 16}px">${resumen ? `<button class="pg-toggle" data-toggle="${esc(id)}" aria-label="Contraer o expandir">${view.collapsed.has(id) ? '▸' : '▾'}</button>` : (a.TIPO === 'HITO' ? '<span class="pg-mi">◆</span>' : '<span class="pg-sp"></span>')}${esc(a.NOMBRE)}${late ? ' <span class="status bad">atrasada</span>' : ''}</td>
      <td>${a.TIPO === 'HITO' ? '0 d' : esc((c.DURACION_CALC ?? a.DURACION_DIAS) + ' d')}</td>
      <td>${esc(fmtD(c.FECHA_INICIO))}</td><td>${esc(fmtD(c.FECHA_FIN))}</td>
      <td class="pg-pred">${esc(predsToEdt(a.PREDECESORAS, r))}</td>
      <td class="pg-resp">${esc(a.RESPONSABLE || '')}</td>
      <td>${esc(Math.round(Number(c.AVANCE_PCT) || 0))}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function chart(rows, r, p, sel) {
  const days = rows.flatMap(id => { const c = r.actividades[id], a = r.byId[id]; return [crDia_(c.FECHA_INICIO), crDia_(c.FECHA_FIN), crDia_(a.LB_INICIO), crDia_(a.LB_FIN)]; }).filter(x => x !== null);
  const hoy = crDia_(api.getState().hoy);
  const d0 = Math.min(...days, hoy) - 3, d1 = Math.max(...days, hoy) + 10;
  const px = PX[view.zoom];
  const W = Math.max(600, (d1 - d0 + 1) * px), H = HEAD + rows.length * ROW;
  const x = d => (d - d0) * px;
  const fest = new Set(r.festivos.map(crDia_));
  const habil = d => { const w = new Date(d * 86400000).getUTCDay(); return !(w === 0 || (w === 6 && p.DIAS_LABORABLES !== 'L-S') || fest.has(d)); };
  let g = '';
  // fondo: días no laborables y encabezado
  if (view.zoom !== 'mes') for (let d = d0; d <= d1; d++) if (!habil(d)) g += `<rect x="${x(d)}" y="${HEAD}" width="${px}" height="${H - HEAD}" class="pg-off"/>`;
  for (let d = d0; d <= d1; d++) {
    const dt = new Date(d * 86400000);
    if (dt.getUTCDate() === 1 || d === d0) g += `<text x="${x(d) + 3}" y="16" class="pg-hm">${MESES[dt.getUTCMonth()]} ${dt.getUTCFullYear()}</text><line x1="${x(d)}" x2="${x(d)}" y1="0" y2="${H}" class="pg-ml"/>`;
    if (view.zoom === 'dia') g += `<text x="${x(d) + px / 2}" y="36" text-anchor="middle" class="pg-hd">${dt.getUTCDate()}</text>`;
    else if (view.zoom === 'semana' && dt.getUTCDay() === 1) g += `<text x="${x(d) + 2}" y="36" class="pg-hd">${dt.getUTCDate()}</text><line x1="${x(d)}" x2="${x(d)}" y1="${HEAD}" y2="${H}" class="pg-wl"/>`;
  }
  g += `<line x1="0" x2="${W}" y1="${HEAD - 0.5}" y2="${HEAD - 0.5}" class="pg-ml"/>`;
  const pos = {};
  rows.forEach((id, i) => {
    const c = r.actividades[id], a = r.byId[id];
    const y = HEAD + i * ROW;
    if (id === sel) g += `<rect x="0" y="${y}" width="${W}" height="${ROW}" class="pg-selrow"/>`;
    const s = crDia_(c.FECHA_INICIO), e = crDia_(c.FECHA_FIN);
    if (s === null) return;
    pos[id] = { y: y + ROW / 2, xs: x(s), xe: x(e + 1), milestone: a.TIPO === 'HITO' && c.ES_RESUMEN !== 'SI' };
    const bs = crDia_(a.LB_INICIO), be = crDia_(a.LB_FIN);
    if (view.baseline && bs !== null && be !== null) g += `<rect x="${x(bs)}" y="${y + 22}" width="${Math.max(2, x(be + 1) - x(bs))}" height="4" class="pg-bl"><title>Línea base: ${fmtD(a.LB_INICIO)} → ${fmtD(a.LB_FIN)}</title></rect>`;
    const tip = `${c.EDT} ${a.NOMBRE}\n${fmtD(c.FECHA_INICIO)} → ${fmtD(c.FECHA_FIN)} · ${c.DURACION_CALC} d hábiles · avance ${Math.round(c.AVANCE_PCT)}%\nHolgura: ${c.HOLGURA_DIAS ?? '—'} d${a.RESPONSABLE ? '\nResponsable: ' + a.RESPONSABLE : ''}${a.ENTREGABLE ? '\nEntregable: ' + a.ENTREGABLE : ''}`;
    if (c.ES_RESUMEN === 'SI') {
      const w = Math.max(4, x(e + 1) - x(s));
      g += `<g><title>${esc(tip)}</title><rect x="${x(s)}" y="${y + 10}" width="${w}" height="6" class="pg-sum"/><path d="M${x(s)} ${y + 10}v11l5-5zM${x(s) + w} ${y + 10}v11l-5-5z" class="pg-sumcap"/></g>`;
    } else if (pos[id].milestone) {
      const cx = x(s) + Math.min(px, 12) / 2;
      pos[id].xs = pos[id].xe = cx;
      g += `<g><title>${esc(tip)}</title><path d="M${cx} ${y + 6}l9 9-9 9-9-9z" class="pg-ms ${c.CRITICA === 'SI' ? 'crit' : ''}"/><text x="${cx + 13}" y="${y + 19}" class="pg-lbl">${esc(fmtD(c.FECHA_INICIO))}</text></g>`;
    } else {
      const w = Math.max(3, x(e + 1) - x(s));
      const crit = c.CRITICA === 'SI';
      g += `<g><title>${esc(tip)}</title><rect x="${x(s)}" y="${y + 7}" width="${w}" height="14" rx="3" class="pg-bar ${crit ? 'crit' : ''}"/>
        <rect x="${x(s)}" y="${y + 7}" width="${w * Math.min(100, Number(c.AVANCE_PCT) || 0) / 100}" height="14" rx="3" class="pg-prog ${crit ? 'crit' : ''}"/>
        ${a.RESPONSABLE ? `<text x="${x(s) + w + 5}" y="${y + 19}" class="pg-lbl">${esc(a.RESPONSABLE)}</text>` : ''}</g>`;
    }
  });
  // flechas de dependencia
  rows.forEach(id => {
    const to = pos[id];
    if (!to) return;
    crPredecesoras_(r.byId[id].PREDECESORAS).forEach(pd => {
      const from = pos[pd.id];
      if (!from) return;
      const crit = r.actividades[id].CRITICA === 'SI' && r.actividades[pd.id]?.CRITICA === 'SI';
      const x1 = pd.tipo === 'SS' ? from.xs : from.xe, x2 = pd.tipo === 'FF' ? to.xe : to.xs;
      const y1 = from.y, y2 = to.y, dir = y2 > y1 ? 1 : -1;
      const path = pd.tipo === 'FF'
        ? `M${x1} ${y1}H${Math.max(x1, x2) + 8}V${y2}H${x2 + 4}`
        : (x2 - x1 >= 12 ? `M${x1} ${y1}H${x1 + 6}V${y2}H${x2 - 4}` : `M${x1} ${y1}H${x1 + 6}V${y1 + dir * ROW / 2}H${x2 - 10}V${y2}H${x2 - 4}`);
      g += `<path d="${path}" class="pg-dep ${crit ? 'crit' : ''}" marker-end="url(#pg-arrow${crit ? 'c' : ''})"/>`;
    });
  });
  if (hoy >= d0 && hoy <= d1) g += `<line x1="${x(hoy)}" x2="${x(hoy)}" y1="${HEAD - 8}" y2="${H}" class="pg-today" data-todayx="${x(hoy)}"/><text x="${x(hoy) + 3}" y="${HEAD - 10}" class="pg-todayt">hoy</text>`;
  return `<svg class="pg-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagrama de Gantt" data-todayx="${hoy >= d0 && hoy <= d1 ? x(hoy) : 0}">
    <defs><marker id="pg-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#475569"/></marker><marker id="pg-arrowc" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#dc2626"/></marker></defs>${g}</svg>`;
}

function bindToolbar(el, user, p, r) {
  const sel = view.selected && r.byId[view.selected] ? r.byId[view.selected] : null;
  el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    // Nueva actividad: hermana de la seleccionada (o en el primer nivel)
    const padre = sel ? (r.actividades[sel.ID_ACTIVIDAD].ES_RESUMEN === 'SI' ? sel.ID_ACTIVIDAD : sel.ID_PADRE || '') : '';
    openActivityForm(user, p, r, { preset: { TIPO: b.dataset.add, ID_PADRE: padre, DURACION_DIAS: b.dataset.add === 'HITO' ? 0 : 1 } });
  });
  el.querySelector('[data-act="sub"]')?.addEventListener('click', () => sel && openActivityForm(user, p, r, { preset: { TIPO: 'TAREA', ID_PADRE: sel.ID_ACTIVIDAD, DURACION_DIAS: 1 } }));
  el.querySelector('[data-act="edit"]')?.addEventListener('click', () => sel && openActivityForm(user, p, r, { act: sel }));
  el.querySelector('[data-act="del"]')?.addEventListener('click', async () => {
    if (!sel) return;
    const hijas = r.orden.filter(id => r.byId[id].ID_PADRE === sel.ID_ACTIVIDAD).length;
    const withLB = !!p.LB_FECHA;
    const ans = await confirmDialog(`¿Eliminar "${sel.NOMBRE}"${hijas ? ' y sus subactividades' : ''}? Las dependencias que apuntan a ella se quitarán.${withLB ? ' El proyecto tiene línea base: el motivo queda en la auditoría.' : ''}`, { danger: true, okLabel: 'Eliminar', requireReason: withLB });
    if (!ans) return;
    try { await api.write('estado', 'ACTIVIDADES', { id: sel.ID_ACTIVIDAD, estado: 'ANULADO', motivo: withLB ? ans : '' }); view.selected = ''; toast('Actividad eliminada'); } catch (e) { toast(e.message); }
  });
  el.querySelectorAll('[data-move]').forEach(b => b.onclick = async () => {
    if (!sel) return;
    b.disabled = true;
    try { await api.move(sel.ID_ACTIVIDAD, b.dataset.move); } catch (e) { toast(e.message); } finally { b.disabled = false; }
  });
}

export function openActivityForm(user, p, r, { act = null, preset = {} } = {}) {
  const editing = !!act;
  const summaries = () => r.orden.filter(id => r.byId[id].TIPO !== 'HITO' && id !== act?.ID_ACTIVIDAD && !isDescendant(r, id, act?.ID_ACTIVIDAD))
    .map(id => ({ value: id, label: `${r.actividades[id].EDT} · ${r.byId[id].NOMBRE}` }));
  const isSummary = editing && r.actividades[act.ID_ACTIVIDAD]?.ES_RESUMEN === 'SI';
  openForm({
    title: editing ? `Editar ${r.actividades[act.ID_ACTIVIDAD]?.EDT || ''} · ${act.NOMBRE}` : (preset.TIPO === 'HITO' ? 'Nuevo hito' : 'Nueva actividad'),
    form: ACTIVITY_FORM, editing, width: 'wide',
    values: editing ? { ...act, PREDECESORAS_EDT: predsToEdt(act.PREDECESORAS, r) } : { ESTADO_ENTREGABLE: 'PENDIENTE', AVANCE_PCT: 0, ...preset },
    optionsFor: { ID_PADRE: summaries },
    refreshOn: ['TIPO'],
    hidden: (name, v) => (name === 'DURACION_DIAS' && (v.TIPO === 'HITO' || isSummary)) || (isSummary && ['PREDECESORAS_EDT', 'AVANCE_PCT', 'FECHA_INICIO_REAL', 'FECHA_FIN_REAL', 'INICIO_RESTRICCION', 'COSTO_PLANIFICADO', 'COSTO_REAL'].includes(name)),
    preview: v => {
      try {
        const preds = edtToPreds(v.PREDECESORAS_EDT, r);
        const names = crPredecesoras_(preds).map(x => `${r.actividades[x.id].EDT} ${esc(r.byId[x.id].NOMBRE)} (${x.tipo}${x.lag ? (x.lag > 0 ? '+' : '') + x.lag : ''})`);
        const c = editing ? r.actividades[act.ID_ACTIVIDAD] : null;
        return `${names.length ? '<b>Depende de:</b> ' + names.join(' · ') : '<span class="muted">Sin predecesoras: inicia con el proyecto o en la fecha "No comenzar antes de".</span>'}${c ? `<br><b>Programada:</b> ${fmtD(c.FECHA_INICIO)} → ${fmtD(c.FECHA_FIN)} · holgura ${c.HOLGURA_DIAS ?? '—'} d${c.CRITICA === 'SI' ? ' · <span class="status bad">ruta crítica</span>' : ''}` : ''}${isSummary ? '<br><span class="metric-note">Actividad resumen: sus fechas, duración y avance se calculan con sus subactividades.</span>' : ''}`;
      } catch (e) { return `<span class="status bad">${esc(e.message)}</span>`; }
    },
    submitLabel: editing ? 'Guardar' : 'Agregar',
    onSubmit: async d => {
      const datos = { ...d };
      if ('PREDECESORAS_EDT' in datos) { datos.PREDECESORAS = edtToPreds(datos.PREDECESORAS_EDT, r); delete datos.PREDECESORAS_EDT; }
      if (datos.TIPO === 'HITO') datos.DURACION_DIAS = 0;
      if (editing) await api.write('actualizar', 'ACTIVIDADES', { id: act.ID_ACTIVIDAD, datos });
      else { const n = await api.write('crear', 'ACTIVIDADES', { datos: { ...datos, ID_PROYECTO: p.ID_PROYECTO } }); view.selected = n.ID_ACTIVIDAD; }
      toast(editing ? 'Actividad actualizada; cronograma recalculado' : 'Actividad agregada');
    }
  });
}

function isDescendant(r, id, ancestor) {
  if (!ancestor) return false;
  let x = r.byId[id], g = 0;
  while (x && g++ < 50) { if (x.ID_PADRE === ancestor) return true; x = r.byId[x.ID_PADRE]; }
  return false;
}

export { label, L };
