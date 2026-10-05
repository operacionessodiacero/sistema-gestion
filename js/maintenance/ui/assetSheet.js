// Vista "Hoja de vida del activo". No tiene tabla propia: se arma con todos los registros
// relacionados por ID_ACTIVO (services/assetHistory.js).
import * as assets from '../services/assets.js';
import * as catalogs from '../services/catalogs.js';
import * as documents from '../services/documents.js';
import { recordsFor } from '../services/assetHistory.js';
import { assetKpis } from '../domain/assetKpis.js';
import { data } from '../services/api.js';
import { workOrders, timesOfEvent, modeLabel, staff } from '../services/operations.js';
import { cronoMetrics, failureStats, availability, pareto, monthsBetween, monthRange, rangeFor, ms, nowMs } from '../domain/reliability.js';
import { nprLevel } from '../domain/fmea.js';
import { paretoChart, lineChart, interventionBar } from './charts.js';
import { fmeaBadge, openEventForm } from './events.js';
import { renderAvailabilityBlock, rangeControls, bindRange } from './availability.js';
import { planStatus } from './plan.js';
import { ASSET_FORM } from '../domain/schema.js';
import { LEVEL_LABEL, ASSET_LEVELS } from '../domain/hierarchy.js';
import { esc, ND, kpi, emptyState, badge, critBadge, dataTable, bindRowLinks, fmtNumber, fmtMoney, safeUrl } from './components.js';
import { openAssetForm, openDocumentForm, changeState, perms } from './actions.js';

const TABS = [
  ['resumen', 'Resumen'], ['tecnicos', 'Datos técnicos'], ['historial', 'Historial'], ['fallas', 'Fallas'], ['ot', 'OT'],
  ['fmea', 'FMEA'], ['tiempos', 'Tiempos'], ['repuestos', 'Repuestos'], ['documentos', 'Documentos'], ['indicadores', 'Indicadores']
];
const view = { tab: 'resumen', includeChildren: true, q: '', range: '90', from: '', to: '', crono: '' };

export function primaryAction(user, id) {
  const a = id && assets.get(id);
  if (!a || !perms(user).editar || a.ESTADO_REGISTRO === 'ANULADO') return null;
  return { label: 'Editar activo', run: () => openAssetForm(user, { asset: a }) };
}

