// ¿Un modo de falla está contemplado en algún FMEA del activo, su componente o sus ancestros?
// (Misma regla que el servidor: coberturaFMEA_ en Operacion.gs)
import { pathOf } from './hierarchy.js';

export function fmeaCoverage(data, idActivo, idComp, idModo) {
  if (!idModo || !idActivo) return null;
  const cand = new Set([idComp, idActivo, ...pathOf(data, idActivo).filter(p => !p.isNode).map(p => p.id)].filter(Boolean));
  return (data.FMEA || []).find(f => f.ESTADO_REGISTRO === 'ACTIVO' && f.ID_MODO_FALLA === idModo && (cand.has(f.ID_ACTIVO) || cand.has(f.ID_COMPONENTE))) || null;
}

export function nprLevel(npr) {
  const n = Number(npr) || 0;
  return n >= 200 ? 'bad' : n >= 100 ? 'warn' : 'good';
}
