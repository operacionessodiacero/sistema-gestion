// Permisos en la INTERFAZ: solo deciden qué se muestra. El servidor vuelve a verificar cada operación,
// así que modificar este archivo en el navegador no da acceso a nada.
const AREA_PERMISO = {
  PRODUCCION: 'produccion.ver', MANTENIMIENTO: 'mantenimiento.ver', CALIDAD: 'calidad.ver', ALMACEN: 'almacen.ver',
  SEGURIDAD: 'sya.ver', PROYECTOS: 'proyectos.ver', ACCIONES: 'acciones.ver', DASHBOARD: 'dashboard.ver'
};
export const can = (u, codigo) => !!u && (u.owner || (u.permisos || []).includes(codigo));
export const canAny = (u, codigos) => codigos.some(c => can(u, c));
export const hasPermission = can;
export const hasRole = (u, r) => u?.role === r;
export const canAccessArea = (u, area) => can(u, AREA_PERMISO[area] || '');
export const canAdmin = u => can(u, 'administracion.acceder');
