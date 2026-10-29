// Servicio de nodos de jerarquía (02_JERARQUIA_ACTIVOS): planta, proceso y línea.
import { rows, data, write } from './api.js';
import { buildTree, allowedNodeParents, findNode, isActive } from '../domain/hierarchy.js';

export const nodes = () => rows('JERARQUIA').filter(isActive);
export const get = id => findNode(data(), id);
export const byLevel = level => nodes().filter(n => n.NIVEL === level);
export const tree = opts => buildTree(data(), opts);
export const parentOptions = level => allowedNodeParents(data(), level);

export const create = (datos, user) => write('crear', 'JERARQUIA', { datos }, user);
export const update = (id, datos, user) => write('actualizar', 'JERARQUIA', { id, datos }, user);
export const setRecordState = (id, estado, user, motivo = '') => write('estado', 'JERARQUIA', { id, estado, motivo }, user);
