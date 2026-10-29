// Vista "Órdenes de trabajo": OT vinculadas a activos, eventos y planes; mano de obra (horas hombre
// valoradas con la tarifa vigente de cada persona) y repuestos. Los costos los calcula el servidor.
import * as assets from '../services/assets.js';
import * as catalogs from '../services/catalogs.js';
import { workOrders, labor, parts, staff, events, plans, laborOfOT, partsOfOT, modeLabel } from '../services/operations.js';
import { OT_FORM, LABOR_FORM, PART_FORM } from '../domain/schema.js';
import { esc, kpi, emptyState, dataTable, bindRowLinks, badge, fmtNumber, fmtMoney } from './components.js';
import { openForm } from './form.js';
import { perms, changeState } from './actions.js';
import { assetOptions, componentOptions, modeOptions, eventOptions, planOptions, personOptions, assetLabel } from './options.js';
import { toast } from '../../ui.js';

const filters = { estado: 'ABIERTAS', tipo: '', activo: '', q: '' };
const STATE = { ABIERTA: 'Abierta', PROGRAMADA: 'Programada', EN_EJECUCION: 'En ejecución', EN_ESPERA: 'En espera', CERRADA: 'Cerrada' };
const today = () => new Date().toISOString().slice(0, 10);

export function primaryAction(user) {
  return perms(user).crear ? { label: '+ Nueva OT', run: () => openOTForm(user) } : null;
}

