// Autenticación sin contraseñas: código de un solo uso enviado al correo registrado.
// El navegador solo guarda el token de sesión (sessionStorage, se borra al cerrar la pestaña).
// Identidad y permisos los entrega y verifica el servidor en cada petición.
import { call, getToken, setToken } from './backend.js';

let user = null;

export const current = () => user;

export function requestCode(email) {
  return call('auth.solicitarCodigo', { email }, { auth: false });
}

export async function verifyCode(email, codigo) {
  const j = await call('auth.verificarCodigo', { email, codigo }, { auth: false });
  setToken(j.token);
  user = toAppUser(j.usuario);
  return user;
}

// Recupera la sesión al recargar la página (el servidor confirma que sigue vigente)
export async function restore() {
  if (!getToken()) return null;
  try {
    const j = await call('auth.sesion');
    user = toAppUser(j.usuario);
    return user;
  } catch (e) {
    if (e.codigo === 'SESION_INVALIDA') { user = null; return null; }
    throw e;
  }
}

export async function logout() {
  try { if (getToken()) await call('auth.cerrar'); } catch { /* el token se descarta igual */ }
  setToken('');
  user = null;
}

export function forget() { setToken(''); user = null; }

// Adapta el perfil del servidor al formato que usa la interfaz existente.
// IMPORTANTE: esto solo decide qué se MUESTRA; el servidor vuelve a autorizar cada operación.
function toAppUser(u) {
  return {
    id: u.id, name: u.nombre || u.email, username: u.email, email: u.email, cargo: u.cargo || '',
    owner: !!u.propietario, permisos: u.permisos || [],
    role: u.propietario ? 'SUPER_ADMIN' : 'CONSULTA', areas: u.propietario ? ['*'] : [], active: true
  };
}
