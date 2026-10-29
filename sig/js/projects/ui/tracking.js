// Seguimiento y control del proyecto (PMBOK): entregables, compromisos, bitácora de seguimiento,
// riesgos, interesados, control de cambios y lecciones aprendidas.
import * as api from '../api.js';
import { COMMITMENT_FORM, TRACKING_FORM, RISK_FORM, STAKEHOLDER_FORM, CHANGE_FORM, LESSON_FORM, L, label } from '../schema.js';
import { schedule, openActivityForm } from './gantt.js';
import { esc, emptyState, dataTable, badge, confirmDialog, fmtNumber, fmtMoney, safeUrl } from '../../maintenance/ui/components.js';
import { openForm } from '../../maintenance/ui/form.js';
import { can } from '../../permissions.js';
import { toast } from '../../ui.js';
import { crDia_ } from '../schedule.js';

const hoy = () => api.getState().hoy;
const fmtD = t => { const d = String(t || '').slice(0, 10); return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—'; };
const SALUD = { VERDE: ['good', 'En control'], AMARILLO: ['warn', 'En riesgo'], ROJO: ['bad', 'Crítico'] };
export const saludBadge = s => s ? `<span class="status ${SALUD[s]?.[0] || ''}">${esc(SALUD[s]?.[1] || s)}</span>` : '<span class="muted">—</span>';
export const overdue = c => c.ESTADO === 'ABIERTO' && String(c.FECHA_COMPROMISO).slice(0, 10) < hoy();

async function save(tabla, item, datos, user, ok) {
  item ? await api.write('actualizar', tabla, { id: item[api.ID[tabla]], datos }) : await api.write('crear', tabla, { datos });
  toast(ok);
}
async function remove(tabla, item, nombre) {
  if (!await confirmDialog(`¿Eliminar ${nombre}? Queda registrado en la auditoría.`, { danger: true, okLabel: 'Eliminar' })) return;
  try { await api.write('estado', tabla, { id: item[api.ID[tabla]], estado: 'ANULADO' }); toast('Eliminado'); } catch (e) { toast(e.message); }
}

/* ------------------------------ Entregables ------------------------------ */
export function deliverables(el, { user, project: p }) {
  const r = schedule(p);
  const list = r.orden.map(id => r.byId[id]).filter(a => a.ENTREGABLE);
  if (!list.length) { el.innerHTML = `<div class="panel">${emptyState({ icon: '📦', title: 'Sin entregables definidos', text: 'Asigne un entregable a las actividades del cronograma (campo "Entregable"). Su fecha de entrega es el fin programado de la actividad.' })}</div>`; return; }
  el.innerHTML = `<div class="panel">${dataTable(list, [
    { label: 'EDT', html: a => esc(r.actividades[a.ID_ACTIVIDAD].EDT) },
    { label: 'Entregable', html: a => `<b>${esc(a.ENTREGABLE)}</b><div class="metric-note">${esc(a.NOMBRE)}</div>` },
    { label: 'Responsable', html: a => esc(a.RESPONSABLE || '—') },
    { label: 'Entrega programada', html: a => esc(fmtD(r.actividades[a.ID_ACTIVIDAD].FECHA_FIN)) + (a.LB_FIN ? `<div class="metric-note">Línea base: ${esc(fmtD(a.LB_FIN))}</div>` : '') },
    { label: 'Estado', html: a => { const late = (a.ESTADO_ENTREGABLE || 'PENDIENTE') === 'PENDIENTE' && String(r.actividades[a.ID_ACTIVIDAD].FECHA_FIN) < hoy(); return badge(a.ESTADO_ENTREGABLE === 'APROBADO' ? 'CERRADO' : a.ESTADO_ENTREGABLE === 'RECHAZADO' ? 'ANULADO' : 'ABIERTO', label('ENTREGABLE', a.ESTADO_ENTREGABLE || 'PENDIENTE')) + (late ? ' <span class="status bad">vencido</span>' : ''); } },
    { label: 'Entregado', html: a => { if (!a.FECHA_ENTREGA_REAL) return '—'; const dv = crDia_(String(a.FECHA_ENTREGA_REAL).slice(0, 10)) - crDia_(r.actividades[a.ID_ACTIVIDAD].FECHA_FIN); return esc(fmtD(a.FECHA_ENTREGA_REAL)) + (dv ? ` <span class="status ${dv > 0 ? 'bad' : 'good'}">${dv > 0 ? '+' : ''}${dv} d</span>` : ''); } },
    { label: 'Evidencia', html: a => safeUrl(a.URL_EVIDENCIA) ? `<a href="${esc(a.URL_EVIDENCIA)}" target="_blank" rel="noopener noreferrer">Ver ↗</a>` : '—' },
    { label: '', html: a => can(user, 'proyectos.editar') ? `<button class="btn btn-secondary btn-sm" data-edit="${esc(a.ID_ACTIVIDAD)}">Actualizar</button>` : '' }
  ])}</div>`;
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openActivityForm(user, p, r, { act: r.byId[b.dataset.edit] }));
}

