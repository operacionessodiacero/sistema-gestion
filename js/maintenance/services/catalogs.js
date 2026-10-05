// Servicio de catálogos configurables (12_CATALOGOS). Nada de listas fijas en la interfaz.
import { rows, write } from './api.js';
import { isActive } from '../domain/hierarchy.js';

const byOrder = (a, b) => (Number(a.ORDEN) || 0) - (Number(b.ORDEN) || 0) || String(a.VALOR).localeCompare(String(b.VALOR), 'es');

export const names = () => [...new Set(rows('CATALOGOS').map(c => c.CATALOGO))].sort();
export const entries = (catalogo, { includeInactive = false } = {}) =>
  rows('CATALOGOS').filter(c => c.CATALOGO === catalogo && (includeInactive || isActive(c))).sort(byOrder);
export const options = catalogo => entries(catalogo).map(c => ({ value: String(c.CODIGO), label: c.VALOR }));
export const has = (catalogo, code) => entries(catalogo).some(c => String(c.CODIGO) === String(code));
export function label(catalogo, code) {
  if (code === '' || code === undefined || code === null) return '';
  const c = rows('CATALOGOS').find(x => x.CATALOGO === catalogo && String(x.CODIGO) === String(code));
  return c ? c.VALOR : String(code);
}

export const create = (datos, user) => write('crear', 'CATALOGOS', { datos }, user);
export const update = (id, datos, user) => write('actualizar', 'CATALOGOS', { id, datos }, user);
export const setRecordState = (id, estado, user, motivo = '') => write('estado', 'CATALOGOS', { id, estado, motivo }, user);
