// Módulo PROYECTOS: portafolio (mejora continua interna / externos de otras líneas de negocio) y detalle
// de cada proyecto con estructura PMBOK. Rutas: #/proyectos · #/proyectos/<ID>/<pestaña> · #/proyectos/configuracion
import * as api from '../api.js';
import { PROJECT_FORM, CATALOG_FORM, L, label } from '../schema.js';
import { programarProyecto, crDia_, crTexto_ } from '../schedule.js';
import * as gantt from './gantt.js';
import * as T from './tracking.js';
import { esc, kpi, emptyState, dataTable, badge, confirmDialog, fmtNumber, fmtMoney, tabs } from '../../maintenance/ui/components.js';
import { openForm } from '../../maintenance/ui/form.js';
import { lineChart } from '../../maintenance/ui/charts.js';
import { can } from '../../permissions.js';
import { toast } from '../../ui.js';

const TABS = [['resumen', 'Resumen'], ['cronograma', 'Cronograma (Gantt)'], ['entregables', 'Entregables'], ['compromisos', 'Compromisos'], ['seguimiento', 'Seguimiento'], ['riesgos', 'Riesgos'], ['interesados', 'Interesados'], ['cambios', 'Cambios'], ['lecciones', 'Lecciones']];
const VIEWS = { cronograma: gantt.render, entregables: T.deliverables, compromisos: T.commitments, seguimiento: T.tracking, riesgos: T.risks, interesados: T.stakeholders, cambios: T.changes, lecciones: T.lessons };
const filters = { tipo: '', estado: 'VIGENTES', q: '', eliminados: false };
let ctx = null, listening = false;

export function renderProjects(context) {
  ctx = context;
  if (!listening) { listening = true; window.addEventListener('sodiacero:pry', () => { if ((location.hash || '').startsWith('#/proyectos')) paint(); }); }
  paint();
  api.load();
}