/* ------------------------------ Compromisos ------------------------------ */
export function commitments(el, { user, project: p }) {
  const edit = can(user, 'proyectos.editar');
  const list = api.of('COMPROMISOS', p.ID_PROYECTO).sort((a, b) => String(a.FECHA_COMPROMISO).localeCompare(String(b.FECHA_COMPROMISO)));
  const r = schedule(p);
  const groups = [['Vencidos', list.filter(overdue)], ['Abiertos', list.filter(c => c.ESTADO === 'ABIERTO' && !overdue(c))], ['Cumplidos y cancelados', list.filter(c => c.ESTADO !== 'ABIERTO')]];
  el.innerHTML = `<div class="panel"><div class="mt-panel-head"><div><h3>Compromisos</h3><div class="metric-note">Acuerdos con responsable y fecha (de reuniones, comités o actividades).</div></div>${edit ? '<button class="btn btn-primary btn-sm" data-new>+ Compromiso</button>' : ''}</div>
    ${list.length ? groups.filter(g => g[1].length).map(([t, l]) => `<h4>${t} (${l.length})</h4>${dataTable(l, [
      { label: 'Compromiso', html: c => `<b>${esc(c.DESCRIPCION)}</b>${c.OBSERVACION ? `<div class="metric-note">${esc(c.OBSERVACION)}</div>` : ''}` },
      { label: 'Responsable', key: 'RESPONSABLE' },
      { label: 'Fecha', html: c => esc(fmtD(c.FECHA_COMPROMISO)) + (overdue(c) ? ` <span class="status bad">${crDia_(hoy()) - crDia_(String(c.FECHA_COMPROMISO).slice(0, 10))} d vencido</span>` : '') },
      { label: 'Origen', html: c => esc([c.ID_SEGUIMIENTO ? api.get('SEGUIMIENTO', c.ID_SEGUIMIENTO)?.TITULO : '', c.ID_ACTIVIDAD ? (r.actividades[c.ID_ACTIVIDAD]?.EDT + ' ' + (r.byId[c.ID_ACTIVIDAD]?.NOMBRE || '')) : ''].filter(Boolean).join(' · ') || '—') },
      { label: 'Estado', html: c => badge(c.ESTADO === 'CUMPLIDO' ? 'CERRADO' : c.ESTADO === 'CANCELADO' ? 'INACTIVO' : 'ABIERTO', label('COMPROMISO', c.ESTADO)) + (c.FECHA_CUMPLIMIENTO ? `<div class="metric-note">${esc(fmtD(c.FECHA_CUMPLIMIENTO))}</div>` : '') },
      { label: '', html: c => edit ? `<div class="toolbar mt-row-actions">${c.ESTADO === 'ABIERTO' ? `<button class="btn btn-secondary btn-sm" data-done="${esc(c.ID_COMPROMISO)}">✓ Cumplido</button>` : ''}<button class="btn btn-secondary btn-sm" data-edit="${esc(c.ID_COMPROMISO)}">Editar</button><button class="btn btn-secondary btn-sm" data-del="${esc(c.ID_COMPROMISO)}">Eliminar</button></div>` : '' }
    ])}`).join('') : emptyState({ icon: '🤝', title: 'Sin compromisos', text: 'Registre los acuerdos de cada reunión con su responsable y fecha.' })}</div>`;
  const form = (item, preset = {}) => openForm({
    title: item ? 'Editar compromiso' : 'Nuevo compromiso', form: COMMITMENT_FORM, editing: !!item,
    values: item || { ESTADO: 'ABIERTO', ...preset },
    optionsFor: { ID_ACTIVIDAD: () => r.orden.map(id => ({ value: id, label: `${r.actividades[id].EDT} · ${r.byId[id].NOMBRE}` })), ID_SEGUIMIENTO: () => api.of('SEGUIMIENTO', p.ID_PROYECTO).map(s => ({ value: s.ID_SEGUIMIENTO, label: `${fmtD(s.FECHA)} · ${s.TITULO}` })) },
    onSubmit: d => save('COMPROMISOS', item, item ? d : { ...d, ID_PROYECTO: p.ID_PROYECTO }, user, 'Compromiso guardado')
  });
  el.querySelector('[data-new]')?.addEventListener('click', () => form(null));
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => form(api.get('COMPROMISOS', b.dataset.edit)));
  el.querySelectorAll('[data-done]').forEach(b => b.onclick = async () => { try { await api.write('actualizar', 'COMPROMISOS', { id: b.dataset.done, datos: { ESTADO: 'CUMPLIDO' } }); toast('Compromiso cumplido'); } catch (e) { toast(e.message); } });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => remove('COMPROMISOS', api.get('COMPROMISOS', b.dataset.del), 'el compromiso'));
  return form;
}

