// Única puerta de acceso a los datos de mantenimiento: Google Sheets a través del Apps Script
// (fuente de verdad), siempre con sesión válida (js/backend.js). El servidor autoriza cada lectura
// y escritura. El navegador guarda una copia en caché (por pestaña) solo para mostrar datos sin conexión.
// Para migrar a otra API o base SQL basta con reemplazar fetchAll() y send().

import { MAINTENANCE } from '../../config.js';
import { call } from '../../backend.js';

const MODE_KEY = 'sodiacero_mtto_modo';
const CACHE_KEY = 'sodiacero_mtto_cache_v1';
const TABLES = Object.keys(MAINTENANCE.sheets);
const FRESH_MS = 60 * 1000;
// La caché de versiones anteriores quedaba en localStorage (persistente): se elimina
// También se eliminan los restos del antiguo modo DEMO (datos de ejemplo locales).
try { [CACHE_KEY, MODE_KEY, 'sodiacero_mtto_demo_v1', 'sodiacero_mtto_demo_v2'].forEach(k => localStorage.removeItem(k)); } catch { /* */ }

const state = {
  data: emptyData(),
  ready: false,       // hay datos para mostrar (del servidor o de caché)
  loading: false,
  fromCache: false,
  loadedAt: null,
  error: null
};

function emptyData() { return Object.fromEntries(TABLES.map(t => [t, []])); }
function emit() { window.dispatchEvent(new CustomEvent('sodiacero:mtto')); }

export const getState = () => state;
export const rows = tabla => state.data[tabla] || [];
export const data = () => state.data;

export async function load(force = false) {
  if (state.loading) { if (force) state.reloadQueued = true; return; }
  if (!state.ready) {
    const c = readCache();
    if (c) Object.assign(state, { data: { ...emptyData(), ...c.data }, ready: true, fromCache: true, loadedAt: new Date(c.at) });
  }
  if (!force && state.ready && !state.fromCache && Date.now() - state.loadedAt < FRESH_MS) return;
  state.loading = true;
  emit();
  try {
    const datos = await fetchAll();
    Object.assign(state, { data: { ...emptyData(), ...datos }, ready: true, fromCache: false, loadedAt: new Date(), error: null });
    writeCache();
  } catch (e) {
    state.error = e.message;
  } finally {
    state.loading = false;
    emit();
    if (state.reloadQueued) { state.reloadQueued = false; load(true); }
  }
}

// accion: 'crear' | 'actualizar' | 'estado'. motivo: obligatorio al ANULAR.
export async function write(accion, tabla, { id, datos, estado, motivo } = {}) {
  const registro = (await call('mtto.escribir', { accion, tabla, id, datos, estado, motivo })).registro;
  upsert(tabla, registro);
  writeCache();
  emit();
  // El servidor actualiza en cascada otras tablas (costos de la OT, evento vinculado, cobertura FMEA,
  // plan, ubicación de activos…): se recargan los datos para reflejarlo.
  load(true);
  return registro;
}

// Al cerrar sesión: borra datos en memoria y caché local
export function clear() {
  try { sessionStorage.removeItem(CACHE_KEY); localStorage.removeItem(CACHE_KEY); } catch { /* */ }
  Object.assign(state, { data: emptyData(), ready: false, fromCache: false, loadedAt: null, error: null, loading: false });
}

/* ------------------------------ transporte ------------------------------ */

async function fetchAll() {
  const j = await call('mtto.leer', { tablas: TABLES.join(',') });
  if (!j.datos) throw new Error('El servidor de mantenimiento no respondió con datos.');
  return j.datos;
}

function upsert(tabla, reg) {
  const idf = MAINTENANCE.idFields[tabla];
  const list = state.data[tabla] || (state.data[tabla] = []);
  const i = list.findIndex(r => r[idf] === reg[idf]);
  if (i >= 0) list[i] = reg; else list.push(reg);
}

function readCache() { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY)); } catch { return null; } }
function writeCache() {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: new Date().toISOString(), data: state.data })); } catch { /* cuota llena */ }
}
