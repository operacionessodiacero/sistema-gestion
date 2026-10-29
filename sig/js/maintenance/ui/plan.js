// Vista "Plan de mantenimiento": tareas periódicas (calendario o contador), generación de OT preventivas,
// lecturas operacionales por activo y periodos de inactividad (para disponibilidad ISO 14224 / SMRP).
import * as assets from '../services/assets.js';
import * as catalogs from '../services/catalogs.js';
import { plans, workOrders, readings, variables, periods } from '../services/operations.js';
import { PLAN_FORM, VARIABLE_FORM, READING_FORM, PERIOD_FORM } from '../domain/schema.js';
import { ms, fmtMs, nowMs } from '../domain/reliability.js';
import { esc, emptyState, dataTable, badge, fmtNumber } from './components.js';
import { openForm } from './form.js';
import { perms, changeState } from './actions.js';
import { assetOptions, variableOptions, scopeOptions, scopeLabel } from './options.js';
import { openOTForm } from './workOrders.js';
import { lineChart } from './charts.js';
import { toast } from '../../ui.js';

const SUB = [['preventivo', 'Plan preventivo'], ['lecturas', 'Lecturas operacionales'], ['inactividad', 'Inactividad y paradas de planta']];
const COUNTER = { HORAS_OPERACION: 1, CICLOS: 1, TONELADAS: 1 };
const view = { activo: '', variable: '' };
const today = () => new Date().toISOString().slice(0, 10);

export function primaryAction(user, id) {
  const p = perms(user);
  if (!p.crear) return null;
  if (id === 'lecturas') return { label: '+ Lectura', run: () => openReadingForm(user) };
  if (id === 'inactividad') return { label: '+ Periodo', run: () => openPeriodForm(user) };
  return { label: '+ Tarea preventiva', run: () => openPlanForm(user) };
}

export function render(el, { user, id }) {
  const sub = SUB.some(s => s[0] === id) ? id : 'preventivo';
  el.innerHTML = `<nav class="mt-subnav">${SUB.map(([k, l]) => `<a href="#/mantenimiento/plan/${k}" class="${k === sub ? 'active' : ''}">${esc(l)}</a>`).join('')}</nav><div data-sub></div>`;
  ({ preventivo: renderPlans, lecturas: renderReadings, inactividad: renderPeriods })[sub](el.querySelector('[data-sub]'), user);
}

/* ------------------------------ Plan ------------------------------ */

export function lastReading(idActivo, variable) {
  return readings.where(r => r.ID_ACTIVO === idActivo && r.VARIABLE === variable).sort((a, b) => String(b.FECHA_HORA).localeCompare(String(a.FECHA_HORA)))[0] || null;
}

export function planStatus(p) {
  if (COUNTER[p.UNIDAD_FRECUENCIA]) {
    const r = lastReading(p.ID_ACTIVO, p.UNIDAD_FRECUENCIA);
    if (p.PROXIMO_VALOR_CONTADOR === '' || p.PROXIMO_VALOR_CONTADOR === undefined) return { code: 'SIN_DATOS', label: 'Sin contador base', cls: 'mt-neutral' };
    if (!r) return { code: 'SIN_DATOS', label: 'Sin lecturas', cls: 'mt-neutral' };
    const falta = Number(p.PROXIMO_VALOR_CONTADOR) - Number(r.VALOR);
    if (falta <= 0) return { code: 'VENCIDO', label: `Vencido (${fmtNumber(-falta)} sobre)`, cls: 'bad' };
    if (falta <= Number(p.FRECUENCIA) * 0.1) return { code: 'PROXIMO', label: `Próximo (faltan ${fmtNumber(falta)})`, cls: 'warn' };
    return { code: 'AL_DIA', label: `Al día (faltan ${fmtNumber(falta)})`, cls: 'good' };
  }
  if (!p.PROXIMA_EJECUCION) return { code: 'SIN_DATOS', label: 'Sin fecha', cls: 'mt-neutral' };
  const d = String(p.PROXIMA_EJECUCION).slice(0, 10), h = today();
  const dias = Math.round((ms(d) - ms(h)) / 86400000);
  if (dias < 0) return { code: 'VENCIDO', label: `Vencido hace ${-dias} d`, cls: 'bad' };
  if (dias <= 7) return { code: 'PROXIMO', label: `En ${dias} d`, cls: 'warn' };
  return { code: 'AL_DIA', label: `En ${dias} d`, cls: 'good' };
}

