// Vista "Eventos y tiempos": registro de eventos (falla, inspección, parada…) eligiendo el activo
// del inventario, verificación automática contra el FMEA y cronología de intervención.
import * as assets from '../services/assets.js';
import * as catalogs from '../services/catalogs.js';
import { events, timesOfEvent, otOfEvent, modeLabel, times } from '../services/operations.js';
import { data } from '../services/api.js';
import { EVENT_FORM, TIEMPOS_FORM } from '../domain/schema.js';
import { cronoMetrics, eventClass, ms, fmtMs, nowMs } from '../domain/reliability.js';
import { fmeaCoverage } from '../domain/fmea.js';
import { esc, ND, kpi, emptyState, dataTable, bindRowLinks, badge, fmtNumber } from './components.js';
import { openForm } from './form.js';
import { perms, changeState } from './actions.js';
import { assetOptions, componentOptions, modeOptions, assetLabel } from './options.js';
import { interventionBar } from './charts.js';
import { openOTForm } from './workOrders.js';
import { openFMEAForm } from './fmea.js';
import { toast } from '../../ui.js';

const filters = { activo: '', tipo: '', estado: '', q: '' };
const STATE_LABEL = { ABIERTO: 'Abierto', EN_ATENCION: 'En atención', CERRADO: 'Cerrado' };

export function primaryAction(user) {
  return perms(user).crear ? { label: '+ Registrar evento', run: () => openEventForm(user) } : null;
}

