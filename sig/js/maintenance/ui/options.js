// Opciones de listas desplegables construidas desde los registros (nunca texto libre para referencias).
import * as assets from '../services/assets.js';
import * as hierarchy from '../services/hierarchy.js';
import * as catalogs from '../services/catalogs.js';
import { events, workOrders, failureModes, plans, staff, variables } from '../services/operations.js';
import { LEVEL_LABEL } from '../domain/hierarchy.js';

export const assetLabel = a => a ? `${a.CODIGO_ACTIVO} · ${a.NOMBRE_ACTIVO}${a.LINEA ? ' — ' + a.LINEA : (a.PROCESO ? ' — ' + a.PROCESO : '')}` : '';

export function assetOptions() {
  return assets.list().sort((a, b) => String(a.CODIGO_ACTIVO).localeCompare(String(b.CODIGO_ACTIVO), 'es')).map(a => ({ value: a.ID_ACTIVO, label: assetLabel(a) }));
}
export function componentOptions(idActivo) {
  if (!idActivo) return [];
  return assets.descendants(idActivo).filter(a => a.ESTADO_REGISTRO === 'ACTIVO')
    .map(a => ({ value: a.ID_ACTIVO, label: `${a.CODIGO_ACTIVO} · ${a.NOMBRE_ACTIVO} (${LEVEL_LABEL[a.NIVEL_JERARQUIA]})` }));
}
export function modeOptions() {
  const all = failureModes.active().sort((a, b) => String(a.CODIGO).localeCompare(String(b.CODIGO)));
  const cat = Object.fromEntries(all.filter(m => Number(m.NIVEL) === 1).map(m => [m.CODIGO, m.NOMBRE]));
  return all.map(m => ({ value: m.ID_MODO_FALLA, label: Number(m.NIVEL) === 1 ? `${m.CODIGO} · ${m.NOMBRE} (general)` : `${m.CODIGO} · ${cat[m.CODIGO_PADRE] || ''} › ${m.NOMBRE}` }));
}
export const personOptions = () => staff.active().map(p => ({ value: p.ID_PERSONA, label: `${p.NOMBRE}${p.CARGO ? ' · ' + p.CARGO : ''} (${catalogs.label('TIPO_PERSONAL', p.TIPO_PERSONAL)})` }));
export const eventOptions = idActivo => events.where(e => e.ID_ACTIVO === idActivo).map(e => ({ value: e.ID_EVENTO, label: `${e.ID_EVENTO} · ${String(e.FECHA_EVENTO).slice(0, 16)} · ${catalogs.label('TIPO_EVENTO', e.TIPO_EVENTO)}` }));
export const planOptions = idActivo => plans.where(p => p.ID_ACTIVO === idActivo).map(p => ({ value: p.ID_PLAN, label: `${p.ID_PLAN} · ${p.ACTIVIDAD}` }));
export const otOptions = idActivo => workOrders.where(o => o.ID_ACTIVO === idActivo).map(o => ({ value: o.ID_OT, label: `${o.NUMERO_OT} · ${o.DESCRIPCION}` }));
export const variableOptions = idActivo => variables.active().filter(v => v.ID_ACTIVO === idActivo).map(v => ({ value: v.VARIABLE, label: `${catalogs.label('VARIABLE_LECTURA', v.VARIABLE)} (${v.UNIDAD || ''})` }));

// Alcances para disponibilidad / inactividad: líneas, procesos y activos
export function scopeOptions({ includeAssets = true } = {}) {
  const nodes = hierarchy.nodes().filter(n => n.NIVEL !== 'PLANTA').map(n => ({ value: n.ID_NODO, label: `${LEVEL_LABEL[n.NIVEL]}: ${n.NOMBRE_NODO}` }));
  return includeAssets ? [...nodes, ...assetOptions().map(o => ({ ...o, label: 'Activo: ' + o.label }))] : nodes;
}
export function scopeLabel(id) {
  const n = hierarchy.get(id);
  if (n) return `${LEVEL_LABEL[n.NIVEL]} ${n.NOMBRE_NODO}`;
  return assetLabel(assets.get(id));
}