export function render(el, { user, id }) {
  if (!id) return renderPicker(el);
  const a = assets.get(id);
  if (!a) {
    el.innerHTML = emptyState({ icon: '?', title: 'Activo no encontrado', text: `No existe un activo con ID ${esc(id)} en los datos cargados.`, action: '<a class="btn btn-secondary" href="#/mantenimiento/activos">Ir al inventario</a>' });
    return;
  }
  const P = perms(user);
  const canEdit = (P.crear || P.editar) && a.ESTADO_REGISTRO !== 'ANULADO';
  const rec = recordsFor(a.ID_ACTIVO, { includeChildren: view.includeChildren });
  const k = assetKpis(rec);
  // Indicadores de confiabilidad del último año, calculados desde eventos y cronologías
  const [y0, y1] = rangeFor('365');
  const fsY = failureStats(data(), a.ID_ACTIVO, y0, y1), avY = availability(data(), a.ID_ACTIVO, y0, y1);
  const fsAll = failureStats(data(), a.ID_ACTIVO, 0, nowMs());
  k.mtbfH = fsY.mtbfH; k.mttrMin = fsY.mttrMin; k.disponibilidad = avY.Ao === null ? null : avY.Ao * 100;
  const dts = rec.EVENTOS.filter(e => e.CON_PARADA === 'SI').map(e => cronoMetrics(timesOfEvent(e.ID_EVENTO))?.dt);
  k.downtimeMin = dts.length && dts.every(x => x !== null && x !== undefined) ? dts.reduce((s2, x) => s2 + x, 0) : (dts.length ? null : 0);
  k.fallas = fsAll.count;
  const nextPlan = rec.PLAN.filter(p => p.ESTADO_REGISTRO === 'ACTIVO').map(p => ({ p, st: planStatus(p) })).sort((x, y) => String(x.p.PROXIMA_EJECUCION || '9').localeCompare(String(y.p.PROXIMA_EJECUCION || '9')))[0];
  if (nextPlan) k.proximoMantenimiento = nextPlan.p.PROXIMA_EJECUCION ? String(nextPlan.p.PROXIMA_EJECUCION).slice(0, 10) : nextPlan.st.label;
  const foto = safeUrl(a.URL_FOTO);
  const path = assets.path(a.ID_PADRE);
  const nextLevel = ASSET_LEVELS[ASSET_LEVELS.indexOf(a.NIVEL_JERARQUIA) + 1];
  const childLevel = a.NIVEL_JERARQUIA === 'SISTEMA' ? 'EQUIPO' : nextLevel;

  el.innerHTML = `
    <section class="panel mt-sheet-head">
      <div class="mt-photo">${foto ? `<img src="${esc(foto)}" alt="Foto de ${esc(a.NOMBRE_ACTIVO)}" referrerpolicy="no-referrer" loading="lazy">` : '<span aria-hidden="true">⚙</span><small>Sin foto</small>'}</div>
      <div class="mt-sheet-id">
        <div class="mt-breadcrumb">${path.map(p => `<a href="${p.isNode ? '#/mantenimiento/activos' : '#/mantenimiento/hoja-vida/' + esc(p.id)}">${esc(p.isNode ? p.name : p.code)}</a>`).join(' › ')}</div>
        <h2><span class="mt-code-lg">${esc(a.CODIGO_ACTIVO)}</span> ${esc(a.NOMBRE_ACTIVO)}</h2>
        <div class="mt-chips">
          <span><small>Nivel</small>${esc(LEVEL_LABEL[a.NIVEL_JERARQUIA])}</span>
          <span><small>Proceso</small>${esc(a.PROCESO || '—')}</span>
          <span><small>Línea</small>${esc(a.LINEA || '—')}</span>
          <span><small>Ubicación</small>${esc(a.UBICACION || '—')}</span>
          <span><small>Estado</small>${badge(a.ESTADO_ACTIVO, catalogs.label('ESTADO_ACTIVO', a.ESTADO_ACTIVO))}${a.ESTADO_REGISTRO !== 'ACTIVO' ? ' ' + badge(a.ESTADO_REGISTRO) : ''}</span>
          <span><small>Criticidad</small>${critBadge(a.CRITICIDAD)} ${esc(a.CRITICIDAD ? catalogs.label('CRITICIDAD', a.CRITICIDAD).replace(/^[A-Z]\s*–\s*/, '') : '')}</span>
        </div>
      </div>
      <div class="mt-sheet-actions">
        ${P.crear && a.ESTADO_REGISTRO === 'ACTIVO' ? '<button class="btn btn-primary btn-sm" data-new-event>+ Registrar evento</button>' : ''}
        ${P.crear && childLevel && a.ESTADO_REGISTRO !== 'ANULADO' ? `<button class="btn btn-secondary btn-sm" data-add-child>+ ${esc(LEVEL_LABEL[childLevel])}</button>` : ''}
        ${canEdit ? '<button class="btn btn-secondary btn-sm" data-add-doc>+ Documento</button>' : ''}
        ${P.inactivar && a.ESTADO_REGISTRO === 'ACTIVO' ? '<button class="btn btn-secondary btn-sm" data-state="INACTIVO">Inactivar</button>' : ''}
        ${P.inactivar && a.ESTADO_REGISTRO === 'INACTIVO' ? '<button class="btn btn-secondary btn-sm" data-state="ACTIVO">Reactivar</button>' : ''}
        ${P.anular && a.ESTADO_REGISTRO !== 'ANULADO' ? '<button class="btn btn-danger btn-sm" data-state="ANULADO">Anular</button>' : ''}
      </div>
    </section>

    <section class="mt-kpis">
      ${kpi('Horas de operación', k.horasOperacion === null ? ND : esc(fmtNumber(k.horasOperacion)), 'Última lectura registrada')}
      ${kpi('Órdenes de trabajo', esc(k.totalOT))}
      ${kpi('Preventivos', esc(k.preventivos))}
      ${kpi('Correctivos', esc(k.correctivos))}
      ${kpi('Fallas', esc(k.fallas))}
      ${kpi('Parada acumulada', k.downtimeMin === null ? ND : esc(fmtNumber(k.downtimeMin / 60, 1) + ' h'))}
      ${kpi('MTBF', k.mtbfH === null ? ND : esc(fmtNumber(k.mtbfH, 1) + ' h'), 'Último año · requiere ≥ 2 fallas con retorno')}
      ${kpi('MTTR', k.mttrMin === null ? ND : esc(fmtNumber(k.mttrMin, 0) + ' min'), 'Último año · llegada → liberación')}
      ${kpi('Disponibilidad Ao', k.disponibilidad === null ? ND : esc(fmtNumber(k.disponibilidad, 1) + ' %'), 'Último año (ISO 14224)')}
      ${kpi('Última intervención', k.ultimaIntervencion ? esc(k.ultimaIntervencion) : '<span class="muted">Sin registros</span>')}
      ${kpi('Próximo mantenimiento', k.proximoMantenimiento ? esc(k.proximoMantenimiento) : '<span class="muted">Sin plan</span>')}
      ${P.verCostos ? kpi('Costo acumulado', esc(fmtMoney(k.costoAcumulado)), (Number(a.COSTO_ADQUISICION) ? `${fmtNumber(k.costoAcumulado / Number(a.COSTO_ADQUISICION) * 100, 1)} % del costo de adquisición` : 'Mano de obra + repuestos + servicios')) : kpi('Costo acumulado', '<span class="muted">Sin permiso</span>')}
    </section>

    <section class="panel">
      <div class="mt-subtabs-bar">
        <nav class="mt-subtabs" role="tablist">${TABS.map(([key, label]) => `<button role="tab" data-tab="${key}" class="${key === view.tab ? 'active' : ''}" aria-selected="${key === view.tab}">${esc(label)}${count(rec, key)}</button>`).join('')}</nav>
        <label class="mt-check" title="Incluye los registros de subequipos y componentes"><input type="checkbox" data-children ${view.includeChildren ? 'checked' : ''}> Incluir componentes</label>
      </div>
      <div data-tab-body>${tabBody(view.tab, a, rec, k, canEdit, P)}</div>
    </section>`;
  el.querySelector('[data-new-event]')?.addEventListener('click', () => openEventForm(user, { preset: { ID_ACTIVO: a.ID_ACTIVO } }));
  if (view.tab === 'indicadores') {
    const box = el.querySelector('[data-avail]');
    const draw = () => { renderAvailabilityBlock(box, a.ID_ACTIVO, view); };
    draw();
    bindRange(el.querySelector('[data-ind-range]'), view, () => render(el, { user, id }));
  }
  el.querySelectorAll('[data-crono]').forEach(b => b.onclick = () => { view.crono = b.dataset.crono; render(el, { user, id }); });

  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { view.tab = b.dataset.tab; render(el, { user, id }); });
  el.querySelector('[data-children]').onchange = e => { view.includeChildren = e.target.checked; render(el, { user, id }); };
  el.querySelector('[data-add-child]')?.addEventListener('click', () => openAssetForm(user, { preset: { NIVEL_JERARQUIA: childLevel, ID_PADRE: a.ID_ACTIVO, AREA: a.AREA, UBICACION: a.UBICACION } }));
  el.querySelector('[data-add-doc]')?.addEventListener('click', () => openDocumentForm(user, a));
  el.querySelectorAll('[data-state]').forEach(b => b.onclick = () => changeState(user, assets, a.ID_ACTIVO, b.dataset.state, `${a.CODIGO_ACTIVO} ${a.NOMBRE_ACTIVO}`));
  el.querySelectorAll('[data-doc-state]').forEach(b => b.onclick = () => changeState(user, documents, b.dataset.id, 'ANULADO', 'el documento'));
  bindRowLinks(el);
}