/* ------------------------------ Seguimiento (bitácora) ------------------------------ */
export function tracking(el, { user, project: p }) {
  const edit = can(user, 'proyectos.editar');
  const list = api.of('SEGUIMIENTO', p.ID_PROYECTO).sort((a, b) => String(b.FECHA).localeCompare(String(a.FECHA)));
  const cmp = api.of('COMPROMISOS', p.ID_PROYECTO);
  const spi = Number(p.SPI);
  const suggested = !p.SPI && p.SPI !== 0 ? 'VERDE' : spi >= 0.95 ? 'VERDE' : spi >= 0.85 ? 'AMARILLO' : 'ROJO';
  el.innerHTML = `<div class="panel"><div class="mt-panel-head"><div><h3>Registro de seguimiento</h3><div class="metric-note">Reuniones, comités e informes de avance. Cada registro guarda una foto del avance real y planificado de ese día.</div></div>${edit ? '<button class="btn btn-primary btn-sm" data-new>+ Registro</button>' : ''}</div>
    ${list.length ? `<ol class="pg-log">${list.map(s => {
      const cs = cmp.filter(c => c.ID_SEGUIMIENTO === s.ID_SEGUIMIENTO);
      return `<li class="pg-log-${(SALUD[s.SALUD]?.[0]) || 'x'}"><div class="pg-log-head"><b>${esc(fmtD(s.FECHA))} · ${esc(s.TITULO)}</b> ${saludBadge(s.SALUD)} <span class="muted">${esc(label('SEGUIMIENTO', s.TIPO))}</span>
        ${s.AVANCE_REAL !== '' && s.AVANCE_REAL !== undefined ? `<span class="metric-note">Avance real ${fmtNumber(s.AVANCE_REAL, 1)}% · plan ${fmtNumber(s.AVANCE_PLAN, 1)}%</span>` : ''}
        ${edit ? `<span class="toolbar mt-row-actions"><button class="btn btn-secondary btn-sm" data-cmp="${esc(s.ID_SEGUIMIENTO)}">+ Compromiso</button><button class="btn btn-secondary btn-sm" data-edit="${esc(s.ID_SEGUIMIENTO)}">Editar</button></span>` : ''}</div>
        <p>${esc(s.RESUMEN)}</p>${s.DECISIONES ? `<p><b>Decisiones:</b> ${esc(s.DECISIONES)}</p>` : ''}${s.ASISTENTES ? `<p class="metric-note">Asistentes: ${esc(s.ASISTENTES)}</p>` : ''}
        ${cs.length ? `<ul class="pg-log-cmp">${cs.map(c => `<li>${badge(c.ESTADO === 'CUMPLIDO' ? 'CERRADO' : 'ABIERTO', label('COMPROMISO', c.ESTADO))} ${esc(c.DESCRIPCION)} — <b>${esc(c.RESPONSABLE)}</b>, ${esc(fmtD(c.FECHA_COMPROMISO))}${overdue(c) ? ' <span class="status bad">vencido</span>' : ''}</li>`).join('')}</ul>` : ''}</li>`;
    }).join('')}</ol>` : emptyState({ icon: '🗒', title: 'Sin registros de seguimiento', text: 'Documente cada reunión o informe: resumen, decisiones, semáforo y compromisos.' })}</div>`;
  const form = item => openForm({
    title: item ? 'Editar registro' : 'Nuevo registro de seguimiento', form: TRACKING_FORM, editing: !!item, width: 'wide',
    values: item || { FECHA: hoy(), TIPO: 'REUNION', SALUD: suggested },
    preview: () => `Avance actual del proyecto: <b>${fmtNumber(p.AVANCE_PCT || 0, 1)}%</b> real vs <b>${fmtNumber(p.AVANCE_PLAN_PCT || 0, 1)}%</b> planificado${p.SPI !== '' && p.SPI !== undefined ? ` · SPI ${fmtNumber(p.SPI, 2)}` : ''}. Semáforo sugerido: ${saludBadge(suggested)}`,
    onSubmit: d => save('SEGUIMIENTO', item, item ? d : { ...d, ID_PROYECTO: p.ID_PROYECTO }, user, 'Registro guardado')
  });
  el.querySelector('[data-new]')?.addEventListener('click', () => form(null));
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => form(api.get('SEGUIMIENTO', b.dataset.edit)));
  el.querySelectorAll('[data-cmp]').forEach(b => b.onclick = () => openForm({
    title: 'Compromiso de la reunión', form: COMMITMENT_FORM, values: { ESTADO: 'ABIERTO', ID_SEGUIMIENTO: b.dataset.cmp },
    optionsFor: { ID_SEGUIMIENTO: () => api.of('SEGUIMIENTO', p.ID_PROYECTO).map(s => ({ value: s.ID_SEGUIMIENTO, label: `${fmtD(s.FECHA)} · ${s.TITULO}` })), ID_ACTIVIDAD: () => { const r = schedule(p); return r.orden.map(id => ({ value: id, label: `${r.actividades[id].EDT} · ${r.byId[id].NOMBRE}` })); } },
    onSubmit: d => save('COMPROMISOS', null, { ...d, ID_PROYECTO: p.ID_PROYECTO }, user, 'Compromiso registrado')
  }));
}

