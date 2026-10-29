// Cliente único del backend (Apps Script). Toda petición viaja por POST con el token de sesión
// en el cuerpo (nunca en la URL) y sin cookies. El servidor decide qué está permitido.
import { API } from './config.js';

const TOKEN_KEY = 'sodiacero_token';

export function getToken() { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
export function setToken(t) { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* */ } }

export class BackendError extends Error {
  constructor(message, codigo) { super(message); this.codigo = codigo; }
}

export async function call(op, data = {}, { auth = true } = {}) {
  if (!API.maintenanceUrl) throw new BackendError('Servidor no configurado (js/config.js → API.maintenanceUrl).', 'CONFIG');
  const body = JSON.stringify(auth ? { ...data, op, token: getToken() } : { ...data, op });
  let r;
  try {
    // text/plain evita el preflight CORS que Apps Script no responde; credentials:'omit' no envía cookies de Google
    r = await fetch(API.maintenanceUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, credentials: 'omit', cache: 'no-store', redirect: 'follow' });
  } catch {
    throw new BackendError('No se pudo conectar con el servidor. Verifique su conexión e intente de nuevo.', 'RED');
  }
  let j;
  try { j = JSON.parse(await r.text()); }
  catch { throw new BackendError('Respuesta no válida del servidor. Verifique que esté publicada la versión actual del Apps Script de mantenimiento.', 'RESPUESTA'); }
  if (!j.ok) {
    if (j.codigo === 'SESION_INVALIDA') {
      setToken('');
      window.dispatchEvent(new CustomEvent('sodiacero:sesion-expirada', { detail: j.error }));
    }
    throw new BackendError(j.error || 'Error del servidor', j.codigo);
  }
  return j;
}