function count(rec, key) {
  const map = { fallas: (rec.EVENTOS || []).filter(e => e.TIPO_EVENTO === 'FALLA'), ot: rec.OT, fmea: rec.FMEA, tiempos: rec.TIEMPOS, repuestos: rec.REPUESTOS, documentos: rec.DOCUMENTOS };
  if (map[key]) map[key] = map[key].filter(x => x.ESTADO_REGISTRO !== 'ANULADO');
  const n = map[key]?.length;
  return n ? ` <span class="mt-tab-count">${n}</span>` : '';
}

function tabBody(tab, a, rec, k, canEdit, P) {
  switch (tab) {
    case 'resumen': return resumen(a);
    case 'tecnicos': return tecnicos(a);
    case 'historial': return historial(a, rec);
    case 'documentos': return documentos(a, rec, canEdit);
    case 'fallas': return fallas(rec);
    case 'ot': return ots(rec, P);
    case 'fmea': return fmeaTab(rec);
    case 'tiempos': return tiempos(rec);
    case 'repuestos': return repuestos(rec, P);
    case 'indicadores': return indicadores(a, rec);
    default: return '';
  }
}

const pending = (title, text) => emptyState({ icon: '○', title, text: esc(text) });

function resumen(a) {
  const hijos = assets.descendants(a.ID_ACTIVO).filter(x => x.ESTADO_REGISTRO !== 'ANULADO');
  const datos = [
    ['Tipo', catalogs.label('TIPO_ACTIVO', a.TIPO_ACTIVO)], ['Área', a.AREA], ['Responsable', a.RESPONSABLE],
    ['Fabricante / marca', [a.FABRICANTE, a.MARCA].filter(Boolean).join(' / ')], ['Modelo', a.MODELO], ['Serial', a.SERIAL],
    ['Instalación', a.FECHA_INSTALACION], ['Registrado', [a.FECHA_CREACION, a.CREADO_POR].filter(Boolean).join(' · ')]
  ];
  return `<div class="grid2">
    <div><h4>Ficha rápida</h4>${defList(datos)}${a.OBSERVACIONES ? `<p class="mt-obs">${esc(a.OBSERVACIONES)}</p>` : ''}</div>
    <div><h4>Estructura (${hijos.length} subequipo/componente${hijos.length === 1 ? '' : 's'})</h4>${hijos.length
      ? dataTable(hijos, [
        { label: 'Código', html: x => `<b>${esc(x.CODIGO_ACTIVO)}</b>` }, { label: 'Nombre', key: 'NOMBRE_ACTIVO' },
        { label: 'Nivel', html: x => esc(LEVEL_LABEL[x.NIVEL_JERARQUIA]) }, { label: 'Estado', html: x => badge(x.ESTADO_ACTIVO, catalogs.label('ESTADO_ACTIVO', x.ESTADO_ACTIVO)) }
      ], { onRowHref: x => `#/mantenimiento/hoja-vida/${x.ID_ACTIVO}` })
      : '<p class="muted">No tiene subequipos ni componentes registrados.</p>'}</div>
  </div>`;
}

function tecnicos(a) {
  return ASSET_FORM.filter(s => s.title !== 'Documentación').map(s => {
    const items = s.fields.filter(f => f.type !== 'parent').map(f => [f.label, display(f, a[f.name])]);
    return `<h4>${esc(s.title)}</h4>${defList(items, true)}`;
  }).join('');
}

function display(f, v) {
  if (v === '' || v === undefined || v === null) return '';
  if (f.type === 'cat') return catalogs.label(f.cat, v);
  if (f.type === 'select') return LEVEL_LABEL[v] || v;
  if (f.name === 'COSTO_ADQUISICION') return fmtMoney(v);
  if (f.type === 'number') return fmtNumber(v, 2);
  return String(v);
}

function defList(items, showEmpty = false) {
  const rows = items.filter(([, v]) => showEmpty || (v !== '' && v !== undefined && v !== null));
  if (!rows.length) return '<p class="muted">Sin datos.</p>';
  return `<dl class="mt-dl">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v === '' || v === undefined || v === null ? '<span class="muted">—</span>' : esc(v)}</dd></div>`).join('')}</dl>`;
}