/* ------------------------------ Riesgos ------------------------------ */
const nivel = n => (n >= 15 ? ['bad', 'Alto'] : n >= 8 ? ['warn', 'Medio'] : ['good', 'Bajo']);
export function risks(el, { user, project: p }) {
  const edit = can(user, 'proyectos.editar');
  const list = api.of('RIESGOS', p.ID_PROYECTO).sort((a, b) => Number(b.NIVEL) - Number(a.NIVEL));
  const open = list.filter(x => x.ESTADO !== 'CERRADO');
  const cell = (pr, im) => open.filter(x => Number(x.PROBABILIDAD) === pr && Number(x.IMPACTO) === im).length;
  el.innerHTML = `<div class="grid2"><section class="panel"><h3>Matriz de probabilidad e impacto</h3><div class="pg-matrix"><div class="pg-axis-y">Probabilidad →</div><table>${[5, 4, 3, 2, 1].map(pr => `<tr><th>${pr}</th>${[1, 2, 3, 4, 5].map(im => { const n = cell(pr, im); return `<td class="pg-m-${nivel(pr * im)[0]}">${n || ''}</td>`; }).join('')}</tr>`).join('')}<tr><th></th>${[1, 2, 3, 4, 5].map(i => `<th>${i}</th>`).join('')}</tr></table><div class="pg-axis-x">Impacto →</div></div><p class="metric-note">Riesgos abiertos o en tratamiento. Nivel = probabilidad × impacto (alto ≥ 15, medio ≥ 8).</p></section>
    <section class="panel"><div class="mt-panel-head"><h3>Registro de riesgos</h3>${edit ? '<button class="btn btn-primary btn-sm" data-new>+ Riesgo</button>' : ''}</div>
    ${dataTable(list, [
      { label: 'Nivel', html: x => `<span class="status ${nivel(x.NIVEL)[0]}">${esc(x.NIVEL)} · ${nivel(x.NIVEL)[1]}</span>` },
      { label: 'Riesgo', html: x => `<b>${esc(x.DESCRIPCION)}</b><div class="metric-note">${esc(label('CATEGORIA', x.CATEGORIA))} · P${esc(x.PROBABILIDAD)} × I${esc(x.IMPACTO)}</div>` },
      { label: 'Respuesta', html: x => `${esc(label('ESTRATEGIA', x.ESTRATEGIA))}${x.RESPUESTA ? `<div class="metric-note">${esc(x.RESPUESTA)}</div>` : ''}` },
      { label: 'Responsable', key: 'RESPONSABLE' }, { label: 'Estado', html: x => esc(label('ESTADO_RIESGO', x.ESTADO)) },
      { label: '', html: x => edit ? `<div class="toolbar mt-row-actions"><button class="btn btn-secondary btn-sm" data-edit="${esc(x.ID_RIESGO)}">Editar</button><button class="btn btn-secondary btn-sm" data-del="${esc(x.ID_RIESGO)}">Eliminar</button></div>` : '' }
    ], { empty: 'Sin riesgos identificados' })}</section></div>`;
  const form = item => openForm({
    title: item ? 'Editar riesgo' : 'Nuevo riesgo', form: RISK_FORM, editing: !!item, width: 'wide',
    values: item ? { ...item, PROBABILIDAD: String(item.PROBABILIDAD), IMPACTO: String(item.IMPACTO) } : { ESTADO: 'ABIERTO', ESTRATEGIA: 'MITIGAR', CATEGORIA: 'CRONOGRAMA' },
    preview: v => { const n = Number(v.PROBABILIDAD) * Number(v.IMPACTO); return n ? `Nivel calculado: <span class="status ${nivel(n)[0]}">${n} · ${nivel(n)[1]}</span>` : ''; },
    onSubmit: d => save('RIESGOS', item, item ? d : { ...d, ID_PROYECTO: p.ID_PROYECTO }, user, 'Riesgo guardado')
  });
  el.querySelector('[data-new]')?.addEventListener('click', () => form(null));
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => form(api.get('RIESGOS', b.dataset.edit)));
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => remove('RIESGOS', api.get('RIESGOS', b.dataset.del), 'el riesgo'));
}

