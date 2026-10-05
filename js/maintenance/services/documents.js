// Servicio de documentos del activo (11_DOCUMENTOS)
import { rows, write } from './api.js';
import { isActive } from '../domain/hierarchy.js';

export const forAsset = id => rows('DOCUMENTOS').filter(d => d.ID_ACTIVO === id && isActive(d));
export const create = (datos, user) => write('crear', 'DOCUMENTOS', { datos }, user);
export const update = (id, datos, user) => write('actualizar', 'DOCUMENTOS', { id, datos }, user);
export const setRecordState = (id, estado, user, motivo = '') => write('estado', 'DOCUMENTOS', { id, estado, motivo }, user);
