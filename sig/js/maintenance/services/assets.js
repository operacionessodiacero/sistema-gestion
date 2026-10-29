// Servicio de activos (01_ACTIVOS). La UI nunca llama a Sheets directamente: pasa por aquí.
import { rows, data, write } from './api.js';
import { findAsset, pathOf, isLive, isActive, allowedParents, descendantAssetIds } from '../domain/hierarchy.js';

export const list = ({ includeInactive = false } = {}) => rows('ACTIVOS').filter(a => includeInactive ? isLive(a) : isActive(a));
export const get = id => findAsset(data(), id);
export const byCode = code => rows('ACTIVOS').find(a => String(a.CODIGO_ACTIVO).toUpperCase() === String(code).toUpperCase()) || null;
export const children = id => rows('ACTIVOS').filter(a => a.ID_PADRE === id && isLive(a));
export const path = id => pathOf(data(), id);
export const parentOptions = (level, excludeId) => allowedParents(data(), level, excludeId);
export const descendants = id => descendantAssetIds(data(), id).map(get).filter(Boolean);
export const areas = () => [...new Set(rows('ACTIVOS').map(a => a.AREA).filter(Boolean))].sort();

export const create = (datos, user) => write('crear', 'ACTIVOS', { datos }, user);
export const update = (id, datos, user) => write('actualizar', 'ACTIVOS', { id, datos }, user);
export const setRecordState = (id, estado, user, motivo = '') => write('estado', 'ACTIVOS', { id, estado, motivo }, user);
