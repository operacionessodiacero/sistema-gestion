// Servicios de las tablas operativas de mantenimiento. La UI nunca llama a Sheets directamente:
// todo pasa por api.write/rows (y el servidor valida, calcula y audita cada escritura).
import { rows, write } from './api.js';

const live = r => r && r.ESTADO_REGISTRO !== 'ANULADO';

function table(tabla, idField) {
  return {
    tabla, idField,
    all: ({ includeVoided = false } = {}) => rows(tabla).filter(r => includeVoided || live(r)),
    active: () => rows(tabla).filter(r => r.ESTADO_REGISTRO === 'ACTIVO'),
    get: id => rows(tabla).find(r => r[idField] === id) || null,
    where: fn => rows(tabla).filter(r => live(r) && fn(r)),
    create: (datos, user) => write('crear', tabla, { datos }, user),
    update: (id, datos, user) => write('actualizar', tabla, { id, datos }, user),
    setRecordState: (id, estado, user, motivo = '') => write('estado', tabla, { id, estado, motivo }, user)
  };
}

export const events = table('EVENTOS', 'ID_EVENTO');
export const workOrders = table('OT', 'ID_OT');
export const times = table('TIEMPOS', 'ID_TIEMPO');
export const fmea = table('FMEA', 'ID_FMEA');
export const failureModes = table('MODOS_FALLA', 'ID_MODO_FALLA');
export const plans = table('PLAN', 'ID_PLAN');
export const readings = table('LECTURAS', 'ID_LECTURA');
export const variables = table('VARIABLES', 'ID_VARIABLE_ACTIVO');
export const staff = table('PERSONAL', 'ID_PERSONA');
export const rates = table('TARIFAS', 'ID_TARIFA');
export const labor = table('MANO_OBRA', 'ID_MANO_OBRA');
export const parts = table('REPUESTOS', 'ID_CONSUMO');
export const periods = table('PERIODOS', 'ID_PERIODO');

export const timesOfEvent = idEvento => times.where(t => t.ID_EVENTO === idEvento)[0] || null;
export const otOfEvent = idEvento => workOrders.where(o => o.ID_EVENTO === idEvento)[0] || null;
export const laborOfOT = idOT => labor.where(m => m.ID_OT === idOT);
export const partsOfOT = idOT => parts.where(p => p.ID_OT === idOT);
export function modeLabel(id) {
  const m = failureModes.get(id);
  return m ? `${m.CODIGO} · ${m.NOMBRE}` : (id || '');
}