/* ------------------------------ Interesados ------------------------------ */
const ESTR = { GESTIONAR_DE_CERCA: 'Gestionar de cerca', MANTENER_SATISFECHO: 'Mantener satisfecho', MANTENER_INFORMADO: 'Mantener informado', MONITOREAR: 'Monitorear' };
export function stakeholders(el, { user, project: p }) {
  const edit = can(user, 'proyectos.editar');
  const list = api.of('INTERESADOS', p.ID_PROYECTO);
  const q = k => list.filter(x => x.ESTRATEGIA === k).map(x => `<span class="mt-chip">${esc(x.NOMBRE)}</span>`).join(' ') || '<span class="muted">—</span>';
  el.innerHTML = `<div class="grid2"><section class="panel"><h3>Matriz poder / interés</h3><div class="pg-pi">
      <div class="pg-pi-q hi"><b>Mantener satisfecho</b><small>Poder alto · interés bajo</small>${q('MANTENER_SATISFECHO')}</div>
      <div class="pg-pi-q crit"><b>Gestionar de cerca</b><small>Poder alto · interés alto</small>${q('GESTIONAR_DE_CERCA')}</div>
      <div class="pg-pi-q"><b>Monitorear</b><small>Poder bajo · interés bajo</small>${q('MONITOREAR')}</div>
      <div class="pg-pi-q info"><b>Mantener informado</b><small>Poder bajo · interés alto</small>${q('MANTENER_INFORMADO')}</div>
    </div></section>
    <section class="panel"><div class="mt-panel-head"><h3>Registro de interesados</h3>${edit ? '<button class="btn btn-primary btn-sm" data-new>+ Interesado</button>' : ''}</div>
    ${dataTable(list, [
      { label: 'Nombre', html: x => `<b>${esc(x.NOMBRE)}</b><div class="metric-note">${esc([x.ROL, x.ORGANIZACION].filter(Boolean).join(' · '))}</div>` },
      { label: 'Contacto', key: 'CONTACTO' }, { label: 'Poder / interés', html: x => esc(`${label('NIVEL3', x.PODER)} / ${label('NIVEL3', x.INTERES)}`) },
      { label: 'Estrategia', html: x => esc(ESTR[x.ESTRATEGIA] || x.ESTRATEGIA) },
      { label: '', html: x => edit ? `<div class="toolbar mt-row-actions"><button class="btn btn-secondary btn-sm" data-edit="${esc(x.ID_INTERESADO)}">Editar</button><button class="btn btn-secondary btn-sm" data-del="${esc(x.ID_INTERESADO)}">Eliminar</button></div>` : '' }
    ], { empty: 'Sin interesados registrados' })}</section></div>`;
  const form = item => openForm({ title: item ? 'Editar interesado' : 'Nuevo interesado', form: STAKEHOLDER_FORM, editing: !!item, values: item || { PODER: 'MEDIO', INTERES: 'MEDIO' }, onSubmit: d => save('INTERESADOS', item, item ? d : { ...d, ID_PROYECTO: p.ID_PROYECTO }, user, 'Interesado guardado') });
  el.querySelector('[data-new]')?.addEventListener('click', () => form(null));
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => form(api.get('INTERESADOS', b.dataset.edit)));
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => remove('INTERESADOS', api.get('INTERESADOS', b.dataset.del), 'el interesado'));
}