const fmtD = t => { const d = String(t || '').slice(0, 10); return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—'; };
const spiCls = s => (s === '' || s === null || s === undefined ? 'mt-neutral' : Number(s) >= 0.95 ? 'good' : Number(s) >= 0.85 ? 'warn' : 'bad');
const tipoBadge = p => p.TIPO === 'EXTERNO' ? `<span class="pg-type ext">Externo · ${esc(lineaLabel(p.LINEA_NEGOCIO))}</span>` : '<span class="pg-type int">Mejora continua</span>';
const lineaLabel = code => api.rows('PRY_CATALOGOS').find(c => c.CATALOGO === 'LINEA_NEGOCIO' && String(c.CODIGO) === String(code))?.VALOR || code || '';
const lineas = () => api.rows('PRY_CATALOGOS').filter(c => c.CATALOGO === 'LINEA_NEGOCIO' && c.ESTADO_REGISTRO === 'ACTIVO').map(c => ({ value: String(c.CODIGO), label: c.VALOR }));

function paint() {
  const { content, user } = ctx;
  const st = api.getState();
  const [, , id, tab] = (location.hash || '').split('/');
  const scroll = window.scrollY;
  if (!st.ready) {
    content.innerHTML = `<div class="page-title"><div><h2>Proyectos</h2></div></div>` + (st.error
      ? `<div class="panel">${emptyState({ icon: '!', title: 'No se pudieron cargar los proyectos', text: `${esc(st.error)}<br><span class="metric-note">Verifique que el Apps Script tenga los archivos Proyectos.gs y Cronograma.gs y que se haya ejecutado "instalar".</span>`, action: '<button class="btn btn-primary" data-retry>Reintentar</button>' })}</div>`
      : '<div class="mt-loading"><span class="mt-spinner"></span> Cargando proyectos…</div>');
    content.querySelector('[data-retry]')?.addEventListener('click', () => api.load(true));
    return;
  }
  if (id === 'configuracion') renderSettings(content, user);
  else if (id) renderProject(content, user, decodeURIComponent(id), tab || 'resumen');
  else renderPortfolio(content, user);
  window.scrollTo(0, scroll);
}

function syncChip() {
  const st = api.getState();
  return `<button class="mt-sync ${st.loading ? 'mt-sync-busy' : st.error ? 'mt-sync-warn' : 'mt-sync-ok'}" data-refresh>⟳ ${st.loading ? 'Sincronizando…' : 'Google Sheets'}</button>`;
}

/* ------------------------------ Portafolio ------------------------------ */
function renderPortfolio(el, user) {
  const all = api.rows('PROYECTOS');
  const vis = all.filter(p => filters.eliminados ? p.ESTADO_REGISTRO === 'ANULADO' : p.ESTADO_REGISTRO !== 'ANULADO');
  const vigente = p => !['CERRADO', 'CANCELADO'].includes(p.ESTADO);
  const q = filters.q.toLowerCase();
  const list = vis.filter(p => (!filters.tipo || p.TIPO === filters.tipo) && (filters.estado === 'VIGENTES' ? vigente(p) : !filters.estado || p.ESTADO === filters.estado) &&
    (!q || `${p.CODIGO} ${p.NOMBRE} ${p.DIRECTOR} ${p.CLIENTE} ${p.AREA_PROCESO}`.toLowerCase().includes(q)))
    .sort((a, b) => ({ ALTA: 0, MEDIA: 1, BAJA: 2 }[a.PRIORIDAD] - { ALTA: 0, MEDIA: 1, BAJA: 2 }[b.PRIORIDAD]) || String(a.CODIGO).localeCompare(String(b.CODIGO)));
  const activos = all.filter(p => p.ESTADO_REGISTRO !== 'ANULADO' && vigente(p));
  const venc = api.rows('COMPROMISOS').filter(c => api.live(c) && T.overdue(c) && activos.some(p => p.ID_PROYECTO === c.ID_PROYECTO)).length;
  el.innerHTML = `<div class="page-title"><div><h2>Proyectos</h2><div class="muted">Mejora continua interna y proyectos externos de otras líneas de negocio · gestión basada en PMBOK</div></div>
    <div class="toolbar mt-head-actions">${syncChip()}${can(user, 'proyectos.configurar') || can(user, 'proyectos.ver') ? '<a class="btn btn-secondary" href="#/proyectos/configuracion">Calendario y líneas</a>' : ''}${can(user, 'proyectos.crear') ? '<button class="btn btn-primary" data-new>+ Proyecto</button>' : ''}</div></div>
    <section class="cards">
      ${kpi('Proyectos vigentes', esc(activos.length), `${activos.filter(p => p.TIPO === 'MEJORA_INTERNA').length} mejora continua · ${activos.filter(p => p.TIPO === 'EXTERNO').length} externos`)}
      ${kpi('En ejecución', esc(activos.filter(p => p.ESTADO === 'EN_EJECUCION').length))}
      ${kpi('Atrasados (SPI < 0,95)', esc(activos.filter(p => p.SPI !== '' && Number(p.SPI) < 0.95).length))}
      ${kpi('Compromisos vencidos', esc(venc))}
    </section>
    <div class="panel mt-filters"><div class="toolbar">
      <input type="search" data-f="q" placeholder="Buscar código, nombre, director, cliente…" value="${esc(filters.q)}" aria-label="Buscar">
      <select data-f="tipo" aria-label="Tipo"><option value="">Todos los tipos</option>${L.TIPO.map(o => `<option value="${o.value}" ${o.value === filters.tipo ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
      <select data-f="estado" aria-label="Estado"><option value="VIGENTES" ${filters.estado === 'VIGENTES' ? 'selected' : ''}>Vigentes</option><option value="" ${filters.estado === '' ? 'selected' : ''}>Todos los estados</option>${L.ESTADO.map(o => `<option value="${o.value}" ${o.value === filters.estado ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
      <label class="mt-check"><input type="checkbox" data-del ${filters.eliminados ? 'checked' : ''}> Ver eliminados</label>
    </div></div>
    ${list.length ? `<div class="pg-cards">${list.map(card).join('')}</div>` : `<div class="panel">${emptyState({ icon: '🗂', title: all.length ? 'Ningún proyecto coincide con los filtros' : 'Aún no hay proyectos', text: all.length ? '' : 'Cree el primer proyecto con su acta de constitución: objetivo, alcance, director, fechas e indicador. Luego construya el cronograma (EDT) en el diagrama de Gantt.', action: !all.length && can(user, 'proyectos.crear') ? '<button class="btn btn-primary" data-new>+ Proyecto</button>' : '' })}</div>`}`;
  el.querySelectorAll('[data-new]').forEach(b => b.onclick = () => projectForm(user));
  el.querySelector('[data-refresh]')?.addEventListener('click', () => api.load(true));
  el.querySelectorAll('[data-f]').forEach(i => i.addEventListener(i.type === 'search' ? 'input' : 'change', () => {
    filters[i.dataset.f] = i.value;
    if (i.type !== 'search') return paint();
    const pos = i.selectionStart; paint(); const n = el.querySelector('[data-f="q"]'); n.focus(); n.setSelectionRange(pos, pos);
  }));
  el.querySelector('[data-del]').onchange = e => { filters.eliminados = e.target.checked; paint(); };
  el.querySelectorAll('[data-open]').forEach(c => { c.onclick = () => location.hash = `#/proyectos/${c.dataset.open}/resumen`; c.onkeydown = e => { if (e.key === 'Enter') c.click(); }; });
}

function card(p) {
  const real = Number(p.AVANCE_PCT) || 0, plan = Number(p.AVANCE_PLAN_PCT) || 0;
  const salud = api.of('SEGUIMIENTO', p.ID_PROYECTO).sort((a, b) => String(b.FECHA).localeCompare(String(a.FECHA)))[0]?.SALUD;
  const venc = api.of('COMPROMISOS', p.ID_PROYECTO).filter(T.overdue).length;
  const desvio = p.FECHA_FIN_OBJETIVO && p.FECHA_FIN_PLAN ? crDia_(String(p.FECHA_FIN_PLAN).slice(0, 10)) - crDia_(String(p.FECHA_FIN_OBJETIVO).slice(0, 10)) : null;
  return `<article class="card pg-card ${p.ESTADO_REGISTRO === 'ANULADO' ? 'pg-voided' : ''}" tabindex="0" role="link" data-open="${esc(p.ID_PROYECTO)}">
    <div class="pg-card-top"><span class="label">${esc(p.CODIGO)} · ${esc(label('ESTADO', p.ESTADO))}</span>${tipoBadge(p)}</div>
    <h3>${esc(p.NOMBRE)}</h3>
    <div class="pg-progress" title="Avance real ${fmtNumber(real, 1)}% · planificado ${fmtNumber(plan, 1)}%"><span style="width:${Math.min(100, real)}%"></span><i style="left:${Math.min(100, plan)}%"></i></div>
    <p><b>${fmtNumber(real, 0)}%</b> real · ${fmtNumber(plan, 0)}% plan <span class="status ${spiCls(p.SPI)}">SPI ${p.SPI !== '' && p.SPI !== undefined ? fmtNumber(p.SPI, 2) : '—'}</span> ${T.saludBadge(salud)}</p>
    <p class="metric-note">Director: ${esc(p.DIRECTOR)} · ${esc(label('FASE', p.FASE))}<br>${esc(fmtD(p.FECHA_INICIO_PLAN || p.FECHA_INICIO))} → ${esc(fmtD(p.FECHA_FIN_PLAN))}${desvio ? ` <span class="status ${desvio > 0 ? 'bad' : 'good'}">${desvio > 0 ? '+' : ''}${desvio} d vs objetivo</span>` : ''}</p>
    ${p.KPI ? `<p class="metric-note">KPI: ${esc(p.KPI)}${p.LINEA_BASE_KPI !== '' ? ` · línea base ${esc(p.LINEA_BASE_KPI)} → meta ${esc(p.META_KPI)} ${esc(p.UNIDAD_KPI || '')}` : ''}</p>` : ''}
    ${venc ? `<p><span class="status bad">${venc} compromiso(s) vencido(s)</span></p>` : ''}
  </article>`;
}

/* ------------------------------ Detalle ------------------------------ */
function renderProject(el, user, id, tab) {
  const p = api.get('PROYECTOS', id);
  if (!p) { el.innerHTML = emptyState({ icon: '?', title: 'Proyecto no encontrado', action: '<a class="btn btn-secondary" href="#/proyectos">Volver</a>' }); return; }
  if (!TABS.some(t => t[0] === tab)) tab = 'resumen';
  const voided = p.ESTADO_REGISTRO === 'ANULADO';
  const cnt = { compromisos: api.of('COMPROMISOS', id).filter(T.overdue).length, riesgos: api.of('RIESGOS', id).filter(r => Number(r.NIVEL) >= 15 && r.ESTADO !== 'CERRADO').length, cambios: api.of('CAMBIOS', id).filter(c => c.ESTADO === 'SOLICITADO').length };
  el.innerHTML = `<div class="mt-breadcrumb"><a href="#/proyectos">Proyectos</a> › ${esc(p.CODIGO)}</div>
    <div class="page-title"><div><h2><span class="mt-code-lg">${esc(p.CODIGO)}</span> ${esc(p.NOMBRE)}</h2>
      <div class="pg-badges">${tipoBadge(p)} ${badge(p.ESTADO === 'EN_EJECUCION' ? 'ACTIVO' : 'ABIERTO', label('ESTADO', p.ESTADO))} <span class="status mt-neutral">${esc(label('FASE', p.FASE))}</span> <span class="status mt-neutral">Prioridad ${esc(label('PRIORIDAD', p.PRIORIDAD).toLowerCase())}</span>${voided ? ' ' + badge('ANULADO', 'ELIMINADO') : ''}${p.LB_FECHA ? ` <span class="status good" title="Fijada por ${esc(p.LB_POR || '')}">Línea base ${esc(String(p.LB_FECHA).slice(0, 10))}</span>` : ' <span class="status warn">Sin línea base</span>'}</div></div>
      <div class="toolbar mt-head-actions">${syncChip()}${voided ? '' : `${can(user, 'proyectos.editar') ? '<button class="btn btn-secondary" data-edit>Editar acta</button>' : ''}${can(user, 'proyectos.lineabase') ? `<button class="btn btn-secondary" data-lb>${p.LB_FECHA ? 'Actualizar línea base' : 'Fijar línea base'}</button>` : ''}${can(user, 'proyectos.eliminar') ? '<button class="btn btn-danger" data-delp>Eliminar</button>' : ''}`}</div></div>
    ${tabs(TABS.map(([k, l]) => [k, l, cnt[k] ? String(cnt[k]) : '']), tab, `#/proyectos/${encodeURIComponent(id)}/`)}
    <div data-body></div>`;
  const body = el.querySelector('[data-body]');
  if (tab === 'resumen') summary(body, user, p); else VIEWS[tab](body, { user, project: p });
  el.querySelector('[data-refresh]')?.addEventListener('click', () => api.load(true));
  el.querySelector('[data-edit]')?.addEventListener('click', () => projectForm(user, p));
  el.querySelector('[data-lb]')?.addEventListener('click', async () => {
    const ans = await confirmDialog(p.LB_FECHA ? 'Se reemplazará la línea base actual por las fechas programadas hoy. Indique el motivo (por ejemplo, el cambio aprobado).' : 'Se congelarán las fechas y duraciones actuales como línea base. Desde ese momento el avance planificado y las desviaciones se miden contra ella.', { okLabel: 'Fijar línea base', requireReason: !!p.LB_FECHA });
    if (!ans) return;
    try { const r = await api.baseline(p.ID_PROYECTO, typeof ans === 'string' ? ans : ''); toast(`Línea base fijada (${r.actividades} actividades)`); } catch (e) { toast(e.message); }
  });
  el.querySelector('[data-delp]')?.addEventListener('click', async () => {
    const ans = await confirmDialog(`¿Eliminar el proyecto ${p.CODIGO}? Dejará de aparecer en el portafolio (se podrá consultar en "Ver eliminados") y el motivo queda en la auditoría.`, { danger: true, okLabel: 'Eliminar proyecto', requireReason: true });
    if (!ans) return;
    try { await api.write('estado', 'PROYECTOS', { id: p.ID_PROYECTO, estado: 'ANULADO', motivo: ans }); toast('Proyecto eliminado'); location.hash = '#/proyectos'; } catch (e) { toast(e.message); }
  });
}

function summary(el, user, p) {
  const r = gantt.schedule(p);
  const acts = r.orden.map(id => r.actividades[id]).filter(x => x.ES_RESUMEN === 'NO');
  const crit = acts.filter(x => x.CRITICA === 'SI').length, late = acts.filter(x => x.ESTADO_CALC === 'ATRASADA').length;
  const cmp = api.of('COMPROMISOS', p.ID_PROYECTO), risks = api.of('RIESGOS', p.ID_PROYECTO).filter(x => x.ESTADO !== 'CERRADO');
  const lastSeg = api.of('SEGUIMIENTO', p.ID_PROYECTO).sort((a, b) => String(b.FECHA).localeCompare(String(a.FECHA)))[0];
  const pr = r.proyecto;
  const dObj = p.FECHA_FIN_OBJETIVO ? crDia_(pr.FECHA_FIN_PLAN) - crDia_(String(p.FECHA_FIN_OBJETIVO).slice(0, 10)) : null;
  const dLB = p.LB_FIN ? crDia_(pr.FECHA_FIN_PLAN) - crDia_(String(p.LB_FIN).slice(0, 10)) : null;
  const nd = '<span class="mt-nd">N/D</span>';
  const field = (l, v) => v ? `<div><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>` : '';
  el.innerHTML = `<section class="mt-kpis">
      ${kpi('Avance real', esc(fmtNumber(pr.AVANCE_PCT, 1) + ' %'), 'Ponderado por duración')}
      ${kpi('Avance planificado', esc(fmtNumber(pr.AVANCE_PLAN_PCT, 1) + ' %'), p.LB_FECHA ? 'Contra la línea base' : 'Contra el cronograma actual')}
      ${kpi('SPI (cronograma)', pr.SPI === null ? nd : `<span class="${'mt-txt-' + spiCls(pr.SPI)}">${fmtNumber(pr.SPI, 2)}</span>`, pr.BAC ? 'EV / PV' : 'Avance real / planificado')}
      ${kpi('CPI (costo)', pr.CPI === null ? nd : `<span class="${'mt-txt-' + spiCls(pr.CPI)}">${fmtNumber(pr.CPI, 2)}</span>`, pr.AC ? 'EV / AC' : 'Registre costos reales')}
      ${kpi('Fin planificado', esc(fmtD(pr.FECHA_FIN_PLAN)), dObj !== null ? `${dObj > 0 ? '+' : ''}${dObj} días vs fecha objetivo` : 'Sin fecha objetivo')}
      ${kpi('Variación vs línea base', dLB === null ? nd : `<span class="mt-txt-${dLB > 0 ? 'bad' : 'good'}">${dLB > 0 ? '+' : ''}${dLB} d</span>`, p.LB_FIN ? 'Fin línea base: ' + fmtD(p.LB_FIN) : 'Fije la línea base')}
      ${kpi('Duración', esc(pr.DURACION_DIAS + ' días hábiles'), `${acts.length} actividades · ${crit} críticas`)}
      ${kpi('Actividades atrasadas', `<span class="${late ? 'mt-txt-bad' : ''}">${late}</span>`)}
      ${kpi('Compromisos', esc(`${cmp.filter(c => c.ESTADO === 'ABIERTO').length} abiertos`), `${cmp.filter(T.overdue).length} vencidos · ${cmp.filter(c => c.ESTADO === 'CUMPLIDO').length} cumplidos`)}
      ${kpi('Riesgos abiertos', esc(risks.length), `${risks.filter(x => Number(x.NIVEL) >= 15).length} de nivel alto`)}
      ${kpi('Presupuesto (BAC)', esc(fmtMoney(pr.BAC || Number(p.PRESUPUESTO) || 0)), pr.AC ? 'Costo real: ' + fmtMoney(pr.AC) : '')}
      ${kpi('Último seguimiento', lastSeg ? T.saludBadge(lastSeg.SALUD) : nd, lastSeg ? fmtD(lastSeg.FECHA) + ' · ' + lastSeg.TITULO : 'Sin registros')}
    </section>
    <div class="grid2">
      <section class="panel"><h3>Curva S · avance planificado vs real</h3>${sCurve(p, r)}</section>
      <section class="panel"><h3>Acta de constitución</h3><dl class="mt-dl pg-charter">
        ${field('Objetivo', p.OBJETIVO)}${field('Justificación', p.JUSTIFICACION)}${field('Alcance', p.ALCANCE)}${field('Fuera de alcance', p.FUERA_ALCANCE)}
        ${field('Supuestos', p.SUPUESTOS)}${field('Restricciones', p.RESTRICCIONES)}${field('Criterios de éxito', p.CRITERIOS_EXITO)}
        ${field('Director', p.DIRECTOR)}${field('Patrocinador', p.PATROCINADOR)}${field(p.TIPO === 'EXTERNO' ? 'Línea de negocio' : 'Área / proceso', p.TIPO === 'EXTERNO' ? lineaLabel(p.LINEA_NEGOCIO) : p.AREA_PROCESO)}${field('Cliente / beneficiario', p.CLIENTE)}
        ${field('KPI', p.KPI ? `${p.KPI}: ${p.LINEA_BASE_KPI} → ${p.META_KPI} ${p.UNIDAD_KPI || ''}` : '')}${field('Beneficio esperado', p.BENEFICIO_ESPERADO ? fmtMoney(p.BENEFICIO_ESPERADO) : '')}
        ${field('Inicio', fmtD(p.FECHA_INICIO))}${field('Fin objetivo', p.FECHA_FIN_OBJETIVO ? fmtD(p.FECHA_FIN_OBJETIVO) : '')}${field('Calendario', label('DIAS', p.DIAS_LABORABLES))}
      </dl></section>
    </div>
    <section class="panel"><h3>Próximas entregas y actividades críticas</h3>${dataTable(r.orden.map(id => ({ id, a: r.byId[id], c: r.actividades[id] })).filter(x => x.c.ES_RESUMEN === 'NO' && x.c.AVANCE_PCT < 100 && (x.c.CRITICA === 'SI' || x.a.ENTREGABLE)).sort((a, b) => String(a.c.FECHA_FIN).localeCompare(String(b.c.FECHA_FIN))).slice(0, 10), [
      { label: 'EDT', html: x => esc(x.c.EDT) }, { label: 'Actividad', html: x => `${esc(x.a.NOMBRE)}${x.a.ENTREGABLE ? `<div class="metric-note">Entregable: ${esc(x.a.ENTREGABLE)}</div>` : ''}` },
      { label: 'Responsable', html: x => esc(x.a.RESPONSABLE || '—') }, { label: 'Fin', html: x => esc(fmtD(x.c.FECHA_FIN)) },
      { label: 'Holgura', html: x => `<span class="status ${x.c.CRITICA === 'SI' ? 'bad' : 'good'}">${esc(x.c.HOLGURA_DIAS)} d</span>` },
      { label: 'Estado', html: x => esc({ COMPLETADA: 'Completada', ATRASADA: 'Atrasada', EN_CURSO: 'En curso', DEBIO_INICIAR: 'Debió iniciar', NO_INICIADA: 'No iniciada' }[x.c.ESTADO_CALC] || '') + ` · ${fmtNumber(x.c.AVANCE_PCT, 0)}%` }
    ], { empty: 'Sin actividades pendientes en ruta crítica ni entregables próximos' })}</section>`;
}

// Curva S: planificado acumulado (calculado con el cronograma o la línea base) vs avance real reportado
function sCurve(p, r) {
  const hoy = crDia_(api.getState().hoy);
  const ini = crDia_(r.proyecto.FECHA_INICIO_PLAN), fin = Math.max(crDia_(r.proyecto.FECHA_FIN_PLAN), Math.min(hoy, crDia_(r.proyecto.FECHA_FIN_PLAN) + 365));
  if (!r.orden.length || fin <= ini) return '<div class="mt-chart-empty">Construya el cronograma para ver la curva S</div>';
  const n = Math.min(24, Math.max(4, Math.ceil((fin - ini) / 7)));
  const fest = r.festivos;
  const acts = Object.values(r.byId).map(a => ({ ...a, INICIO_RESTRICCION: String(a.INICIO_RESTRICCION || '').slice(0, 10), FECHA_INICIO_REAL: String(a.FECHA_INICIO_REAL || '').slice(0, 10), FECHA_FIN_REAL: String(a.FECHA_FIN_REAL || '').slice(0, 10), LB_INICIO: String(a.LB_INICIO || '').slice(0, 10), LB_FIN: String(a.LB_FIN || '').slice(0, 10) }));
  const dates = Array.from({ length: n + 1 }, (_, i) => Math.round(ini + (fin - ini) * i / n));
  const plan = dates.map(d => programarProyecto({ FECHA_INICIO: String(p.FECHA_INICIO).slice(0, 10), DIAS_LABORABLES: p.DIAS_LABORABLES }, acts, fest, crTexto_(d)).proyecto.AVANCE_PLAN_PCT);
  const snaps = api.of('SEGUIMIENTO', p.ID_PROYECTO).filter(s => s.AVANCE_REAL !== '' && s.AVANCE_REAL !== undefined).map(s => [crDia_(String(s.FECHA).slice(0, 10)), Number(s.AVANCE_REAL)]);
  snaps.push([hoy, Number(r.proyecto.AVANCE_PCT)]);
  // Avance real: solo donde hay datos reportados (registros de seguimiento y el avance de hoy). Antes del primer reporte es desconocido.
  const first = Math.min(...snaps.map(s => s[0]));
  const real = dates.map((d, i) => { if (d > hoy) return null; if (i === 0) return 0; if (d < first) return null; const prev = snaps.filter(s => s[0] <= d).sort((a, b) => b[0] - a[0])[0]; return prev ? prev[1] : null; });
  if (hoy >= ini && hoy <= fin && !dates.includes(hoy)) { const k = dates.findIndex(d => d > hoy); if (k > 0) { dates.splice(k, 0, hoy); plan.splice(k, 0, programarProyecto({ FECHA_INICIO: String(p.FECHA_INICIO).slice(0, 10), DIAS_LABORABLES: p.DIAS_LABORABLES }, acts, fest, crTexto_(hoy)).proyecto.AVANCE_PLAN_PCT); real.splice(k, 0, Number(r.proyecto.AVANCE_PCT)); } }
  return lineChart(dates.map(crTexto_), [{ name: 'Planificado', color: '#1a5fd0', values: plan }, { name: 'Real (reportado)', color: '#d93025', values: real }], { unit: '%', digits: 0, labelFn: d => `${d.slice(8, 10)}/${d.slice(5, 7)}` }) +
    '<p class="metric-note">El avance real proviene de cada registro de seguimiento y del avance actual de las actividades; antes del primer reporte no se dibuja (dato desconocido).</p>';
}

/* ------------------------------ Formularios y configuración ------------------------------ */
function projectForm(user, p = null) {
  openForm({
    title: p ? `Editar acta · ${p.CODIGO}` : 'Nuevo proyecto · acta de constitución', form: PROJECT_FORM, editing: !!p, width: 'wide',
    values: p || { TIPO: 'MEJORA_INTERNA', PRIORIDAD: 'MEDIA', FASE: 'INICIO', ESTADO: 'PROPUESTO', DIAS_LABORABLES: 'L-V', FECHA_INICIO: api.getState().hoy, DIRECTOR: user?.name || '' },
    refreshOn: ['TIPO'],
    optionsFor: { LINEA_NEGOCIO: lineas },
    hidden: (name, v) => (name === 'LINEA_NEGOCIO' && v.TIPO !== 'EXTERNO') || (name === 'AREA_PROCESO' && v.TIPO === 'EXTERNO'),
    preview: v => v.TIPO === 'EXTERNO' ? '<b>Proyecto externo:</b> para otra línea de negocio; indique la línea y el cliente o unidad beneficiaria.' : '<b>Mejora continua interna:</b> indique el área o proceso de la organización y el KPI que se busca mejorar.',
    submitLabel: p ? 'Guardar' : 'Crear proyecto',
    onSubmit: async d => {
      const r = p ? await api.write('actualizar', 'PROYECTOS', { id: p.ID_PROYECTO, datos: d }) : await api.write('crear', 'PROYECTOS', { datos: d });
      toast(p ? 'Acta actualizada' : `Proyecto ${r.CODIGO} creado`);
      if (!p) location.hash = `#/proyectos/${r.ID_PROYECTO}/cronograma`;
    }
  });
}

function renderSettings(el, user) {
  const edit = can(user, 'proyectos.configurar');
  const cats = api.rows('PRY_CATALOGOS');
  const group = c => cats.filter(x => x.CATALOGO === c).sort((a, b) => String(a.CODIGO).localeCompare(String(b.CODIGO)));
  const cols = [
    { label: 'Código', html: c => `<code>${esc(String(c.CODIGO).slice(0, c.CATALOGO === 'FESTIVO' ? 10 : 40))}</code>` }, { label: 'Nombre', key: 'VALOR' }, { label: 'Estado', html: c => badge(c.ESTADO_REGISTRO) },
    { label: '', html: c => edit && c.ESTADO_REGISTRO !== 'ANULADO' ? `<button class="btn btn-secondary btn-sm" data-toggle="${esc(c.ID_CATALOGO)}">${c.ESTADO_REGISTRO === 'ACTIVO' ? 'Inactivar' : 'Activar'}</button>` : '' }
  ];
  el.innerHTML = `<div class="mt-breadcrumb"><a href="#/proyectos">Proyectos</a> › Calendario y líneas de negocio</div>
    <div class="page-title"><div><h2>Calendario y líneas de negocio</h2><div class="muted">Los festivos se descuentan al calcular fechas de todos los cronogramas</div></div>${edit ? '<div class="toolbar mt-head-actions"><button class="btn btn-primary" data-new>+ Agregar</button></div>' : ''}</div>
    <div class="grid2"><section class="panel"><h3>Festivos (días no laborables)</h3><p class="metric-note">Se cargaron los festivos de Colombia 2025–2027: verifíquelos. Agregar o inactivar un festivo reprograma automáticamente los proyectos.</p>${dataTable(group('FESTIVO'), cols)}</section>
    <section class="panel"><h3>Líneas de negocio (proyectos externos)</h3>${dataTable(group('LINEA_NEGOCIO'), cols)}</section></div>`;
  el.querySelector('[data-new]')?.addEventListener('click', () => openForm({ title: 'Agregar al calendario o líneas de negocio', form: CATALOG_FORM, values: { CATALOGO: 'FESTIVO' }, onSubmit: async d => { await api.write('crear', 'PRY_CATALOGOS', { datos: d }); toast('Agregado'); } }));
  el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
    const c = cats.find(x => x.ID_CATALOGO === b.dataset.toggle);
    try { await api.write('estado', 'PRY_CATALOGOS', { id: c.ID_CATALOGO, estado: c.ESTADO_REGISTRO === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' }); toast('Actualizado'); } catch (e) { toast(e.message); }
  });
}
