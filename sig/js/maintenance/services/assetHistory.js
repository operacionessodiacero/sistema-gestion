// Hoja de vida: NO es una tabla propia. Se arma consultando todas las tablas relacionadas por ID_ACTIVO.
import { rows } from './api.js';
import { isLive } from '../domain/hierarchy.js';
import { descendants } from './assets.js';

const RELATED = ['EVENTOS', 'OT', 'TIEMPOS', 'FMEA', 'PLAN', 'REPUESTOS', 'LECTURAS', 'DOCUMENTOS'];

// includeChildren: incluye los registros de sus subequipos/componentes
export function recordsFor(idActivo, { includeChildren = true } = {}) {
  const ids = new Set([idActivo, ...(includeChildren ? descendants(idActivo).map(a => a.ID_ACTIVO) : [])]);
  const out = {};
  for (const t of RELATED) {
    out[t] = rows(t).filter(r => ids.has(r.ID_ACTIVO) && isLive(r) && r.ESTADO !== 'ANULADA' && r.ESTADO !== 'ANULADO');
  }
  return out;
}
