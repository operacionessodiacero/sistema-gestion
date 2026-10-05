// Vista "Catálogos y configuración": catálogos editables, personal y tarifas.
import * as catalogs from '../services/catalogs.js';
import { esc, emptyState, dataTable, badge } from './components.js';
import { openCatalogForm, changeState, canEditCatalogs, perms } from './actions.js';
import { staffPanel, bindStaff } from './staff.js';

const CATALOG_HELP = {
  TIPO_ACTIVO: 'Tipos de activo del inventario', ESTADO_ACTIVO: 'Estado operativo del activo',
  CRITICIDAD: 'Clasificación de criticidad', UNIDAD_CAPACIDAD: 'Unidades de capacidad nominal',
  FASES: 'Alimentación eléctrica', TIPO_DOCUMENTO: 'Tipos de documento técnico',
  TIPO_EVENTO: 'Tipos de evento (DESCRIPCION = clase de parada: CORRECTIVO / PREVENTIVO / SIN_PARADA)',
  TIPO_MTTO: 'Tipos de mantenimiento de las OT', PRIORIDAD: 'Prioridad de OT', CLASIFICACION_CAUSA: 'Clasificación de causa raíz',
  SEVERIDAD: 'Escala FMEA de severidad', OCURRENCIA: 'Escala FMEA de ocurrencia', DETECCION: 'Escala FMEA de detección',
  UNIDAD_FRECUENCIA: 'Unidades de frecuencia del plan', VARIABLE_LECTURA: 'Variables de condición (DESCRIPCION = unidad)',
  TIPO_PERSONAL: 'Tipos de personal', UNIDAD_REPUESTO: 'Unidades de repuestos',
  CATEGORIA_INACTIVIDAD: 'Inactividad (DESCRIPCION: INACTIVO o STANDBY)'
};

export function primaryAction(user, selected) {
  if (!canEditCatalogs(user)) return null;
  return { label: selected ? '+ Nuevo valor' : '+ Nuevo catálogo', run: () => openCatalogForm(user, { catalogo: selected || '' }) };
}

export function render(el, { user, id }) {
  const canEdit = canEditCatalogs(user);
  const names = catalogs.names();
  const selected = id && names.includes(id) ? id : names[0];

  el.innerHTML = `<div class="mt-catalogs">
    <aside class="panel">
      <h3>Catálogos</h3>
      ${names.length ? `<nav class="mt-cat-list">${names.map(n => `<a href="#/mantenimiento/catalogos/${encodeURIComponent(n)}" class="${n === selected ? 'active' : ''}"><b>${esc(n)}</b><small>${esc(CATALOG_HELP[n] || '')} · ${catalogs.entries(n).length} valores</small></a>`).join('')}</nav>`
        : '<p class="muted">Sin catálogos. Ejecute <code>configurarMantenimiento</code> en el Apps Script para crear los catálogos base.</p>'}
    </aside>
    <section>
      <div class="panel" data-entries></div>
      ${perms(user).verCostos || perms(user).configCostos ? staffPanel(user) : ''}
      <div class="panel">
        <h3>Origen de los datos</h3>
        <p class="metric-note">Google Sheets exclusivo de mantenimiento: es la fuente de verdad. El servidor verifica la sesión, aplica las validaciones, genera los IDs y registra la auditoría de cada cambio.</p>
      </div>
    </section>
  </div>`;

  const box = el.querySelector('[data-entries]');
  if (!selected) {
    box.innerHTML = emptyState({ icon: '≡', title: 'No hay catálogos cargados' });
  } else {
    const list = catalogs.entries(selected, { includeInactive: true });
    box.innerHTML = `<div class="mt-panel-head"><div><h3>${esc(selected)}</h3><div class="metric-note">${esc(CATALOG_HELP[selected] || '')}. Los códigos se guardan en los registros y no se pueden modificar; inactivar un valor no altera los registros históricos.</div></div>${canEdit ? '<button class="btn btn-secondary btn-sm" data-add-entry>+ Valor</button>' : ''}</div>` +
      dataTable(list, [
        { label: 'Código', html: c => `<code>${esc(c.CODIGO)}</code>` },
        { label: 'Texto visible', key: 'VALOR' },
        { label: 'Orden', key: 'ORDEN' },
        { label: 'Estado', html: c => badge(c.ESTADO_REGISTRO) },
        { label: '', html: c => canEdit ? `<div class="toolbar mt-row-actions"><button class="btn btn-secondary btn-sm" data-edit="${esc(c.ID_CATALOGO)}">Editar</button><button class="btn btn-secondary btn-sm" data-toggle="${esc(c.ID_CATALOGO)}">${c.ESTADO_REGISTRO === 'ACTIVO' ? 'Inactivar' : 'Activar'}</button></div>` : '' }
      ]);
  }

  bindStaff(el, user);
  el.querySelector('[data-add-entry]')?.addEventListener('click', () => openCatalogForm(user, { catalogo: selected }));
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openCatalogForm(user, { entry: catalogs.entries(selected, { includeInactive: true }).find(c => c.ID_CATALOGO === b.dataset.edit) }));
  el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
    const c = catalogs.entries(selected, { includeInactive: true }).find(x => x.ID_CATALOGO === b.dataset.toggle);
    changeState(user, catalogs, c.ID_CATALOGO, c.ESTADO_REGISTRO === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO', `${c.CATALOGO} · ${c.VALOR}`);
  });
}