function historial(a, rec) {
  const items = [];
  const push = (fecha, tipo, texto, href) => fecha && items.push({ fecha: String(fecha), tipo, texto, href });
  push(a.FECHA_INSTALACION, 'Instalación', 'Fecha de instalación del activo');
  push(a.FECHA_ADQUISICION, 'Adquisición', a.PROVEEDOR ? `Proveedor: ${a.PROVEEDOR}` : 'Fecha de adquisición');
  push(a.FECHA_CREACION, 'Alta en el sistema', `Registrado por ${a.CREADO_POR || '—'}`);
  push(a.FECHA_MODIFICACION, 'Modificación', `Datos actualizados por ${a.MODIFICADO_POR || '—'}`);
  for (const d of rec.DOCUMENTOS || []) push(d.FECHA_DOCUMENTO || d.FECHA_CREACION, 'Documento', `${catalogs.label('TIPO_DOCUMENTO', d.TIPO_DOCUMENTO)}: ${d.TITULO}`);
  for (const e of rec.EVENTOS || []) push(e.FECHA_EVENTO, 'Evento', `${e.TIPO_EVENTO}: ${e.DESCRIPCION || ''}`);
  for (const o of rec.OT || []) push(o.FECHA_INICIO || o.FECHA_SOLICITUD, 'OT', `${o.NUMERO_OT || o.ID_OT} · ${o.TIPO_MTTO}: ${o.DESCRIPCION || ''}`);
  items.sort((x, y) => y.fecha.localeCompare(x.fecha));
  if (!items.length) return pending('Sin historial', 'El historial se construye con las fechas del activo, sus documentos, eventos y OT.');
  return `<ol class="mt-timeline">${items.map(i => `<li><time>${esc(i.fecha)}</time><b>${esc(i.tipo)}</b><span>${esc(i.texto)}</span></li>`).join('')}</ol>`;
}