/* ------------------------------ Control de cambios ------------------------------ */
export function changes(el, { user, project: p }) {
  const edit = can(user, 'proyectos.editar'), approve = can(user, 'proyectos.cambios.aprobar');
  const list = api.of('CAMBIOS', p.ID_PROYECTO).sort((a, b) => String(b.FECHA_SOLICITUD).localeCompare(String(a.FECHA_SOLICITUD)));
  el.innerHTML = `<div class="panel"><div class="mt-panel-head"><div><h3>Control integrado de cambios</h3><div class="metric-note">Toda modificación de alcance, tiempo o costo se solicita, se evalúa y la aprueba quien tiene el permiso. Después de aprobar, actualice el cronograma y, si corresponde, fije una nueva línea base.</div></div>${edit ? '<button class="btn btn-primary btn-sm" data-new>+ Solicitud</button>' : ''}</div>
    ${dataTable(list, [
      { label: 'Fecha', html: x => esc(fmtD(x.FECHA_SOLICITUD)) },
      { label: 'Cambio', html: x => `<b>${esc(x.DESCRIPCION)}</b><div class="metric-note">Solicita: ${esc(x.SOLICITANTE)}${x.JUSTIFICACION ? ' · ' + esc(x.JUSTIFICACION) : ''}</div>` },
      { label: 'Impacto', html: x => esc([x.IMPACTO_DIAS !== '' && x.IMPACTO_DIAS !== undefined ? `${x.IMPACTO_DIAS > 0 ? '+' : ''}${x.IMPACTO_DIAS} d` : '', x.IMPACTO_COSTO ? fmtMoney(x.IMPACTO_COSTO) : '', x.IMPACTO_ALCANCE || ''].filter(Boolean).join(' · ') || '—') },
      { label: 'Estado', html: x => badge(x.ESTADO === 'APROBADO' || x.ESTADO === 'IMPLEMENTADO' ? 'CERRADO' : x.ESTADO === 'RECHAZADO' ? 'ANULADO' : 'ABIERTO', label('CAMBIO', x.ESTADO)) + (x.DECISION_POR ? `<div class="metric-note">${esc(x.DECISION_POR)} · ${esc(String(x.FECHA_DECISION).slice(0, 16))}</div>` : '') },
      { label: '', html: x => `<div class="toolbar mt-row-actions">${approve && x.ESTADO === 'SOLICITADO' ? `<button class="btn btn-secondary btn-sm" data-st="APROBADO" data-id="${esc(x.ID_CAMBIO)}">Aprobar</button><button class="btn btn-secondary btn-sm" data-st="RECHAZADO" data-id="${esc(x.ID_CAMBIO)}">Rechazar</button>` : ''}${edit && x.ESTADO === 'APROBADO' ? `<button class="btn btn-secondary btn-sm" data-st="IMPLEMENTADO" data-id="${esc(x.ID_CAMBIO)}">Implementado</button>` : ''}${edit && x.ESTADO === 'SOLICITADO' ? `<button class="btn btn-secondary btn-sm" data-edit="${esc(x.ID_CAMBIO)}">Editar</button>` : ''}</div>` }
    ], { empty: 'Sin solicitudes de cambio' })}</div>`;
  const form = item => openForm({ title: item ? 'Editar solicitud' : 'Nueva solicitud de cambio', form: CHANGE_FORM, editing: !!item, width: 'wide', values: item || { FECHA_SOLICITUD: hoy(), ESTADO: 'SOLICITADO', SOLICITANTE: user?.name || '' }, hidden: n => n === 'ESTADO' && !item, onSubmit: d => save('CAMBIOS', item, item ? d : { ...d, ESTADO: 'SOLICITADO', ID_PROYECTO: p.ID_PROYECTO }, user, 'Solicitud guardada') });
  el.querySelector('[data-new]')?.addEventListener('click', () => form(null));
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => form(api.get('CAMBIOS', b.dataset.edit)));
  el.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => {
    if (!await confirmDialog(`¿Marcar la solicitud como ${label('CAMBIO', b.dataset.st).toLowerCase()}?`)) return;
    try { await api.write('actualizar', 'CAMBIOS', { id: b.dataset.id, datos: { ESTADO: b.dataset.st } }); toast('Solicitud actualizada'); } catch (e) { toast(e.message); }
  });
}

