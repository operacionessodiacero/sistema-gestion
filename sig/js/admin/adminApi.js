// Acceso a las operaciones de administración. Cada una la autoriza el servidor (Permisos.gs).
import { call } from '../backend.js';

export const leer = () => call('admin.leer');
export const auditoria = (limite = 500) => call('admin.auditoria', { limite });
export const crearUsuario = datos => call('admin.usuario.crear', { datos });
export const actualizarUsuario = (id, datos) => call('admin.usuario.actualizar', { id, datos });
export const permisosUsuario = (id, roles, permisos, motivo) => call('admin.usuario.permisos', { id, roles, permisos, motivo });
export const estadoUsuario = (id, estado, motivo) => call('admin.usuario.estado', { id, estado, motivo });
export const propietario = (id, valor) => call('admin.usuario.propietario', { id, valor });
export const revocarSesiones = id => call('admin.usuario.revocar', { id });
export const guardarRol = (id, datos) => call('admin.rol.guardar', { id, datos });
export const estadoRol = (id, estado) => call('admin.rol.estado', { id, estado });