function documentos(a, rec, canEdit) {
  const fixed = [['Foto', a.URL_FOTO], ['Manual', a.URL_MANUAL], ['Ficha técnica', a.URL_FICHA_TECNICA], ['Planos', a.URL_PLANOS]].filter(([, u]) => safeUrl(u));
  const docs = rec.DOCUMENTOS || [];
  if (!fixed.length && !docs.length) return pending('Sin documentos', 'Agregue enlaces a manuales, fichas técnicas, planos o fotos (Google Drive, SharePoint, etc.).');
  return `${fixed.length ? `<h4>Enlaces de la ficha</h4><ul class="mt-links">${fixed.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)} ↗</a></li>`).join('')}</ul>` : ''}
    ${docs.length ? `<h4>Documentos registrados</h4>${dataTable(docs, [
      { label: 'Tipo', html: d => esc(catalogs.label('TIPO_DOCUMENTO', d.TIPO_DOCUMENTO)) },
      { label: 'Título', html: d => safeUrl(d.URL) ? `<a href="${esc(d.URL)}" target="_blank" rel="noopener noreferrer">${esc(d.TITULO)} ↗</a>` : esc(d.TITULO) },
      { label: 'Activo', html: d => esc(assets.get(d.ID_ACTIVO)?.CODIGO_ACTIVO || d.ID_ACTIVO) },
      { label: 'Fecha', key: 'FECHA_DOCUMENTO' },
      { label: '', html: d => canEdit ? `<button class="btn btn-secondary btn-sm" data-doc-state data-id="${esc(d.ID_DOCUMENTO)}">Anular</button>` : '' }
    ])}` : ''}`;
}

const aName = id => { const x = assets.get(id); return x ? `${x.CODIGO_ACTIVO} ${x.NOMBRE_ACTIVO}` : id; };

function fallas(rec) {
  const list = rec.EVENTOS.filter(e => e.TIPO_EVENTO === 'FALLA').sort((x, y) => String(y.FECHA_EVENTO).localeCompare(String(x.FECHA_EVENTO)));
  if (!list.length) return pending('Sin fallas registradas', 'Las fallas se registran como eventos del activo y alimentan MTBF, Pareto y FMEA.');
  const par = pareto(list, e => e.ID_MODO_FALLA || 'SIN_MODO');
  return `<div class="grid2"><div><h4>Pareto de fallas del activo</h4>${paretoChart(par, k => k === 'SIN_MODO' ? 'Sin modo' : modeLabel(k).replace(/^\S+ · /, ''))}</div><div>${dataTable(list, [
    { label: 'Fecha', html: e => esc(String(e.FECHA_EVENTO).slice(0, 16)) },
    { label: 'Componente', html: e => esc(e.ID_COMPONENTE ? aName(e.ID_COMPONENTE) : aName(e.ID_ACTIVO)) },
    { label: 'Modo', html: e => e.ID_MODO_FALLA ? esc(modeLabel(e.ID_MODO_FALLA)) + '<br>' + fmeaBadge(e) : '<span class="muted">—</span>' },
    { label: 'Parada', html: e => { const m = cronoMetrics(timesOfEvent(e.ID_EVENTO)); return m?.dt != null ? esc(fmtNumber(m.dt / 60, 1) + ' h') : '<span class="muted">—</span>'; } },
    { label: 'Descripción', html: e => esc(String(e.DESCRIPCION).slice(0, 60)) }
  ], { onRowHref: e => `#/mantenimiento/eventos/${e.ID_EVENTO}` })}</div></div>`;
}

function ots(rec, P) {
  const list = rec.OT.slice().sort((x, y) => String(y.FECHA_SOLICITUD).localeCompare(String(x.FECHA_SOLICITUD)));
  if (!list.length) return pending('Sin órdenes de trabajo vinculadas', 'Las OT del activo (y de sus componentes) aparecen aquí con su costo.');
  return dataTable(list, [
    { label: 'Número', html: o => `<b>${esc(o.NUMERO_OT)}</b>` }, { label: 'Solicitud', html: o => esc(String(o.FECHA_SOLICITUD).slice(0, 10)) },
    { label: 'Tipo', html: o => esc(catalogs.label('TIPO_MTTO', o.TIPO_MTTO)) }, { label: 'Descripción', html: o => esc(String(o.DESCRIPCION).slice(0, 70)) },
    { label: 'Estado', html: o => badge(o.ESTADO === 'CERRADA' ? 'CERRADA' : 'ABIERTA', o.ESTADO) }, { label: 'HH', html: o => esc(fmtNumber(o.HORAS_HOMBRE || 0, 1)) },
    ...(P.verCostos ? [{ label: 'Costo', html: o => esc(fmtMoney(o.COSTO_TOTAL || 0)) }] : [])
  ], { onRowHref: o => `#/mantenimiento/ot/${o.ID_OT}` });
}