/* ------------------------------ Lecciones aprendidas ------------------------------ */
export function lessons(el, { user, project: p }) {
  const edit = can(user, 'proyectos.editar');
  const list = api.of('LECCIONES', p.ID_PROYECTO).sort((a, b) => String(b.FECHA).localeCompare(String(a.FECHA)));
  el.innerHTML = `<div class="panel"><div class="mt-panel-head"><div><h3>Lecciones aprendidas</h3><div class="metric-note">Regístrelas durante todo el proyecto, no solo al cierre. Son la base de conocimiento para los siguientes proyectos.</div></div>${edit ? '<button class="btn btn-primary btn-sm" data-new>+ Lección</button>' : ''}</div>
    ${dataTable(list, [
      { label: 'Fecha', html: x => esc(fmtD(x.FECHA)) }, { label: 'Categoría', html: x => esc(label('CATEGORIA', x.CATEGORIA)) },
      { label: 'Situación', key: 'SITUACION' }, { label: 'Lección', html: x => `<b>${esc(x.LECCION)}</b>` }, { label: 'Recomendación', key: 'RECOMENDACION' },
      { label: '', html: x => edit ? `<button class="btn btn-secondary btn-sm" data-edit="${esc(x.ID_LECCION)}">Editar</button>` : '' }
    ], { empty: 'Sin lecciones registradas' })}</div>`;
  const form = item => openForm({ title: item ? 'Editar lección' : 'Nueva lección aprendida', form: LESSON_FORM, editing: !!item, width: 'wide', values: item || { FECHA: hoy(), CATEGORIA: 'CRONOGRAMA' }, onSubmit: d => save('LECCIONES', item, item ? d : { ...d, ID_PROYECTO: p.ID_PROYECTO }, user, 'Lección guardada') });
  el.querySelector('[data-new]')?.addEventListener('click', () => form(null));
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => form(api.get('LECCIONES', b.dataset.edit)));
}

export { L };
