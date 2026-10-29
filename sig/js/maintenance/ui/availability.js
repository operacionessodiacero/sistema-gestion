// Vista "Disponibilidad" por línea de producción o equipo (ISO 14224 y SMRP).
// Línea de tiempo de estados + tiempos acumulados + Ao / At / SMRP + desglose del MTTR (wrench time).
// Para una línea se asume sistema en SERIE: la línea está detenida si cualquiera de sus equipos lo está.
import * as assets from '../services/assets.js';
import * as hierarchy from '../services/hierarchy.js';
import * as catalogs from '../services/catalogs.js';
import { data } from '../services/api.js';
import { availability, failureStats, rangeFor, ms, fmtMs, stopEvents, scopeAssets } from '../domain/reliability.js';
import { esc, ND, emptyState, fmtNumber } from './components.js';
import { stateTimeline, COLORS, hBars } from './charts.js';
import { scopeOptions, scopeLabel } from './options.js';
import { perms } from './actions.js';
import { openPeriodForm } from './plan.js';

const view = { scope: '', range: '90', from: '', to: '' };

export function primaryAction(user) {
  return perms(user).crear ? { label: '+ Periodo de inactividad', run: () => openPeriodForm(user, null, view.scope ? { ID_REFERENCIA: view.scope } : {}) } : null;
}