function fmeaTab(rec) {
  const list = rec.FMEA.slice().sort((x, y) => Number(y.NPR) - Number(x.NPR));
  if (!list.length) return pending('Sin análisis FMEA', 'Analice los modos de falla del activo y sus componentes en Mantenimiento → FMEA.');
  return dataTable(list, [
    { label: 'NPR', html: f => `<span class="status ${nprLevel(f.NPR)}">${esc(f.NPR)}</span>` }, { label: 'Componente', html: f => esc(f.COMPONENTE || aName(f.ID_ACTIVO)) },
    { label: 'Modo', key: 'MODO_FALLA' }, { label: 'Efecto', key: 'EFECTO_FALLA' }, { label: 'Causa', key: 'CAUSA_POTENCIAL' }, { label: 'Acción', key: 'ACCION_RECOMENDADA' }
  ]);
}

function tiempos(rec) {
  const list = rec.TIEMPOS.slice().sort((x, y) => String(y.FECHA_HORA_FALLA).localeCompare(String(x.FECHA_HORA_FALLA)));
  if (!list.length) return pending('Sin cronologías de intervención', 'Registre la cronología desde el detalle de cada evento con parada.');
  const sel = list.find(t => t.ID_TIEMPO === view.crono) || list[0];
  const m = cronoMetrics(sel);
  const n = v => v === null || v === undefined ? '<span class="mt-nd">N/D</span>' : esc(fmtNumber(v, 0));
  return `<div class="mt-crono-pick">${list.slice(0, 12).map(t => `<button class="${t === sel ? 'active' : ''}" data-crono="${esc(t.ID_TIEMPO)}">${esc(String(t.FECHA_HORA_FALLA).slice(0, 10))} · ${esc(t.ID_EVENTO)}</button>`).join('')}</div>
    <h4>Línea de tiempo CMD · <a href="#/mantenimiento/eventos/${esc(sel.ID_EVENTO)}">${esc(sel.ID_EVENTO)}</a></h4>${interventionBar(sel, ms)}
    ${dataTable(list, [
      { label: 'Inicio', html: t => esc(String(t.FECHA_HORA_FALLA).slice(0, 16)) }, { label: 'Evento', key: 'ID_EVENTO' },
      { label: 'DT (min)', html: t => n(cronoMetrics(t).dt) }, { label: 'Respuesta', html: t => n(cronoMetrics(t).respuesta) },
      { label: 'Diagnóstico', html: t => n(cronoMetrics(t).diagnostico) }, { label: 'Reparación', html: t => n(cronoMetrics(t).reparacion) },
      { label: 'TTR', html: t => n(cronoMetrics(t).ttr) }, { label: 'NTTR', html: t => n(cronoMetrics(t).nttr) }, { label: 'LT', html: t => n(cronoMetrics(t).lt) }, { label: 'ST', html: t => n(cronoMetrics(t).st) }
    ], { onRowHref: t => `#/mantenimiento/eventos/${t.ID_EVENTO}` })}`;
}