export function render(el, { user, id }) {
  if (id) return renderDetail(el, user, id);
  const p = perms(user);
  const all = workOrders.all();
  if (!all.length) {
    el.innerHTML = `<div class="panel">${emptyState({ icon: '🛠', title: 'Sin órdenes de trabajo', text: 'Cree una OT desde un evento (falla, inspección) o desde el plan preventivo. Cada OT queda enlazada al activo y acumula horas hombre, repuestos y costos.', action: p.crear ? '<button class="btn btn-primary" data-new>+ Nueva OT</button>' : '' })}</div>`;
    el.querySelector('[data-new]')?.addEventListener('click', () => openOTForm(user));
    return;
  }
  const hoy = today();
  el.innerHTML = `<div class="panel mt-filters"><div class="toolbar">
      <input type="search" data-f="q" placeholder="Buscar número, descripción, responsable…" value="${esc(filters.q)}" aria-label="Buscar">
      <select data-f="estado" aria-label="Estado"><option value="ABIERTAS" ${filters.estado === 'ABIERTAS' ? 'selected' : ''}>Pendientes (no cerradas)</option><option value="" ${filters.estado === '' ? 'selected' : ''}>Todas</option>${Object.entries(STATE).map(([k, v]) => `<option value="${k}" ${k === filters.estado ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select data-f="tipo" aria-label="Tipo"><option value="">Tipo: todos</option>${catalogs.options('TIPO_MTTO').map(o => `<option value="${esc(o.value)}" ${o.value === filters.tipo ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
      <select data-f="activo" aria-label="Activo"><option value="">Activo: todos</option>${assetOptions().map(o => `<option value="${esc(o.value)}" ${o.value === filters.activo ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
    </div></div><div class="panel" data-table></div>`;
  const draw = () => {
    const q = filters.q.toLowerCase();
    const list = all.filter(o => (filters.estado === 'ABIERTAS' ? o.ESTADO !== 'CERRADA' : !filters.estado || o.ESTADO === filters.estado) &&
      (!filters.tipo || o.TIPO_MTTO === filters.tipo) && (!filters.activo || o.ID_ACTIVO === filters.activo) &&
      (!q || `${o.NUMERO_OT} ${o.DESCRIPCION} ${o.RESPONSABLE}`.toLowerCase().includes(q)))
      .sort((a, b) => String(b.FECHA_SOLICITUD).localeCompare(String(a.FECHA_SOLICITUD)) || String(b.NUMERO_OT).localeCompare(String(a.NUMERO_OT)));
    el.querySelector('[data-table]').innerHTML = `<div class="mt-panel-head"><h3>Órdenes de trabajo <span class="muted">(${list.length})</span></h3></div>` + dataTable(list, [
      { label: 'Número', html: o => `<b>${esc(o.NUMERO_OT)}</b>` },
      { label: 'Solicitud', html: o => esc(String(o.FECHA_SOLICITUD).slice(0, 10)) },
      { label: 'Activo', html: o => esc(assets.get(o.ID_ACTIVO)?.CODIGO_ACTIVO || o.ID_ACTIVO) },
      { label: 'Tipo', html: o => esc(catalogs.label('TIPO_MTTO', o.TIPO_MTTO)) },
      { label: 'Prioridad', html: o => esc(catalogs.label('PRIORIDAD', o.PRIORIDAD)) },
      { label: 'Descripción', html: o => esc(String(o.DESCRIPCION).slice(0, 80)) },
      { label: 'Programada', html: o => o.FECHA_PROGRAMADA ? esc(String(o.FECHA_PROGRAMADA).slice(0, 10)) + (o.ESTADO !== 'CERRADA' && String(o.FECHA_PROGRAMADA).slice(0, 10) < hoy ? ' <span class="status bad">vencida</span>' : '') : '<span class="muted">—</span>' },
      { label: 'Estado', html: o => badge(o.ESTADO === 'CERRADA' ? 'CERRADA' : 'ABIERTA', STATE[o.ESTADO]) + (o.ESTADO_REGISTRO !== 'ACTIVO' ? ' ' + badge(o.ESTADO_REGISTRO) : '') },
      { label: 'HH', html: o => esc(fmtNumber(o.HORAS_HOMBRE || 0, 1)) },
      ...(p.verCostos ? [{ label: 'Costo', html: o => esc(fmtMoney(o.COSTO_TOTAL || 0)) }] : [])
    ], { onRowHref: o => `#/mantenimiento/ot/${o.ID_OT}`, empty: 'Ninguna OT coincide con los filtros' });
    bindRowLinks(el.querySelector('[data-table]'));
  };
  draw();
  el.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener(inp.type === 'search' ? 'input' : 'change', () => { filters[inp.dataset.f] = inp.value; draw(); }));
}

function renderDetail(el, user, id) {
  const o = workOrders.get(id);
  if (!o) { el.innerHTML = emptyState({ icon: '?', title: 'OT no encontrada', action: '<a class="btn btn-secondary" href="#/mantenimiento/ot">Volver</a>' }); return; }
  const p = perms(user);
  const a = assets.get(o.ID_ACTIVO);
  const closed = o.ESTADO === 'CERRADA', voided = o.ESTADO_REGISTRO === 'ANULADO';
  const editable = !voided && p.editar && (!closed || p.cerrarOT);
  const mo = laborOfOT(o.ID_OT), rp = partsOfOT(o.ID_OT);
  const ev = events.get(o.ID_EVENTO), plan = plans.get(o.ID_PLAN);
  const field = (l, v) => v ? `<div><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>` : '';
  el.innerHTML = `
    <div class="mt-breadcrumb"><a href="#/mantenimiento/ot">Órdenes de trabajo</a> › ${esc(o.NUMERO_OT)}</div>
    <section class="panel mt-detail-head">
      <div><h2><span class="mt-code-lg">${esc(o.NUMERO_OT)}</span> ${esc(catalogs.label('TIPO_MTTO', o.TIPO_MTTO))} ${badge(closed ? 'CERRADA' : 'ABIERTA', STATE[o.ESTADO])} ${voided ? badge('ANULADO') : ''}</h2>
        <p class="mt-lead">${esc(o.DESCRIPCION)}</p>
        <div class="mt-chips">
          <span><small>Activo</small><a href="#/mantenimiento/hoja-vida/${esc(o.ID_ACTIVO)}">${esc(assetLabel(a))}</a></span>
          <span><small>Prioridad</small>${esc(catalogs.label('PRIORIDAD', o.PRIORIDAD))}</span>
          <span><small>Responsable</small>${esc(o.RESPONSABLE)}</span>
          <span><small>Solicitud</small>${esc(String(o.FECHA_SOLICITUD).slice(0, 10))}</span>
          ${o.FECHA_PROGRAMADA ? `<span><small>Programada</small>${esc(String(o.FECHA_PROGRAMADA).slice(0, 10))}</span>` : ''}
          ${ev ? `<span><small>Evento</small><a href="#/mantenimiento/eventos/${esc(ev.ID_EVENTO)}">${esc(ev.ID_EVENTO)}</a></span>` : ''}
          ${plan ? `<span><small>Plan</small>${esc(plan.ACTIVIDAD)}</span>` : ''}
        </div>
      </div>
      ${voided ? '' : `<div class="mt-sheet-actions">
        ${editable ? '<button class="btn btn-secondary btn-sm" data-edit>Editar / registrar ejecución</button>' : ''}
        ${!closed && p.cerrarOT ? '<button class="btn btn-primary btn-sm" data-close>Cerrar OT</button>' : ''}
        ${closed && p.cerrarOT ? '<button class="btn btn-secondary btn-sm" data-reopen>Reabrir</button>' : ''}
        ${p.anular ? '<button class="btn btn-danger btn-sm" data-void>Anular</button>' : ''}
      </div>`}
    </section>
    <section class="mt-kpis mt-kpis-compact">
      ${kpi('Horas hombre', esc(fmtNumber(o.HORAS_HOMBRE || 0, 1)))}
      ${p.verCostos ? `${kpi('Mano de obra', esc(fmtMoney(o.COSTO_MANO_OBRA || 0)))}${kpi('Repuestos', esc(fmtMoney(o.COSTO_REPUESTOS || 0)))}${kpi('Costo total', esc(fmtMoney(o.COSTO_TOTAL || 0)), o.COSTO_SERVICIOS ? 'Incluye servicios: ' + fmtMoney(o.COSTO_SERVICIOS) : '')}` : kpi('Costos', '<span class="muted">Sin permiso</span>')}
    </section>
    <div class="grid2">
      <section class="panel"><h3>Ejecución</h3><dl class="mt-dl">${field('Inicio', String(o.FECHA_INICIO || '').slice(0, 16))}${field('Fin', String(o.FECHA_FIN || '').slice(0, 16))}${field('Diagnóstico', o.DIAGNOSTICO)}${field('Trabajo realizado', o.TRABAJO_REALIZADO)}</dl>${!o.FECHA_INICIO && !o.TRABAJO_REALIZADO ? '<p class="muted">Sin ejecución registrada.</p>' : ''}</section>
      <section class="panel"><h3>Análisis de falla y causa raíz</h3><dl class="mt-dl">${field('Componente', assets.get(o.ID_COMPONENTE)?.NOMBRE_ACTIVO)}${field('Modo de falla', o.ID_MODO_FALLA ? modeLabel(o.ID_MODO_FALLA) : '')}${field('Síntoma', o.SINTOMA)}${field('Causa inmediata', o.CAUSA_INMEDIATA)}${field('Causa raíz', o.CAUSA_RAIZ)}${field('Clasificación', o.CLASIFICACION_CAUSA ? catalogs.label('CLASIFICACION_CAUSA', o.CLASIFICACION_CAUSA) : '')}${field('Acción correctiva', o.ACCION_CORRECTIVA)}${field('Acción preventiva', o.ACCION_PREVENTIVA)}${field('Lección aprendida', o.LECCION_APRENDIDA)}</dl>${!o.CAUSA_INMEDIATA && !o.CAUSA_RAIZ ? '<p class="muted">Sin análisis registrado.</p>' : ''}</section>
    </div>
    <section class="panel"><div class="mt-panel-head"><h3>Mano de obra</h3>${!closed && !voided && p.crear ? '<button class="btn btn-secondary btn-sm" data-add-labor>+ Horas hombre</button>' : ''}</div>
      ${dataTable(mo, [
        { label: 'Fecha', html: m => esc(String(m.FECHA).slice(0, 10)) },
        { label: 'Persona', html: m => esc(staff.get(m.ID_PERSONA)?.NOMBRE || m.ID_PERSONA) },
        { label: 'Actividad', key: 'ACTIVIDAD' },
        { label: 'Horas', html: m => esc(fmtNumber(m.HORAS, 2)) },
        ...(p.verCostos ? [{ label: 'Valor hora', html: m => esc(fmtMoney(m.VALOR_HORA)) }, { label: 'Costo', html: m => esc(fmtMoney(m.COSTO)) }] : []),
        { label: '', html: m => !closed && p.anular && m.ESTADO_REGISTRO === 'ACTIVO' ? `<button class="btn btn-secondary btn-sm" data-void-labor="${esc(m.ID_MANO_OBRA)}">Anular</button>` : (m.ESTADO_REGISTRO !== 'ACTIVO' ? badge(m.ESTADO_REGISTRO) : '') }
      ], { empty: 'Sin horas hombre registradas' })}
    </section>
    <section class="panel"><div class="mt-panel-head"><h3>Repuestos y materiales</h3>${!closed && !voided && p.crear ? '<button class="btn btn-secondary btn-sm" data-add-part>+ Repuesto</button>' : ''}</div>
      ${dataTable(rp, [
        { label: 'Código', key: 'CODIGO_REPUESTO' }, { label: 'Descripción', key: 'DESCRIPCION' },
        { label: 'Cantidad', html: r => esc(fmtNumber(r.CANTIDAD, 2) + ' ' + catalogs.label('UNIDAD_REPUESTO', r.UNIDAD)) },
        ...(p.verCostos ? [{ label: 'Costo unitario', html: r => esc(fmtMoney(r.COSTO_UNITARIO)) }, { label: 'Total', html: r => esc(fmtMoney(r.COSTO_TOTAL)) }] : []),
        { label: '', html: r => !closed && p.anular && r.ESTADO_REGISTRO === 'ACTIVO' ? `<button class="btn btn-secondary btn-sm" data-void-part="${esc(r.ID_CONSUMO)}">Anular</button>` : (r.ESTADO_REGISTRO !== 'ACTIVO' ? badge(r.ESTADO_REGISTRO) : '') }
      ], { empty: 'Sin repuestos registrados' })}
      <p class="metric-note">Preparado para integrarse con Almacén mediante el código del repuesto.</p>
    </section>`;

  el.querySelector('[data-edit]')?.addEventListener('click', () => openOTForm(user, { ot: o }));
  el.querySelector('[data-close]')?.addEventListener('click', () => openOTForm(user, { ot: o, closing: true }));
  el.querySelector('[data-reopen]')?.addEventListener('click', async () => {
    try { await workOrders.update(o.ID_OT, { ESTADO: 'EN_EJECUCION' }, user); toast('OT reabierta'); } catch (e) { toast(e.message); }
  });
  el.querySelector('[data-void]')?.addEventListener('click', () => changeState(user, workOrders, o.ID_OT, 'ANULADO', `la OT ${o.NUMERO_OT}`));
  el.querySelector('[data-add-labor]')?.addEventListener('click', () => openForm({
    title: `Horas hombre · ${o.NUMERO_OT}`, form: LABOR_FORM, values: { FECHA: today() },
    optionsFor: { ID_PERSONA: personOptions },
    onSubmit: async d => { await labor.create({ ...d, ID_OT: o.ID_OT }, user); toast('Horas registradas'); }
  }));
  el.querySelector('[data-add-part]')?.addEventListener('click', () => openForm({
    title: `Repuesto · ${o.NUMERO_OT}`, form: PART_FORM, values: { UNIDAD: 'UND' },
    onSubmit: async d => { await parts.create({ ...d, ID_OT: o.ID_OT }, user); toast('Repuesto registrado'); }
  }));
  el.querySelectorAll('[data-void-labor]').forEach(b => b.onclick = () => changeState(user, labor, b.dataset.voidLabor, 'ANULADO', 'el registro de horas'));
  el.querySelectorAll('[data-void-part]').forEach(b => b.onclick = () => changeState(user, parts, b.dataset.voidPart, 'ANULADO', 'el repuesto'));
}

export function openOTForm(user, { ot = null, preset = {}, closing = false } = {}) {
  const editing = !!ot;
  const p = perms(user);
  openForm({
    title: closing ? `Cerrar ${ot.NUMERO_OT}` : editing ? `Editar ${ot.NUMERO_OT}` : 'Nueva orden de trabajo',
    form: OT_FORM, editing, width: 'wide',
    values: editing ? { ...ot, ...(closing ? { ESTADO: 'CERRADA' } : {}) } : { FECHA_SOLICITUD: today(), PRIORIDAD: 'MEDIA', TIPO_MTTO: 'CORRECTIVO', RESPONSABLE: user?.name || '', ESTADO: 'ABIERTA', ...preset },
    refreshOn: ['ID_ACTIVO'],
    optionsFor: { ID_ACTIVO: assetOptions, ID_COMPONENTE: v => componentOptions(v.ID_ACTIVO), ID_MODO_FALLA: modeOptions, ID_EVENTO: v => eventOptions(v.ID_ACTIVO), ID_PLAN: v => planOptions(v.ID_ACTIVO) },
    hidden: name => name === 'COSTO_SERVICIOS' && !p.verCostos,
    preview: v => v.ESTADO === 'CERRADA' ? `<b>Para cerrar se requiere:</b> inicio, fin y trabajo realizado${v.TIPO_MTTO === 'CORRECTIVO' || v.TIPO_MTTO === 'EMERGENCIA' ? ', y causa inmediata' : ''}. La mano de obra y los repuestos se registran en el detalle de la OT.` : '',
    submitLabel: closing ? 'Cerrar OT' : editing ? 'Guardar' : 'Crear OT',
    onSubmit: async datos => {
      if (datos.ESTADO === 'CERRADA' && !p.cerrarOT) throw new Error('No tiene permiso para cerrar OT (mantenimiento.ot.cerrar)');
      const r = editing ? await workOrders.update(ot.ID_OT, datos, user) : await workOrders.create(datos, user);
      toast(closing ? `${r.NUMERO_OT} cerrada` : editing ? 'OT actualizada' : `OT creada: ${r.NUMERO_OT}`);
      location.hash = `#/mantenimiento/ot/${r.ID_OT}`;
    }
  });
}