export function render(el, { user, id }) {
  const opts = scopeOptions();
  if (!opts.length) { el.innerHTML = `<div class="panel">${emptyState({ icon: '◔', title: 'Sin líneas ni equipos', text: 'Cree la jerarquía y los activos en el inventario.' })}</div>`; return; }
  if (id && opts.some(o => o.value === id)) view.scope = id;
  if (!opts.some(o => o.value === view.scope)) view.scope = (opts.find(o => o.label.startsWith('Línea')) || opts[0]).value;
  el.innerHTML = `<div class="panel mt-filters"><div class="toolbar">
      <select data-scope aria-label="Línea o equipo">${['Línea', 'Proceso', 'Activo'].map(g => { const o = opts.filter(x => x.label.startsWith(g)); return o.length ? `<optgroup label="${g === 'Activo' ? 'Equipos' : g + 's'}">${o.map(x => `<option value="${esc(x.value)}" ${x.value === view.scope ? 'selected' : ''}>${esc(x.label.replace(/^(Línea|Proceso|Activo): /, ''))}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>
      ${rangeControls(view)}
    </div></div><div data-block></div>`;
  const draw = () => renderAvailabilityBlock(el.querySelector('[data-block]'), view.scope, view);
  draw();
  el.querySelector('[data-scope]').onchange = e => { view.scope = e.target.value; draw(); };
  bindRange(el, view, draw);
}

export function rangeControls(v) {
  return `<select data-range aria-label="Periodo">${[['last', 'Último evento'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['365', 'Último año'], ['custom', 'Rango personalizado']].map(([k, l]) => `<option value="${k}" ${k === v.range ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <span data-custom ${v.range === 'custom' ? '' : 'hidden'}><input type="date" data-from value="${esc(v.from)}" aria-label="Desde"> a <input type="date" data-to value="${esc(v.to)}" aria-label="Hasta"></span>`;
}
export function bindRange(el, v, draw) {
  const sel = el.querySelector('[data-range]');
  sel.onchange = () => { v.range = sel.value; el.querySelector('[data-custom]').hidden = v.range !== 'custom'; if (v.range !== 'custom' || (v.from && v.to)) draw(); };
  el.querySelector('[data-from]').onchange = e => { v.from = e.target.value; if (v.from && v.to) draw(); };
  el.querySelector('[data-to]').onchange = e => { v.to = e.target.value; if (v.from && v.to) draw(); };
}

// Ventana de análisis: para "último evento" se centra en la última parada registrada
export function windowFor(scopeId, v) {
  if (v.range === 'last') {
    const s = stopEvents(data(), scopeAssets(data(), scopeId)).filter(x => Number.isFinite(x.start)).sort((a, b) => b.start - a.start)[0];
    if (s) { const end = s.end || s.start + 3600000; const pad = Math.max(2 * 3600000, (end - s.start) * 0.5); return [s.start - pad, end + pad]; }
    return rangeFor('30');
  }
  return rangeFor(v.range, v);
}

export function renderAvailabilityBlock(el, scopeId, v) {
  const [from, to] = windowFor(scopeId, v);
  const r = availability(data(), scopeId, from, to);
  const f = failureStats(data(), scopeId, from, to);
  const pct = x => x === null ? ND : `${fmtNumber(x * 100, 2)} %`;
  const isNode = !!hierarchy.get(scopeId);
  const cat = r.lanes.categorias;
  const lanes = [
    { label: 'Operación', color: COLORS.operacion, intervals: r.lanes.operacion, hours: r.Top },
    { label: 'Inactividad (total)', color: COLORS.inactividad, intervals: r.lanes.inactividad, hours: r.Ti },
    ...['NO_REQUIERE_PRODUCCION', 'PARADA_EMERGENCIA_PLANTA', 'PARADA_MAYOR_PLANTA', 'OTRA_INACTIVIDAD'].filter(k => cat[k]?.length)
      .map(k => ({ label: '  · ' + catalogs.label('CATEGORIA_INACTIVIDAD', k), color: COLORS[k], intervals: cat[k], hours: cat[k].reduce((s, [a, b]) => s + b - a, 0) / 3600000 })),
    ...(r.Ts ? [{ label: 'Standby', color: COLORS.standby, intervals: r.lanes.standby, hours: r.Ts }] : []),
    { label: 'Mantenimiento correctivo', color: COLORS.correctivo, intervals: r.lanes.correctivo, hours: r.Tc },
    { label: 'Mantenimiento preventivo', color: COLORS.preventivo, intervals: r.lanes.preventivo, hours: r.Tp }
  ];
  const equipos = isNode ? [...scopeAssets(data(), scopeId)].map(assets.get).filter(a => a && a.NIVEL_JERARQUIA === 'EQUIPO' && a.ESTADO_REGISTRO === 'ACTIVO') : [];
  const perEq = equipos.map(a => ({ a, r: availability(data(), a.ID_ACTIVO, from, to) }));

  el.innerHTML = `
    ${r.incompletos.length ? `<div class="mt-alert warn"><b>Información insuficiente:</b> ${r.incompletos.length} parada(s) sin hora de retorno a servicio. Complete su cronología para calcular la disponibilidad: ${r.incompletos.slice(0, 6).map(e => `<a href="#/mantenimiento/eventos/${esc(e.ID_EVENTO)}">${esc(e.ID_EVENTO)}</a>`).join(', ')}</div>` : ''}
    <section class="panel"><div class="mt-panel-head"><div><h3>Línea de tiempo de estados · ${esc(scopeLabel(scopeId))}</h3><div class="metric-note">${esc(fmtMs(from))} → ${esc(fmtMs(to))} · tiempo calendario ${fmtNumber(r.Tcal, 1)} h${isNode ? ' · línea en serie: se detiene si cualquiera de sus equipos se detiene' : ''}</div></div></div>
      ${stateTimeline(from, to, lanes)}</section>
    <div class="mt-avail">
      <section class="panel"><h3>Tiempos acumulados</h3><table class="mt-table mt-hours"><tbody>
        <tr><td>Tcal — tiempo calendario</td><td>${fmtNumber(r.Tcal, 1)} h</td></tr>
        <tr class="op"><td>Top — tiempo de operación</td><td>${fmtNumber(r.Top, 1)} h</td></tr>
        <tr class="corr"><td>Tc — mantenimiento correctivo</td><td>${fmtNumber(r.Tc, 1)} h</td></tr>
        <tr class="prev"><td>Tp — mantenimiento preventivo</td><td>${fmtNumber(r.Tp, 1)} h</td></tr>
        <tr class="inact"><td>Ti — inactividad</td><td>${fmtNumber(r.Ti, 1)} h</td></tr>
        ${r.Ts ? `<tr><td>Standby (cuenta como Uptime)</td><td>${fmtNumber(r.Ts, 1)} h</td></tr>` : ''}
      </tbody></table></section>
      <section class="panel"><h3>Disponibilidad</h3><div class="mt-avail-cards">
        <div class="mt-avail-card ao"><div><b>Ao</b> — operacional (ISO 14224)</div><div class="mt-formula">(Tcal − Tc − Tp) / Tcal</div><div class="metric-note">Calendario completo; el inactivo cuenta como disponible.</div><div class="value">${pct(r.Ao)}</div></div>
        <div class="mt-avail-card at"><div><b>At</b> — técnica (ISO 14224)</div><div class="mt-formula">(Tcal − Tc) / Tcal</div><div class="metric-note">Calendario; solo descuenta el correctivo.</div><div class="value">${pct(r.At)}</div></div>
        <div class="mt-avail-card smrp"><div><b>SMRP</b> — Uptime / (Uptime + Downtime)</div><div class="mt-formula">(Tcal − Ti − Tc − Tp) / (Tcal − Ti)</div><div class="metric-note">Uptime = operación + standby; saca el inactivo de arriba y de abajo.</div><div class="value">${pct(r.SMRP)}</div></div>
      </div></section>
    </div>
    <section class="panel"><h3>MTTR y tiempo efectivo de reparación (wrench time)</h3>
      <p class="metric-note">No todo el tiempo de reparación es trabajo sobre el equipo: buena parte se va en logística, espera de materiales, permisos y coordinación. El MTTR considera todo el tiempo (activo + logístico); el <b>wrench time</b> es solo la reparación efectiva.</p>
      <div class="mt-kpis mt-kpis-compact mt-kpis-6">
        ${tile('Fallas en el periodo', esc(f.count))}${tile('MTTR', f.mttrMin === null ? ND : esc(fmtNumber(f.mttrMin, 0) + ' min'), 'Llegada → liberación')}
        ${tile('Wrench time medio', f.wrenchMin === null ? ND : esc(fmtNumber(f.wrenchMin, 0) + ' min'), 'Reparación efectiva')}
        ${tile('Logístico + suministro medio', f.logisticMin === null ? ND : esc(fmtNumber(f.logisticMin, 0) + ' min'))}
        ${tile('Wrench time / TTR', f.wrenchShare === null ? ND : esc(fmtNumber(f.wrenchShare * 100, 0) + ' %'))}
        ${tile('MTBF', f.mtbfH === null ? ND : esc(fmtNumber(f.mtbfH, 1) + ' h'), f.mtbfN ? `${f.mtbfN} intervalo(s) entre fallas` : 'Requiere ≥ 2 fallas con retorno')}
      </div></section>
    ${isNode ? `<section class="panel"><h3>Disponibilidad por equipo</h3>${perEq.length ? `<div class="table-wrap"><table class="mt-table"><thead><tr><th>Equipo</th><th>Tc (h)</th><th>Tp (h)</th><th>Ti (h)</th><th>Ao</th><th>At</th><th>SMRP</th></tr></thead><tbody>${perEq.sort((x, y) => (x.r.Ao ?? 2) - (y.r.Ao ?? 2)).map(({ a, r: q }) => `<tr><td><a href="#/mantenimiento/hoja-vida/${esc(a.ID_ACTIVO)}"><b>${esc(a.CODIGO_ACTIVO)}</b> ${esc(a.NOMBRE_ACTIVO)}</a></td><td>${fmtNumber(q.Tc, 1)}</td><td>${fmtNumber(q.Tp, 1)}</td><td>${fmtNumber(q.Ti, 1)}</td><td>${pct(q.Ao)}</td><td>${pct(q.At)}</td><td>${pct(q.SMRP)}</td></tr>`).join('')}</tbody></table></div>
      <h4>Horas de parada por equipo</h4>${hBars(perEq.filter(x => x.r.Tc + x.r.Tp > 0).map(({ a, r: q }) => ({ label: `${a.CODIGO_ACTIVO} ${a.NOMBRE_ACTIVO}`, value: q.Tc + q.Tp, title: `Correctivo ${fmtNumber(q.Tc)} h · Preventivo ${fmtNumber(q.Tp)} h` })).sort((a, b) => b.value - a.value), { unit: 'h', empty: 'Sin paradas en el periodo' })}` : '<p class="muted">La línea no tiene equipos.</p>'}</section>` : ''}`;
}

const tile = (label, value, note = '') => `<div class="card mt-kpi"><div class="label">${esc(label)}</div><div class="value">${value}</div>${note ? `<div class="metric-note">${esc(note)}</div>` : ''}</div>`;