function renderPlans(el, user) {
  const p = perms(user);
  const all = plans.all();
  if (!all.length) {
    el.innerHTML = `<div class="panel">${emptyState({ icon: '↻', title: 'Sin tareas preventivas', text: 'Defina tareas periódicas por días, semanas, meses, horas de operación, ciclos o toneladas. El sistema calcula la próxima ejecución y permite generar la OT preventiva.', action: p.crear ? '<button class="btn btn-primary" data-new>+ Tarea preventiva</button>' : '' })}</div>`;
    el.querySelector('[data-new]')?.addEventListener('click', () => openPlanForm(user));
    return;
  }
  const rank = { VENCIDO: 0, PROXIMO: 1, AL_DIA: 2, SIN_DATOS: 3 };
  const rows = all.map(x => ({ ...x, _st: planStatus(x), _ot: workOrders.where(o => o.ID_PLAN === x.ID_PLAN && o.ESTADO !== 'CERRADA')[0] }))
    .sort((a, b) => rank[a._st.code] - rank[b._st.code] || String(a.PROXIMA_EJECUCION).localeCompare(String(b.PROXIMA_EJECUCION)));
  const n = c => rows.filter(r => r.ESTADO_REGISTRO === 'ACTIVO' && r._st.code === c).length;
  el.innerHTML = `<div class="cards">${[['Vencidas', n('VENCIDO'), 'bad'], ['Próximas (7 días / 10%)', n('PROXIMO'), 'warn'], ['Al día', n('AL_DIA'), 'good'], ['Con OT abierta', rows.filter(r => r._ot).length, '']].map(([l, v, c]) => `<div class="card"><div class="label">${l}</div><div class="value ${c ? 'mt-txt-' + c : ''}">${v}</div></div>`).join('')}</div>
  <div class="panel">${dataTable(rows, [
    { label: 'Estado', html: x => x.ESTADO_REGISTRO !== 'ACTIVO' ? badge(x.ESTADO_REGISTRO) : `<span class="status ${x._st.cls}">${esc(x._st.label)}</span>` },
    { label: 'Activo', html: x => `<a href="#/mantenimiento/hoja-vida/${esc(x.ID_ACTIVO)}">${esc(assets.get(x.ID_ACTIVO)?.CODIGO_ACTIVO || x.ID_ACTIVO)}</a>` },
    { label: 'Actividad', html: x => `${esc(x.ACTIVIDAD)}<div class="metric-note">${esc(catalogs.label('TIPO_MTTO', x.TIPO))}${x.REQUIERE_PARADA === 'SI' ? ' · requiere parada' : ''}${x.DURACION_ESTIMADA_MIN ? ` · ${esc(x.DURACION_ESTIMADA_MIN)} min` : ''}</div>` },
    { label: 'Frecuencia', html: x => esc(`${fmtNumber(x.FRECUENCIA)} ${catalogs.label('UNIDAD_FRECUENCIA', x.UNIDAD_FRECUENCIA).toLowerCase()}`) },
    { label: 'Última', html: x => esc(COUNTER[x.UNIDAD_FRECUENCIA] ? (x.ULTIMO_VALOR_CONTADOR !== '' ? fmtNumber(x.ULTIMO_VALOR_CONTADOR) : '—') : (String(x.ULTIMA_EJECUCION || '—').slice(0, 10))) },
    { label: 'Próxima', html: x => esc(COUNTER[x.UNIDAD_FRECUENCIA] ? (x.PROXIMO_VALOR_CONTADOR !== '' ? fmtNumber(x.PROXIMO_VALOR_CONTADOR) : '—') : String(x.PROXIMA_EJECUCION || '—').slice(0, 10)) },
    { label: 'OT', html: x => x._ot ? `<a href="#/mantenimiento/ot/${esc(x._ot.ID_OT)}">${esc(x._ot.NUMERO_OT)}</a>` : (p.crear && x.ESTADO_REGISTRO === 'ACTIVO' ? `<button class="btn btn-secondary btn-sm" data-gen="${esc(x.ID_PLAN)}">Generar OT</button>` : '—') },
    { label: '', html: x => `<div class="toolbar mt-row-actions">${p.editar && x.ESTADO_REGISTRO === 'ACTIVO' ? `<button class="btn btn-secondary btn-sm" data-edit="${esc(x.ID_PLAN)}">Editar</button>` : ''}${p.inactivar && x.ESTADO_REGISTRO !== 'ANULADO' ? `<button class="btn btn-secondary btn-sm" data-toggle="${esc(x.ID_PLAN)}">${x.ESTADO_REGISTRO === 'ACTIVO' ? 'Suspender' : 'Reactivar'}</button>` : ''}</div>` }
  ])}<p class="metric-note">Al cerrar la OT generada, el sistema registra la ejecución y recalcula la próxima fecha (o el próximo valor del contador).</p></div>`;
  el.querySelectorAll('[data-gen]').forEach(b => b.onclick = () => {
    const x = plans.get(b.dataset.gen);
    openOTForm(user, { preset: { ID_ACTIVO: x.ID_ACTIVO, ID_PLAN: x.ID_PLAN, TIPO_MTTO: x.TIPO, PRIORIDAD: 'MEDIA', DESCRIPCION: x.ACTIVIDAD, FECHA_PROGRAMADA: x.PROXIMA_EJECUCION && String(x.PROXIMA_EJECUCION) >= today() ? String(x.PROXIMA_EJECUCION).slice(0, 10) : today(), RESPONSABLE: x.RESPONSABLE || user?.name || '' } });
  });
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openPlanForm(user, plans.get(b.dataset.edit)));
  el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => { const x = plans.get(b.dataset.toggle); changeState(user, plans, x.ID_PLAN, x.ESTADO_REGISTRO === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO', 'la tarea'); });
}

export function openPlanForm(user, item = null, preset = {}) {
  openForm({
    title: item ? 'Editar tarea preventiva' : 'Nueva tarea preventiva', form: PLAN_FORM, editing: !!item, width: 'wide',
    values: item || { TIPO: 'PREVENTIVO', UNIDAD_FRECUENCIA: 'DIAS', REQUIERE_PARADA: 'NO', FECHA_INICIO: today(), ...preset },
    optionsFor: { ID_ACTIVO: assetOptions },
    refreshOn: ['UNIDAD_FRECUENCIA'],
    hidden: (name, v) => (name === 'ULTIMO_VALOR_CONTADOR' && !COUNTER[v.UNIDAD_FRECUENCIA]) || ((name === 'FECHA_INICIO' || name === 'ULTIMA_EJECUCION') && COUNTER[v.UNIDAD_FRECUENCIA]),
    preview: v => COUNTER[v.UNIDAD_FRECUENCIA]
      ? (v.ULTIMO_VALOR_CONTADOR ? `Próxima ejecución al llegar a <b>${fmtNumber(Number(v.ULTIMO_VALOR_CONTADOR) + Number(v.FRECUENCIA || 0))}</b> (según las lecturas de ${esc(catalogs.label('UNIDAD_FRECUENCIA', v.UNIDAD_FRECUENCIA).toLowerCase())}).` : 'Indique el contador de la última ejecución para calcular la próxima.')
      : 'La próxima fecha se calcula desde la última ejecución (o la fecha de inicio) más la frecuencia.',
    onSubmit: async d => { item ? await plans.update(item.ID_PLAN, d, user) : await plans.create(d, user); toast('Tarea guardada'); }
  });
}

/* ------------------------------ Lecturas ------------------------------ */

function renderReadings(el, user) {
  const p = perms(user);
  const opts = assetOptions();
  if (!view.activo || !assets.get(view.activo)) view.activo = variables.active()[0]?.ID_ACTIVO || opts[0]?.value || '';
  const vars = variables.active().filter(v => v.ID_ACTIVO === view.activo);
  if (!vars.some(v => v.VARIABLE === view.variable)) view.variable = vars[0]?.VARIABLE || '';
  const list = readings.where(r => r.ID_ACTIVO === view.activo).sort((a, b) => String(b.FECHA_HORA).localeCompare(String(a.FECHA_HORA)));
  const serie = list.filter(r => r.VARIABLE === view.variable).slice().reverse();
  const cfg = vars.find(v => v.VARIABLE === view.variable);
  el.innerHTML = `<div class="panel mt-filters"><div class="toolbar"><select data-activo aria-label="Activo">${opts.map(o => `<option value="${esc(o.value)}" ${o.value === view.activo ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
    ${p.crear && view.activo ? '<button class="btn btn-secondary btn-sm" data-add-var>+ Configurar variable</button>' : ''}</div></div>
    ${!vars.length ? `<div class="panel">${emptyState({ icon: '📈', title: 'Este activo no tiene variables configuradas', text: 'Configure qué variables se miden (horas de operación, temperatura, presión, vibración…) y sus límites. Cada activo puede medir variables distintas.' })}</div>` : `
    <div class="cards">${vars.map(v => { const r = lastReading(v.ID_ACTIVO, v.VARIABLE); return `<button class="card mt-var-card ${v.VARIABLE === view.variable ? 'active' : ''}" data-var="${esc(v.VARIABLE)}"><div class="label">${esc(catalogs.label('VARIABLE_LECTURA', v.VARIABLE))}</div><div class="value">${r ? esc(fmtNumber(r.VALOR, 2)) : '—'} <small>${esc(v.UNIDAD || '')}</small></div><div class="metric-note">${r ? esc(String(r.FECHA_HORA).slice(0, 16)) : 'Sin lecturas'} ${r?.ESTADO === 'FUERA_DE_LIMITE' ? '<span class="status bad">fuera de límite</span>' : ''}</div><div class="metric-note">Límites: ${v.LIMITE_INFERIOR !== '' ? esc(v.LIMITE_INFERIOR) : '—'} a ${v.LIMITE_SUPERIOR !== '' ? esc(v.LIMITE_SUPERIOR) : '—'}</div></button>`; }).join('')}</div>
    <div class="panel"><h3>${esc(catalogs.label('VARIABLE_LECTURA', view.variable))} ${cfg ? `<span class="muted">(${esc(cfg.UNIDAD)})</span>` : ''}</h3>${serieChart(serie)}</div>
    <div class="panel"><h3>Últimas lecturas</h3>${dataTable(list.slice(0, 60), [
      { label: 'Fecha', html: r => esc(String(r.FECHA_HORA).slice(0, 16)) }, { label: 'Variable', html: r => esc(catalogs.label('VARIABLE_LECTURA', r.VARIABLE)) },
      { label: 'Valor', html: r => esc(`${fmtNumber(r.VALOR, 2)} ${r.UNIDAD || ''}`) },
      { label: 'Estado', html: r => r.ESTADO === 'FUERA_DE_LIMITE' ? '<span class="status bad">Fuera de límite</span>' : r.ESTADO === 'NORMAL' ? '<span class="status good">Normal</span>' : '<span class="muted">Sin límites</span>' },
      { label: 'Registrado por', key: 'REGISTRADO_POR' }, { label: 'Observación', key: 'OBSERVACION' },
      { label: '', html: r => p.anular ? `<button class="btn btn-secondary btn-sm" data-void="${esc(r.ID_LECTURA)}">Anular</button>` : '' }
    ], { empty: 'Sin lecturas' })}</div>`}`;
  el.querySelector('[data-activo]')?.addEventListener('change', e => { view.activo = e.target.value; view.variable = ''; renderReadings(el, user); });
  el.querySelectorAll('[data-var]').forEach(b => b.onclick = () => { view.variable = b.dataset.var; renderReadings(el, user); });
  el.querySelector('[data-add-var]')?.addEventListener('click', () => openForm({
    title: 'Configurar variable del activo', form: VARIABLE_FORM, values: { ID_ACTIVO: view.activo }, optionsFor: { ID_ACTIVO: assetOptions },
    onSubmit: async d => { await variables.create(d, user); toast('Variable configurada'); }
  }));
  el.querySelectorAll('[data-void]').forEach(b => b.onclick = () => changeState(user, readings, b.dataset.void, 'ANULADO', 'la lectura'));
}

function serieChart(serie) {
  if (serie.length < 2) return '<div class="mt-chart-empty">Se necesitan al menos 2 lecturas para graficar</div>';
  return lineChart(serie.map(r => String(r.FECHA_HORA).slice(0, 10)), [{ name: 'Valor', color: '#1a5fd0', values: serie.map(r => Number(r.VALOR)) }], { digits: 2, labelFn: d => `${d.slice(8, 10)}/${d.slice(5, 7)}` });
}

export function openReadingForm(user, preset = {}) {
  openForm({
    title: 'Registrar lectura', form: READING_FORM, values: { ID_ACTIVO: view.activo, VARIABLE: view.variable, FECHA_HORA: fmtMs(nowMs()), ...preset },
    refreshOn: ['ID_ACTIVO'],
    optionsFor: { ID_ACTIVO: () => assetOptions().filter(o => variables.active().some(v => v.ID_ACTIVO === o.value)), VARIABLE: v => variableOptions(v.ID_ACTIVO) },
    preview: v => {
      const cfg = variables.active().find(x => x.ID_ACTIVO === v.ID_ACTIVO && x.VARIABLE === v.VARIABLE);
      if (!cfg || v.VALOR === '' || v.VALOR === undefined) return '';
      const n = Number(v.VALOR), out = (cfg.LIMITE_INFERIOR !== '' && n < cfg.LIMITE_INFERIOR) || (cfg.LIMITE_SUPERIOR !== '' && n > cfg.LIMITE_SUPERIOR);
      return out ? '<span class="status bad">Fuera de límite</span> Considere registrar una anomalía.' : '<span class="status good">Dentro de límites</span>';
    },
    onSubmit: async d => { await readings.create(d, user); toast('Lectura registrada'); }
  });
}

/* ------------------------------ Inactividad ------------------------------ */

function renderPeriods(el, user) {
  const p = perms(user);
  const list = periods.all().sort((a, b) => String(b.INICIO).localeCompare(String(a.INICIO)));
  el.innerHTML = `<div class="panel"><p class="metric-note">Registre aquí los periodos en que <b>no se requiere producción</b>, los <b>paros de planta</b> (emergencia o parada mayor) y el <b>standby</b>. No son tiempos de mantenimiento: sirven para calcular correctamente la disponibilidad operacional (Ao), técnica (At) y SMRP. Si se registran sobre una línea, aplican a todos sus equipos.</p>
    ${list.length ? dataTable(list, [
      { label: 'Alcance', html: x => esc(scopeLabel(x.ID_REFERENCIA)) },
      { label: 'Categoría', html: x => esc(catalogs.label('CATEGORIA_INACTIVIDAD', x.CATEGORIA)) },
      { label: 'Inicio', html: x => esc(String(x.INICIO).slice(0, 16)) }, { label: 'Fin', html: x => esc(String(x.FIN).slice(0, 16)) },
      { label: 'Horas', html: x => esc(fmtNumber((ms(x.FIN) - ms(x.INICIO)) / 3600000, 1)) },
      { label: 'Observación', key: 'OBSERVACION' },
      { label: '', html: x => `<div class="toolbar mt-row-actions">${p.editar && x.ESTADO_REGISTRO === 'ACTIVO' ? `<button class="btn btn-secondary btn-sm" data-edit="${esc(x.ID_PERIODO)}">Editar</button>` : ''}${p.anular ? `<button class="btn btn-secondary btn-sm" data-void="${esc(x.ID_PERIODO)}">Anular</button>` : ''}</div>` }
    ]) : emptyState({ icon: '⏸', title: 'Sin periodos registrados', text: 'Sin periodos de inactividad, Ao, At y SMRP consideran todo el tiempo calendario como tiempo requerido.' })}</div>`;
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openPeriodForm(user, periods.get(b.dataset.edit)));
  el.querySelectorAll('[data-void]').forEach(b => b.onclick = () => changeState(user, periods, b.dataset.void, 'ANULADO', 'el periodo'));
}

export function openPeriodForm(user, item = null, preset = {}) {
  const now = fmtMs(nowMs());
  openForm({
    title: item ? 'Editar periodo' : 'Nuevo periodo de inactividad', form: PERIOD_FORM, editing: !!item,
    values: item || { CATEGORIA: 'NO_REQUIERE_PRODUCCION', INICIO: now.slice(0, 11) + '00:00', FIN: now.slice(0, 11) + '23:59', ...preset },
    optionsFor: { ID_REFERENCIA: () => scopeOptions() },
    preview: v => { const h = (ms(v.FIN) - ms(v.INICIO)) / 3600000; return Number.isFinite(h) ? (h > 0 ? `Duración: <b>${fmtNumber(h, 1)} h</b>` : '<span class="status bad">El fin debe ser posterior al inicio</span>') : ''; },
    onSubmit: async d => { item ? await periods.update(item.ID_PERIODO, d, user) : await periods.create(d, user); toast('Periodo guardado'); }
  });
}
