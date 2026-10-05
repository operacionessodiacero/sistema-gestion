// Módulo padre de Mantenimiento: navegación interna por pestañas.
// Rutas: #/mantenimiento/<pestaña>/<id opcional>   ej. #/mantenimiento/hoja-vida/ACT-00001
import { load, getState } from '../services/api.js';
import { esc, emptyState, tabs } from './components.js';
import * as dashboard from './dashboard.js';
import * as inventory from './inventory.js';
import * as assetSheet from './assetSheet.js';
import * as catalogsView from './catalogsView.js';
import * as eventsView from './events.js';
import * as workOrdersView from './workOrders.js';
import * as fmeaView from './fmea.js';
import * as planView from './plan.js';
import * as indicatorsView from './indicators.js';
import * as availabilityView from './availability.js';

const TABS = [
  ['dashboard', 'Dashboard'],
  ['activos', 'Inventario de activos'],
  ['hoja-vida', 'Hoja de vida'],
  ['ot', 'Órdenes de trabajo'],
  ['eventos', 'Eventos y tiempos'],
  ['fmea', 'FMEA / AMEF'],
  ['plan', 'Plan de mantenimiento'],
  ['disponibilidad', 'Disponibilidad'],
  ['indicadores', 'Indicadores'],
  ['catalogos', 'Catálogos']
];

const VIEWS = {
  dashboard, activos: inventory, 'hoja-vida': assetSheet, ot: workOrdersView, eventos: eventsView, fmea: fmeaView,
  plan: planView, disponibilidad: availabilityView, indicadores: indicatorsView, catalogos: catalogsView
};

let ctx = null;
let listening = false;

/** ctx: { content, user } */
export function renderMaintenance(context) {
  ctx = context;
  if (!listening) {
    listening = true;
    window.addEventListener('sodiacero:mtto', () => { if (isActiveRoute()) paint(); });
  }
  paint();
  load();
}

const isActiveRoute = () => (location.hash || '').startsWith('#/mantenimiento');

function route() {
  const [, , tab = 'dashboard', ...rest] = (location.hash || '').split('/');
  return { tab: TABS.some(t => t[0] === tab) ? tab : 'dashboard', id: rest.length ? decodeURIComponent(rest.join('/')) : '' };
}

function paint() {
  const { content, user } = ctx;
  const { tab, id } = route();
  const st = getState();
  const view = VIEWS[tab];
  const action = view?.primaryAction ? view.primaryAction(user, id) : null;

  // Conserva la posición de scroll y el foco del buscador al repintar por llegada de datos
  const scroll = window.scrollY;
  const focused = document.activeElement?.matches?.('input[type=search]') ? document.activeElement.dataset.f || 'q' : null;

  content.innerHTML = `
    <div class="page-title">
      <div><h2>Mantenimiento</h2><div class="muted">Gestión de activos, mantenimiento y confiabilidad</div></div>
      <div class="toolbar mt-head-actions">${syncStatus(st)}${action ? `<button class="btn btn-primary" data-primary>${esc(action.label)}</button>` : ''}</div>
    </div>
    ${tabs(TABS, tab, '#/mantenimiento/')}
    <div class="mt-body" data-body></div>`;

  content.querySelector('[data-primary]')?.addEventListener('click', action?.run);
  content.querySelector('[data-refresh]')?.addEventListener('click', () => load(true));
  const body = content.querySelector('[data-body]');

  if (!st.ready) {
    body.innerHTML = st.error
      ? emptyState({ icon: '!', title: 'No se pudieron cargar los datos de mantenimiento', text: `${esc(st.error)}<br><span class="metric-note">Verifique la conexión a internet y que el Apps Script tenga publicada la versión actual.</span>`, action: '<button class="btn btn-primary" data-retry>Reintentar</button>' })
      : `<div class="mt-loading" role="status"><span class="mt-spinner"></span> Cargando datos de mantenimiento desde Google Sheets…</div>`;
    body.querySelector('[data-retry]')?.addEventListener('click', () => load(true));
    return;
  }

  view.render(body, { user, id });

  window.scrollTo(0, scroll);
  if (focused) {
    const el = content.querySelector(`input[type=search][data-f="${focused}"]`) || content.querySelector('input[type=search]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
}

function syncStatus(st) {
  const time = st.loadedAt ? st.loadedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
  let text, cls;
  if (st.loading) { text = 'Sincronizando…'; cls = 'mt-sync-busy'; }
  else if (st.error && st.ready) { text = `Sin conexión · datos en caché de las ${time}`; cls = 'mt-sync-warn'; }
  else if (st.ready) { text = `Google Sheets · ${time}`; cls = 'mt-sync-ok'; }
  else { text = ''; cls = ''; }
  return text ? `<button class="mt-sync ${cls}" data-refresh title="Actualizar desde Google Sheets">⟳ ${esc(text)}</button>` : '';
}
