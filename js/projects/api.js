// Única puerta de datos del módulo de Proyectos (libro de Google Sheets de proyectos, vía la API segura).
// El servidor valida permisos, recalcula el cronograma y audita cada cambio; aquí solo se lee y se envía.
import { call } from '../backend.js';

export const TABLES = ['PROYECTOS', 'ACTIVIDADES', 'COMPROMISOS', 'SEGUIMIENTO', 'RIESGOS', 'INTERESADOS', 'CAMBIOS', 'LECCIONES', 'PRY_CATALOGOS'];
export const ID = { PROYECTOS: 'ID_PROYECTO', ACTIVIDADES: 'ID_ACTIVIDAD', COMPROMISOS: 'ID_COMPROMISO', SEGUIMIENTO: 'ID_SEGUIMIENTO', RIESGOS: 'ID_RIESGO', INTERESADOS: 'ID_INTERESADO', CAMBIOS: 'ID_CAMBIO', LECCIONES: 'ID_LECCION', PRY_CATALOGOS: 'ID_CATALOGO' };

const empty = () => Object.fromEntries(TABLES.map(t => [t, []]));
const state = { data: empty(), ready: false, loading: false, error: null, loadedAt: null, hoy: new Date().toISOString().slice(0, 10), reloadQueued: false };
const emit = () => window.dispatchEvent(new CustomEvent('sodiacero:pry'));

export const getState = () => state;
export const rows = t => state.data[t] || [];
export const live = r => r && r.ESTADO_REGISTRO !== 'ANULADO';
export const get = (t, id) => rows(t).find(r => r[ID[t]] === id) || null;
export const of = (t, idProyecto) => rows(t).filter(r => r.ID_PROYECTO === idProyecto && live(r));

export async function load(force = false) {
  if (state.loading) { if (force) state.reloadQueued = true; return; }
  if (!force && state.ready && Date.now() - state.loadedAt < 60000) return;
  state.loading = true; emit();
  try {
    const j = await call('pry.leer');
    Object.assign(state, { data: { ...empty(), ...j.datos }, hoy: j.hoy || state.hoy, ready: true, error: null, loadedAt: Date.now() });
  } catch (e) { state.error = e.message; }
  finally {
    state.loading = false; emit();
    if (state.reloadQueued) { state.reloadQueued = false; load(true); }
  }
}

function upsert(tabla, reg) {
  const list = state.data[tabla];
  const i = list.findIndex(r => r[ID[tabla]] === reg[ID[tabla]]);
  if (i >= 0) list[i] = reg; else list.push(reg);
}

// accion: crear | actualizar | estado
export async function write(accion, tabla, { id, datos, estado, motivo } = {}) {
  const j = await call('pry.escribir', { accion, tabla, id, datos, estado, motivo });
  upsert(tabla, j.registro);
  emit();
  load(true); // el servidor reprograma el cronograma: se recargan fechas, EDT y avances
  return j.registro;
}
export async function move(id, direccion) { await call('pry.mover', { id, direccion }); await load(true); }
export async function baseline(id, motivo) { const r = await call('pry.lineaBase', { id, motivo }); await load(true); return r; }
export function clear() { Object.assign(state, { data: empty(), ready: false, error: null, loadedAt: null }); }