export function render(el, { user, id }) {
  if (id) return renderDetail(el, user, id);
  const all = events.all();
  if (!all.length) {
    el.innerHTML = `<div class="panel">${emptyState({ icon: '⚡', title: 'Sin eventos registrados', text: 'Registre fallas, inspecciones, anomalías y paradas eligiendo el equipo del inventario. Luego agregue la cronología (cuándo falló, cuándo llegó mantenimiento, cuándo volvió a operar) y el sistema calcula los tiempos.', action: perms(user).crear ? '<button class="btn btn-primary" data-new>+ Registrar evento</button>' : '' })}</div>`;
    el.querySelector('[data-new]')?.addEventListener('click', () => openEventForm(user));
    return;
  }
  el.innerHTML = `<div class="panel mt-filters"><div class="toolbar">
      <input type="search" data-f="q" placeholder="Buscar descripción, síntoma, ID…" value="${esc(filters.q)}" aria-label="Buscar">
      <select data-f="activo" aria-label="Activo"><option value="">Activo: todos</option>${assetOptions().map(o => `<option value="${esc(o.value)}" ${o.value === filters.activo ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
      <select data-f="tipo" aria-label="Tipo"><option value="">Tipo: todos</option>${catalogs.options('TIPO_EVENTO').map(o => `<option value="${esc(o.value)}" ${o.value === filters.tipo ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
      <select data-f="estado" aria-label="Estado"><option value="">Estado: todos</option>${Object.entries(STATE_LABEL).map(([k, v]) => `<option value="${k}" ${k === filters.estado ? 'selected' : ''}>${v}</option>`).join('')}</select>
    </div></div><div class="panel" data-table></div>`;
  const draw = () => {
    const q = filters.q.toLowerCase();
    const scope = filters.activo ? new Set([filters.activo, ...assets.descendants(filters.activo).map(a => a.ID_ACTIVO)]) : null;
    const list = all.filter(e => (!scope || scope.has(e.ID_ACTIVO)) && (!filters.tipo || e.TIPO_EVENTO === filters.tipo) && (!filters.estado || e.ESTADO === filters.estado) &&
      (!q || `${e.ID_EVENTO} ${e.DESCRIPCION} ${e.SINTOMA} ${e.REPORTADO_POR}`.toLowerCase().includes(q)))
      .sort((a, b) => String(b.FECHA_EVENTO).localeCompare(String(a.FECHA_EVENTO)));
    el.querySelector('[data-table]').innerHTML = `<div class="mt-panel-head"><h3>Eventos <span class="muted">(${list.length})</span></h3></div>` + dataTable(list, [
      { label: 'Fecha', html: e => esc(String(e.FECHA_EVENTO).slice(0, 16)) },
      { label: 'Evento', html: e => `<b>${esc(e.ID_EVENTO)}</b>` },
      { label: 'Activo', html: e => esc(assets.get(e.ID_ACTIVO)?.CODIGO_ACTIVO || e.ID_ACTIVO) + (e.ID_COMPONENTE ? `<div class="metric-note">${esc(assets.get(e.ID_COMPONENTE)?.NOMBRE_ACTIVO || '')}</div>` : '') },
      { label: 'Tipo', html: e => esc(catalogs.label('TIPO_EVENTO', e.TIPO_EVENTO)) + (e.CON_PARADA === 'SI' ? ' <span class="status bad">parada</span>' : '') },
      { label: 'Modo de falla', html: e => e.ID_MODO_FALLA ? `${esc(modeLabel(e.ID_MODO_FALLA))}<div>${fmeaBadge(e)}</div>` : '<span class="muted">—</span>' },
      { label: 'Estado', html: e => badge(e.ESTADO, STATE_LABEL[e.ESTADO]) },
      { label: 'OT', html: e => e.ID_OT ? esc(otOfEvent(e.ID_EVENTO)?.NUMERO_OT || e.ID_OT) : '<span class="muted">—</span>' },
      { label: 'Parada', html: e => { const m = cronoMetrics(timesOfEvent(e.ID_EVENTO)); return e.CON_PARADA !== 'SI' ? '<span class="muted">—</span>' : (m?.dt != null ? esc(fmtNumber(m.dt / 60, 1) + ' h') : '<span class="status warn">sin cronología</span>'); } }
    ], { onRowHref: e => `#/mantenimiento/eventos/${e.ID_EVENTO}`, empty: 'Ningún evento coincide con los filtros' });
    bindRowLinks(el.querySelector('[data-table]'));
  };
  draw();
  el.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener(inp.type === 'search' ? 'input' : 'change', () => { filters[inp.dataset.f] = inp.value; draw(); }));
}

export function fmeaBadge(e) {
  if (!e.ID_MODO_FALLA) return '';
  return e.EN_FMEA === 'SI' ? '<span class="status good" title="El modo de falla está analizado en el FMEA">contemplado en FMEA</span>' : '<span class="status warn" title="Falla nueva: se recomienda incorporarla al FMEA">no contemplado en FMEA</span>';
}

/* ------------------------------ Detalle ------------------------------ */

function renderDetail(el, user, id) {
  const e = events.get(id);
  if (!e) { el.innerHTML = emptyState({ icon: '?', title: 'Evento no encontrado', action: '<a class="btn btn-secondary" href="#/mantenimiento/eventos">Volver</a>' }); return; }
  const p = perms(user);
  const a = assets.get(e.ID_ACTIVO), comp = assets.get(e.ID_COMPONENTE);
  const t = timesOfEvent(e.ID_EVENTO), ot = otOfEvent(e.ID_EVENTO);
  const m = cronoMetrics(t);
  const voided = e.ESTADO_REGISTRO === 'ANULADO';
  const coverage = e.ID_MODO_FALLA && e.EN_FMEA === 'NO';
  const fmt = (v, u = 'min') => v === null || v === undefined ? ND : esc(`${fmtNumber(v, 0)} ${u}`);
  el.innerHTML = `
    <div class="mt-breadcrumb"><a href="#/mantenimiento/eventos">Eventos</a> › ${esc(e.ID_EVENTO)}</div>
    <section class="panel mt-detail-head">
      <div><h2>${esc(catalogs.label('TIPO_EVENTO', e.TIPO_EVENTO))} · ${esc(String(e.FECHA_EVENTO).slice(0, 16))} ${voided ? badge('ANULADO') : badge(e.ESTADO, STATE_LABEL[e.ESTADO])}</h2>
        <p class="mt-lead">${esc(e.DESCRIPCION)}</p>
        <div class="mt-chips">
          <span><small>Activo</small><a href="#/mantenimiento/hoja-vida/${esc(e.ID_ACTIVO)}">${esc(assetLabel(a))}</a></span>
          ${comp ? `<span><small>Componente</small>${esc(comp.CODIGO_ACTIVO + ' · ' + comp.NOMBRE_ACTIVO)}</span>` : ''}
          <span><small>Parada</small>${e.CON_PARADA === 'SI' ? 'Sí' : 'No'}</span>
          <span><small>Reportado por</small>${esc(e.REPORTADO_POR)}</span>
          <span><small>Modo de falla</small>${e.ID_MODO_FALLA ? esc(modeLabel(e.ID_MODO_FALLA)) + ' ' + fmeaBadge(e) : '—'}</span>
          <span><small>OT</small>${ot ? `<a href="#/mantenimiento/ot/${esc(ot.ID_OT)}">${esc(ot.NUMERO_OT)}</a>` : '—'}</span>
        </div>
        ${e.SINTOMA ? `<p><b>Síntoma:</b> ${esc(e.SINTOMA)}</p>` : ''}
        ${coverage ? `<div class="mt-alert warn">Este modo de falla <b>no está contemplado en el FMEA</b> del activo. ${p.crear ? '<button class="btn btn-secondary btn-sm" data-to-fmea>Incorporar al FMEA</button>' : ''}</div>` : ''}
      </div>
      ${voided ? '' : `<div class="mt-sheet-actions">
        ${p.editar ? '<button class="btn btn-secondary btn-sm" data-edit>Editar evento</button>' : ''}
        ${!ot && p.crear ? '<button class="btn btn-primary btn-sm" data-new-ot>Crear OT</button>' : ''}
        ${(t ? p.editar : p.crear) && e.CON_PARADA === 'SI' ? `<button class="btn btn-secondary btn-sm" data-crono>${t ? 'Editar cronología' : 'Registrar cronología'}</button>` : ''}
        ${p.anular ? '<button class="btn btn-danger btn-sm" data-void>Anular</button>' : ''}
      </div>`}
    </section>
    ${e.CON_PARADA === 'SI' ? `<section class="panel"><div class="mt-panel-head"><div><h3>Cronología de intervención</h3><div class="metric-note">Los tiempos se calculan a partir de los hitos registrados. Si falta un hito, el indicador aparece como N/D.</div></div></div>
      ${t ? `${interventionBar(t, ms)}
        <div class="mt-kpis mt-kpis-compact mt-kpis-6">
          ${kpi('Tiempo de parada (DT)', fmt(m.dt))}${kpi('Tiempo de respuesta', fmt(m.respuesta))}${kpi('Diagnóstico', fmt(m.diagnostico))}
          ${kpi('Reparación efectiva', fmt(m.reparacion), 'Wrench time')}${kpi('TTR', fmt(m.ttr), 'Llegada → liberación')}${kpi('NTTR', fmt(m.nttr), 'TTR − LT − ST')}
          ${kpi('Tiempo logístico (LT)', fmt(m.lt))}${kpi('Suministro (ST)', fmt(m.st))}${kpi('Demora de producción (PD)', fmt(m.pd))}
          ${kpi('Total de intervención', fmt(m.total), 'Aviso → retorno')}${kpi('Prueba y liberación', fmt(m.prueba))}
          ${kpi('Wrench time / TTR', m.reparacion != null && m.ttr ? esc(fmtNumber(m.reparacion / m.ttr * 100, 0) + ' %') : ND)}
        </div>${t.OBSERVACION_DEMORAS ? `<p class="metric-note"><b>Justificación de esperas:</b> ${esc(t.OBSERVACION_DEMORAS)}</p>` : ''}`
      : emptyState({ icon: '⏱', title: 'Sin cronología', text: 'Registre los hitos de la intervención para calcular tiempo de parada, respuesta, reparación efectiva, TTR y NTTR.' })}
    </section>` : ''}`;

  el.querySelector('[data-edit]')?.addEventListener('click', () => openEventForm(user, { event: e }));
  el.querySelector('[data-new-ot]')?.addEventListener('click', () => openOTForm(user, { preset: { ID_ACTIVO: e.ID_ACTIVO, ID_EVENTO: e.ID_EVENTO, ID_COMPONENTE: e.ID_COMPONENTE, ID_MODO_FALLA: e.ID_MODO_FALLA, SINTOMA: e.SINTOMA, DESCRIPCION: e.DESCRIPCION, TIPO_MTTO: eventClass(data(), e.TIPO_EVENTO) === 'PREVENTIVO' ? 'PREVENTIVO' : 'CORRECTIVO', PRIORIDAD: 'ALTA' } }));
  el.querySelector('[data-crono]')?.addEventListener('click', () => openTimesForm(user, e, t));
  el.querySelector('[data-void]')?.addEventListener('click', () => changeState(user, events, e.ID_EVENTO, 'ANULADO', `el evento ${e.ID_EVENTO}`));
  el.querySelector('[data-to-fmea]')?.addEventListener('click', () => openFMEAForm(user, { preset: { ID_ACTIVO: e.ID_ACTIVO, ID_COMPONENTE: e.ID_COMPONENTE, ID_MODO_FALLA: e.ID_MODO_FALLA, ID_EVENTO_ORIGEN: e.ID_EVENTO, EFECTO_FALLA: e.DESCRIPCION, FALLA_FUNCIONAL: e.SINTOMA } }));
}

/* ------------------------------ Formularios ------------------------------ */

export function openEventForm(user, { event = null, preset = {} } = {}) {
  const editing = !!event;
  openForm({
    title: editing ? `Editar evento ${event.ID_EVENTO}` : 'Registrar evento',
    form: EVENT_FORM, editing, width: 'wide',
    values: editing ? event : { FECHA_EVENTO: fmtMs(nowMs()), CON_PARADA: 'SI', TIPO_EVENTO: 'FALLA', REPORTADO_POR: user?.name || '', ...preset },
    refreshOn: ['ID_ACTIVO'],
    optionsFor: { ID_ACTIVO: assetOptions, ID_COMPONENTE: v => componentOptions(v.ID_ACTIVO), ID_MODO_FALLA: modeOptions },
    hidden: name => name === 'ESTADO' && !editing,
    preview: v => {
      if (!v.ID_MODO_FALLA) return '<span class="muted">Seleccione el modo de falla para verificarlo contra el FMEA.</span>';
      const c = fmeaCoverage(data(), v.ID_ACTIVO, v.ID_COMPONENTE, v.ID_MODO_FALLA);
      return c ? `<span class="status good">Modo de falla contemplado en FMEA</span> <span class="metric-note">${esc(c.ID_FMEA)} · NPR ${esc(c.NPR)}</span>`
        : '<span class="status warn">Modo de falla no contemplado en FMEA</span> <span class="metric-note">Podrá incorporarlo al FMEA desde el detalle del evento.</span>';
    },
    submitLabel: editing ? 'Guardar cambios' : 'Registrar evento',
    onSubmit: async datos => {
      const r = editing ? await events.update(event.ID_EVENTO, datos, user) : await events.create(datos, user);
      toast(editing ? 'Evento actualizado' : `Evento ${r.ID_EVENTO} registrado`);
      location.hash = `#/mantenimiento/eventos/${r.ID_EVENTO}`;
    }
  });
}

export function openTimesForm(user, event, existing) {
  const preventive = eventClass(data(), event.TIPO_EVENTO) === 'PREVENTIVO';
  const form = TIEMPOS_FORM.map((s, i) => i ? s : { ...s, fields: s.fields.map(f => f.name === 'FECHA_HORA_FALLA' ? { ...f, label: preventive ? 'Inicio de la parada' : 'Falla / inicio de la parada' } : f) });
  openForm({
    title: `Cronología de intervención · ${event.ID_EVENTO}`,
    form, editing: !!existing, width: 'wide',
    values: existing || { FECHA_HORA_FALLA: event.FECHA_EVENTO },
    preview: v => {
      const m = cronoMetrics(v);
      const row = (l, x) => `<span><small>${esc(l)}</small>${x === null || x === undefined ? '<span class="mt-nd">N/D</span>' : esc(fmtNumber(x, 0) + ' min')}</span>`;
      return `<b>Cálculo automático</b><div class="mt-chips">${row('Parada (DT)', m.dt)}${row('Respuesta', m.respuesta)}${row('Diagnóstico', m.diagnostico)}${row('Reparación efectiva', m.reparacion)}${row('TTR', m.ttr)}${row('NTTR', m.nttr)}${row('Logístico', m.lt)}${row('Suministro', m.st)}</div>`;
    },
    submitLabel: 'Guardar cronología',
    onSubmit: async datos => {
      if (existing) await times.update(existing.ID_TIEMPO, datos, user);
      else await times.create({ ...datos, ID_EVENTO: event.ID_EVENTO }, user);
      toast('Cronología guardada');
    }
  });
}