function repuestos(rec, P) {
  const list = rec.REPUESTOS;
  if (!list.length) return pending('Sin repuestos consumidos', 'Los repuestos usados en sus OT se suman aquí con su costo.');
  return dataTable(list, [
    { label: 'OT', html: r => esc(workOrders.get(r.ID_OT)?.NUMERO_OT || r.ID_OT) }, { label: 'Código', key: 'CODIGO_REPUESTO' }, { label: 'Descripción', key: 'DESCRIPCION' },
    { label: 'Cantidad', html: r => esc(fmtNumber(r.CANTIDAD, 2) + ' ' + catalogs.label('UNIDAD_REPUESTO', r.UNIDAD)) },
    ...(P.verCostos ? [{ label: 'Total', html: r => esc(fmtMoney(r.COSTO_TOTAL)) }] : [])
  ], { onRowHref: r => `#/mantenimiento/ot/${r.ID_OT}` });
}

function indicadores(a, rec) {
  const [from, to] = rangeFor('365');
  const months = monthsBetween(from, to);
  const per = months.map(key => { const [m0, m1] = monthRange(key); const fs = failureStats(data(), a.ID_ACTIVO, m0, m1); return { mtbf: fs.mtbfH, mttr: fs.mttrMin, dt: fs.dtMin === null ? null : fs.dtMin / 60, n: fs.count }; });
  return `<div class="toolbar" data-ind-range>${rangeControls(view)}</div><div data-avail></div>
    <div class="grid2">
      <section><h4>Histórico de MTBF (h) y MTTR (min) por mes</h4>${lineChart(months, [{ name: 'MTBF (h)', color: '#2e9d4f', values: per.map(p => p.mtbf) }, { name: 'MTTR (min)', color: '#d93025', values: per.map(p => p.mttr) }])}</section>
      <section><h4>Tendencia de downtime por fallas (h)</h4>${lineChart(months, [{ name: 'Horas de parada', color: '#1a5fd0', values: per.map(p => p.n ? p.dt : 0) }], { unit: 'h' })}</section>
    </div>`;
}

// Selector cuando se entra a "Hoja de vida" sin activo
function renderPicker(el) {
  const list = assets.list();
  if (!list.length) {
    el.innerHTML = emptyState({ icon: '⚙', title: 'Seleccione un activo', text: 'Aún no hay activos. Créelos en el inventario para ver su hoja de vida.', action: '<a class="btn btn-primary" href="#/mantenimiento/activos">Ir al inventario</a>' });
    return;
  }
  el.innerHTML = `<div class="panel"><div class="mt-panel-head"><h3>Seleccione un activo</h3><input type="search" data-q placeholder="Buscar por código o nombre" value="${esc(view.q)}" aria-label="Buscar activo"></div><div data-list></div></div>`;
  const draw = () => {
    const q = view.q.toLowerCase();
    const rows = list.filter(a => !q || `${a.CODIGO_ACTIVO} ${a.NOMBRE_ACTIVO} ${a.LINEA} ${a.PROCESO}`.toLowerCase().includes(q))
      .sort((x, y) => String(x.CODIGO_ACTIVO).localeCompare(String(y.CODIGO_ACTIVO)));
    el.querySelector('[data-list]').innerHTML = dataTable(rows, [
      { label: 'Código', html: a => `<b>${esc(a.CODIGO_ACTIVO)}</b>` }, { label: 'Nombre', key: 'NOMBRE_ACTIVO' },
      { label: 'Nivel', html: a => esc(LEVEL_LABEL[a.NIVEL_JERARQUIA]) }, { label: 'Proceso', key: 'PROCESO' }, { label: 'Línea', html: a => esc(a.LINEA || '—') }
    ], { onRowHref: a => `#/mantenimiento/hoja-vida/${a.ID_ACTIVO}`, empty: 'Sin coincidencias' });
    bindRowLinks(el);
  };
  draw();
  el.querySelector('[data-q]').oninput = e => { view.q = e.target.value; draw(); };
}
