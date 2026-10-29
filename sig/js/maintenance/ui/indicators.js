// Vista "Indicadores" y Dashboard de mantenimiento. Todo se calcula desde las tablas transaccionales
// (eventos, cronologías, OT, FMEA, periodos). Ningún número se digita ni se inventa.
import * as assets from '../services/assets.js';
import * as hierarchy from '../services/hierarchy.js';
import * as catalogs from '../services/catalogs.js';
import { data } from '../services/api.js';
import { fmea, modeLabel, failureModes } from '../services/operations.js';
import { availability, failureStats, otStats, pareto, monthsBetween, monthRange, rangeFor, scopeAssets } from '../domain/reliability.js';
import { nprLevel } from '../domain/fmea.js';
import { esc, ND, kpi, emptyState, fmtNumber, fmtMoney, dataTable } from './components.js';
import { hBars, paretoChart, lineChart } from './charts.js';
import { perms } from './actions.js';
import { assetOptions } from './options.js';
import { rangeControls, bindRange } from './availability.js';

const f = { range: '90', from: '', to: '', proceso: '', linea: '', activo: '', tipo: '', modo: '' };

export function render(el, { user, compact = false }) {
  if (!assets.list().length) { el.innerHTML = `<div class="panel">${emptyState({ icon: '◔', title: 'Sin activos', text: 'Los indicadores se calculan a partir del inventario, los eventos, las cronologías y las OT.', action: '<a class="btn btn-primary" href="#/mantenimiento/activos">Ir al inventario</a>' })}</div>`; return; }
  const procs = hierarchy.byLevel('PROCESO'), lines = hierarchy.byLevel('LINEA').filter(l => !f.proceso || l.ID_PADRE === f.proceso);
  el.innerHTML = `<div class="panel mt-filters"><div class="toolbar">
    ${rangeControls(f).replace('<option value="last"', '<option value="last" disabled hidden')}
    <select data-f="proceso" aria-label="Proceso"><option value="">Proceso: todos</option>${procs.map(p => `<option value="${esc(p.ID_NODO)}" ${p.ID_NODO === f.proceso ? 'selected' : ''}>${esc(p.NOMBRE_NODO)}</option>`).join('')}</select>
    <select data-f="linea" aria-label="Línea"><option value="">Línea: todas</option>${lines.map(p => `<option value="${esc(p.ID_NODO)}" ${p.ID_NODO === f.linea ? 'selected' : ''}>${esc(p.NOMBRE_NODO)}</option>`).join('')}</select>
    <select data-f="activo" aria-label="Activo"><option value="">Activo: todos</option>${assetOptions().map(o => `<option value="${esc(o.value)}" ${o.value === f.activo ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
    <select data-f="tipo" aria-label="Tipo de mantenimiento"><option value="">Tipo de mtto: todos</option>${catalogs.options('TIPO_MTTO').map(o => `<option value="${esc(o.value)}" ${o.value === f.tipo ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
    <select data-f="modo" aria-label="Modo de falla"><option value="">Modo de falla: todos</option>${failureModes.active().map(m => `<option value="${esc(m.ID_MODO_FALLA)}" ${m.ID_MODO_FALLA === f.modo ? 'selected' : ''}>${esc(m.CODIGO + ' · ' + m.NOMBRE)}</option>`).join('')}</select>
  </div></div><div data-out></div>`;
  const draw = () => renderOut(el.querySelector('[data-out]'), user, compact);
  draw();
  el.querySelectorAll('[data-f]').forEach(s => s.onchange = () => { f[s.dataset.f] = s.value; if (s.dataset.f === 'proceso') { f.linea = ''; render(el, { user, compact }); } else draw(); });
  bindRange(el, f, draw);
}

function scopeId() { return f.activo || f.linea || f.proceso || ''; }

function renderOut(el, user, compact) {
  const p = perms(user);
  const d0 = data();
  // El filtro de modo de falla aplica a las fallas (no a la disponibilidad ni a las OT)
  const d = f.modo ? { ...d0, EVENTOS: (d0.EVENTOS || []).filter(e => e.TIPO_EVENTO !== 'FALLA' || e.ID_MODO_FALLA === f.modo || failureModes.get(e.ID_MODO_FALLA)?.CODIGO_PADRE === failureModes.get(f.modo)?.CODIGO) } : d0;
  const [from, to] = rangeFor(f.range, f);
  const sid = scopeId();
  const scope = sid ? scopeAssets(d, sid) : new Set(assets.list().map(a => a.ID_ACTIVO));
  const equipos = [...scope].map(assets.get).filter(a => a && a.NIVEL_JERARQUIA === 'EQUIPO' && a.ESTADO_REGISTRO === 'ACTIVO');
  const perEq = equipos.map(a => ({ a, av: availability(d, a.ID_ACTIVO, from, to), fs: failureStats(d, a.ID_ACTIVO, from, to) }));
  const av = sid ? availability(d, sid, from, to) : null;
  const meanOf = k => { const v = perEq.map(x => x.av[k]).filter(x => x !== null); return v.length === perEq.length && v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const Ao = av ? av.Ao : meanOf('Ao'), At = av ? av.At : meanOf('At'), SMRP = av ? av.SMRP : meanOf('SMRP');
  // Fallas: unión de todos los activos del alcance
  const fsAll = perEq.reduce((acc, x) => acc.concat(x.fs.failures), []);
  const fsScope = sid ? failureStats(d, sid, from, to) : null;
  const ut = perEq.flatMap(x => x.fs.mtbfN ? [x.fs.mtbfH * x.fs.mtbfN] : []), utN = perEq.reduce((s, x) => s + x.fs.mtbfN, 0);
  const mtbf = fsScope && f.activo ? fsScope.mtbfH : (utN ? ut.reduce((s, v) => s + v, 0) / utN : null);
  const ttr = fsAll.map(x => x.m?.ttr).filter(v => v != null);
  const mttr = ttr.length ? ttr.reduce((s, v) => s + v, 0) / ttr.length : null;
  const dtH = perEq.reduce((s, x) => s + x.av.Tc + x.av.Tp, 0);
  const ots = otStats(d, scope, from, to);
  const otsTipo = f.tipo ? otStats({ ...d, OT: (d.OT || []).filter(o => o.TIPO_MTTO === f.tipo) }, scope, from, to) : ots;
  const pct = x => x === null ? ND : esc(fmtNumber(x * 100, 1) + ' %');
  const months = monthsBetween(from, to);
  const trend = months.map(k => { const [a, b] = monthRange(k); const fs = fsAll.filter(x => x.start >= a && x.start < b); return { n: fs.length, dt: fs.reduce((s, x) => s + (x.m?.dt || 0), 0) / 60 }; });
  const par = pareto(fsAll, x => x.ev.ID_MODO_FALLA || 'SIN_MODO');
  const topNpr = fmea.active().filter(x => scope.has(x.ID_ACTIVO)).sort((a, b) => Number(b.NPR) - Number(a.NPR)).slice(0, 10);
  const lbl = a => `${a.CODIGO_ACTIVO} ${a.NOMBRE_ACTIVO}`;
  const problem = perEq.map(x => ({ label: lbl(x.a), value: x.av.Tc + x.av.Tp, title: `${x.fs.count} falla(s) · ${fmtNumber(x.av.Tc + x.av.Tp)} h de parada` })).filter(x => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
  const costPerAsset = p.verCostos ? [...scope].map(id => ({ a: assets.get(id), c: (d.OT || []).filter(o => o.ID_ACTIVO === id && o.ESTADO_REGISTRO !== 'ANULADO').reduce((s, o) => s + (Number(o.COSTO_TOTAL) || 0), 0) })).filter(x => x.a && x.c > 0).sort((a, b) => b.c - a.c).slice(0, 10) : [];

  el.innerHTML = `
    ${av && av.incompletos.length ? `<div class="mt-alert warn">${av.incompletos.length} parada(s) sin retorno a servicio: la disponibilidad queda N/D hasta completar su cronología.</div>` : ''}
    <section class="mt-kpis">
      ${kpi('Disponibilidad Ao', pct(Ao), sid ? 'ISO 14224 operacional' : 'Promedio de equipos')}
      ${kpi('Disponibilidad At', pct(At), 'Técnica')}${kpi('Disponibilidad SMRP', pct(SMRP), 'Uptime / (Uptime + Downtime)')}
      ${kpi('MTBF', mtbf === null ? ND : esc(fmtNumber(mtbf, 1) + ' h'))}${kpi('MTTR', mttr === null ? ND : esc(fmtNumber(mttr, 0) + ' min'))}
      ${kpi('Fallas', esc(fsAll.length))}
      ${kpi('Horas de parada', esc(fmtNumber(dtH, 1) + ' h'), 'Correctivo + preventivo')}
      ${kpi('Cumplimiento preventivo', ots.pmCompliance === null ? ND : pct(ots.pmCompliance), ots.pmProgrammed ? `${ots.pmProgrammed} OT preventivas programadas` : 'Sin preventivos programados')}
      ${kpi('Correctivo vs preventivo', ots.corr + ots.prev ? esc(`${fmtNumber(ots.corr / (ots.corr + ots.prev) * 100, 0)} % / ${fmtNumber(ots.prev / (ots.corr + ots.prev) * 100, 0)} %`) : ND, `${ots.corr} correctivas · ${ots.prev} preventivas`)}
      ${kpi('Backlog de OT', esc(ots.open), `${fmtNumber(ots.backlogHours, 1)} HH registradas en OT abiertas`)}
      ${kpi('OT vencidas', esc(ots.overdue))}
      ${kpi('Horas hombre', esc(fmtNumber(otsTipo.hh, 1)))}
      ${p.verCostos ? kpi('Costo de mantenimiento', otsTipo.cost === null ? ND : esc(fmtMoney(otsTipo.cost)), otsTipo.cost ? `MO ${fmtMoney(otsTipo.costLabor)} · Rep ${fmtMoney(otsTipo.costParts)} · Serv ${fmtMoney(otsTipo.costServices)}` : '') : ''}
    </section>
    ${compact ? '' : `
    <div class="grid2">
      <section class="panel"><h3>Pareto de fallas por modo</h3>${paretoChart(par, k => k === 'SIN_MODO' ? 'Sin modo' : modeLabel(k).replace(/^\S+ · /, ''))}</section>
      <section class="panel"><h3>Tendencia mensual</h3>${lineChart(months, [{ name: 'Fallas', color: '#d93025', values: trend.map(t => t.n) }, { name: 'Horas de parada por falla', color: '#1a5fd0', values: trend.map(t => t.dt) }])}</section>
    </div>
    <div class="grid2">
      <section class="panel"><h3>MTBF por activo</h3>${hBars(perEq.filter(x => x.fs.mtbfH !== null).map(x => ({ label: lbl(x.a), value: x.fs.mtbfH })).sort((a, b) => a.value - b.value), { unit: 'h', empty: 'Requiere al menos 2 fallas con retorno por equipo' })}</section>
      <section class="panel"><h3>MTTR por activo</h3>${hBars(perEq.filter(x => x.fs.mttrMin !== null).map(x => ({ label: lbl(x.a), value: x.fs.mttrMin })).sort((a, b) => b.value - a.value), { unit: 'min', digits: 0, empty: 'Sin reparaciones con cronología' })}</section>
    </div>
    <div class="grid2">
      <section class="panel"><h3>Disponibilidad (Ao) por activo</h3>${hBars(perEq.filter(x => x.av.Ao !== null).map(x => ({ label: lbl(x.a), value: x.av.Ao * 100, color: x.av.Ao < 0.9 ? '#d93025' : x.av.Ao < 0.95 ? '#c49a1f' : '#2e9d4f' })).sort((a, b) => a.value - b.value), { unit: '%', max: 100 })}</section>
      <section class="panel"><h3>Top 10 activos problemáticos (horas de parada)</h3>${hBars(problem, { unit: 'h', empty: 'Sin paradas en el periodo' })}</section>
    </div>
    <div class="grid2">
      <section class="panel"><h3>Preventivo vs correctivo (OT)</h3>${hBars([{ label: 'Preventivo / predictivo / inspección', value: ots.prev, color: '#1a5fd0' }, { label: 'Correctivo / emergencia', value: ots.corr, color: '#d93025' }].filter(x => x.value), { unit: 'OT', digits: 0, empty: 'Sin OT en el periodo' })}</section>
      ${p.verCostos ? `<section class="panel"><h3>Costo por activo</h3>${hBars(costPerAsset.map(x => ({ label: lbl(x.a), value: x.c / 1e6, title: fmtMoney(x.c) })), { unit: 'M COP', digits: 2, empty: 'Sin costos registrados' })}</section>` : '<section class="panel"><h3>Costos</h3><p class="muted">Requiere el permiso mantenimiento.costos.ver.</p></section>'}
    </div>
    <section class="panel"><h3>NPR más altos del FMEA</h3>${dataTable(topNpr, [
      { label: 'NPR', html: x => `<span class="status ${nprLevel(x.NPR)}">${esc(x.NPR)}</span>` },
      { label: 'Activo', html: x => esc(assets.get(x.ID_ACTIVO)?.CODIGO_ACTIVO || '') }, { label: 'Modo', key: 'MODO_FALLA' },
      { label: 'Causa', key: 'CAUSA_POTENCIAL' }, { label: 'Acción recomendada', key: 'ACCION_RECOMENDADA' }, { label: 'Estado', key: 'ESTADO' }
    ], { empty: 'Sin análisis FMEA en el alcance' })}</section>`}`;
}
