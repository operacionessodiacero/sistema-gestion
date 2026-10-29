// Administración: usuarios, roles, permisos y auditoría.
// La pantalla solo muestra lo que el servidor permite; cada acción se vuelve a autorizar en Permisos.gs.
import * as api from './adminApi.js';
import { can } from '../permissions.js';
import { toast } from '../ui.js';
import { esc, emptyState, badge, confirmDialog, tabs } from '../maintenance/ui/components.js';

let state = { data: null, audit: null, loading: false, error: '', auditFilter: '', auditKind: 'auditoria' };
let ctx = null;

const TABS = [
  ['usuarios', 'Usuarios', 'usuarios.ver'],
  ['roles', 'Roles', 'roles.ver'],
  ['auditoria', 'Auditoría', 'auditoria.ver'],
  ['eventos', 'Eventos de seguridad', 'auditoria.ver']
];

export function renderAdmin(context) {
  ctx = context;
  const visible = TABS.filter(t => can(ctx.user, t[2]));
  if (!visible.length) { ctx.content.innerHTML = emptyState({ icon: '🔒', title: 'Sin acceso a Administración' }); return; }
  if (!visible.some(t => t[0] === ctx.tab)) ctx.tab = visible[0][0];
  paint();
  if (!state.data && !state.loading) load();
  if ((ctx.tab === 'auditoria' || ctx.tab === 'eventos') && !state.audit) loadAudit();
}

async function load() {
  state.loading = true; state.error = ''; paint();
  try { state.data = await api.leer(); } catch (e) { state.error = e.message; }
  state.loading = false; paint();
}
async function loadAudit() {
  try { state.audit = await api.auditoria(1000); } catch (e) { state.error = e.message; }
  paint();
}
const reload = async () => { state.data = null; state.audit = null; await load(); if (ctx.tab === 'auditoria' || ctx.tab === 'eventos') loadAudit(); };

function paint() {
  if (!(location.hash.startsWith('#/admin') || location.hash.startsWith('#/audit'))) return;
  const { content, user } = ctx;
  const visible = TABS.filter(t => can(user, t[2]));
  const action = ctx.tab === 'usuarios' && can(user, 'usuarios.crear') ? '<button class="btn btn-primary" data-new-user>+ Usuario</button>'
    : ctx.tab === 'roles' && can(user, 'roles.crear') ? '<button class="btn btn-primary" data-new-role>+ Rol</button>' : '';
  content.innerHTML = `<div class="page-title"><div><h2>Administración</h2><div class="muted">Usuarios, roles, permisos y auditoría · todo cambio queda registrado</div></div><div class="toolbar mt-head-actions">${action}</div></div>
    ${tabs(visible.map(t => [t[0], t[1]]), ctx.tab, '#/admin/')}<div data-body></div>`;
  const body = content.querySelector('[data-body]');
  if (state.error) body.innerHTML = `<div class="panel">${emptyState({ icon: '!', title: 'No se pudo cargar', text: esc(state.error), action: '<button class="btn btn-primary" data-retry>Reintentar</button>' })}</div>`;
  else if (!state.data || ((ctx.tab === 'auditoria' || ctx.tab === 'eventos') && !state.audit)) body.innerHTML = '<div class="mt-loading"><span class="mt-spinner"></span> Cargando…</div>';
  else body.innerHTML = { usuarios: usersView, roles: rolesView, auditoria: auditView, eventos: eventsView }[ctx.tab]();
  bind(content);
}

/* ------------------------------ Usuarios ------------------------------ */

const roleName = id => state.data?.roles?.find(r => r.ID_ROL === id)?.NOMBRE || id;
const mine = () => state.data.propietario ? null : new Set(state.data.misPermisos);
// Mismo criterio del servidor (solo para habilitar botones; el servidor decide)
function manageable(u) {
  if (u.ID_USUARIO === state.data.yo) return false;
  if (u.ES_PROPIETARIO && !state.data.propietario) return false;
  const m = mine();
  return !m || u.PERMISOS_EFECTIVOS.every(p => m.has(p));
}

function usersView() {
  const users = state.data.usuarios || [];
  if (!users.length) return emptyState({ icon: '👤', title: 'Sin usuarios' });
  const u = ctx.user;
  return `<div class="panel"><div class="table-wrap"><table class="mt-table"><thead><tr><th>Usuario</th><th>Cargo</th><th>Roles</th><th>Permisos</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead><tbody>${users.map(x => {
    const g = manageable(x), self = x.ID_USUARIO === state.data.yo;
    return `<tr><td><b>${esc(x.NOMBRE)}</b>${x.ES_PROPIETARIO ? ' <span class="status mt-neutral" title="Tiene todos los permisos">PROPIETARIO</span>' : ''}${self ? ' <span class="muted">(usted)</span>' : ''}<div class="metric-note">${esc(x.EMAIL)}</div></td>
      <td>${esc(x.CARGO || '—')}</td>
      <td>${x.ES_PROPIETARIO ? '<span class="muted">Todos</span>' : (x.ROLES.map(r => `<span class="mt-chip">${esc(roleName(r))}</span>`).join(' ') || '<span class="muted">—</span>')}</td>
      <td>${x.ES_PROPIETARIO ? '<span class="muted">Todos</span>' : `<span title="${esc(x.PERMISOS_EFECTIVOS.join('\n'))}">${x.PERMISOS_EFECTIVOS.length}</span>`}</td>
      <td>${badge(x.ESTADO_REGISTRO)}</td><td>${esc(x.ULTIMO_ACCESO || '—')}</td>
      <td><div class="toolbar mt-row-actions">
        ${can(u, 'usuarios.editar') && (g || self) ? `<button class="btn btn-secondary btn-sm" data-edit-user="${esc(x.ID_USUARIO)}">Editar</button>` : ''}
        ${(can(u, 'permisos.asignar') || can(u, 'permisos.retirar')) && g && !x.ES_PROPIETARIO ? `<button class="btn btn-secondary btn-sm" data-perms="${esc(x.ID_USUARIO)}">Permisos</button>` : ''}
        ${can(u, 'usuarios.desactivar') && g ? `<button class="btn btn-secondary btn-sm" data-user-state="${esc(x.ID_USUARIO)}">${x.ESTADO_REGISTRO === 'ACTIVO' ? 'Desactivar' : 'Activar'}</button>` : ''}
        ${can(u, 'sesiones.revocar') && g && x.ESTADO_REGISTRO === 'ACTIVO' ? `<button class="btn btn-secondary btn-sm" data-revoke="${esc(x.ID_USUARIO)}" title="Obliga a iniciar sesión de nuevo">Cerrar sesiones</button>` : ''}
        ${state.data.propietario && !self ? `<button class="btn btn-secondary btn-sm" data-owner="${esc(x.ID_USUARIO)}">${x.ES_PROPIETARIO ? 'Quitar propietario' : 'Hacer propietario'}</button>` : ''}
      </div></td></tr>`;
  }).join('')}</tbody></table></div>
  <p class="metric-note">Solo puede gestionar usuarios cuyos permisos usted también tiene. Nadie puede cambiar sus propios permisos. Un usuario desactivado pierde el acceso de inmediato.</p></div>`;
}

/* ------------------------------ Roles ------------------------------ */

function rolesView() {
  const roles = state.data.roles || [];
  const users = state.data.usuarios || [];
  const m = mine();
  return `<div class="panel"><div class="table-wrap"><table class="mt-table"><thead><tr><th>Rol</th><th>Permisos</th><th>Usuarios</th><th>Estado</th><th></th></tr></thead><tbody>${roles.map(r => {
    const n = users.filter(u => u.ROLES.includes(r.ID_ROL) && u.ESTADO_REGISTRO === 'ACTIVO').length;
    const editable = !m || r.PERMISOS.every(p => m.has(p));
    return `<tr><td><b>${esc(r.NOMBRE)}</b><div class="metric-note">${esc(r.DESCRIPCION || '')}</div></td>
      <td>${r.PERMISOS.map(p => `<span class="mt-chip">${esc(p)}</span>`).join(' ')}</td><td>${n}</td><td>${badge(r.ESTADO_REGISTRO)}</td>
      <td><div class="toolbar mt-row-actions">${can(ctx.user, 'roles.editar') && editable && r.ESTADO_REGISTRO === 'ACTIVO' ? `<button class="btn btn-secondary btn-sm" data-edit-role="${esc(r.ID_ROL)}">Editar</button>` : ''}
      ${can(ctx.user, 'roles.desactivar') && editable ? `<button class="btn btn-secondary btn-sm" data-role-state="${esc(r.ID_ROL)}">${r.ESTADO_REGISTRO === 'ACTIVO' ? 'Desactivar' : 'Activar'}</button>` : ''}</div></td></tr>`;
  }).join('')}</tbody></table></div></div>`;
}

/* ------------------------------ Auditoría ------------------------------ */

function changes(a) {
  let antes = {}, despues = {};
  try { antes = a.ANTES ? JSON.parse(a.ANTES) : {}; } catch { /* */ }
  try { despues = a.DESPUES ? JSON.parse(a.DESPUES) : {}; } catch { /* */ }
  const keys = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].slice(0, 8);
  return keys.map(k => `<div><b>${esc(k)}</b>: ${a.ANTES ? `<s class="muted">${esc(String(antes[k] ?? '').slice(0, 60))}</s> → ` : ''}${esc(String(despues[k] ?? '').slice(0, 80))}</div>`).join('') + (Object.keys(despues).length > 8 ? '<div class="muted">…</div>' : '');
}

function filterBar(kind) {
  return `<div class="toolbar"><input type="search" data-audit-q placeholder="Filtrar por usuario, acción, registro…" value="${esc(state.auditFilter)}" aria-label="Filtrar"><button class="btn btn-secondary btn-sm" data-reload-audit>Actualizar</button></div>`;
}
const matches = o => !state.auditFilter || JSON.stringify(o).toLowerCase().includes(state.auditFilter.toLowerCase());

function auditView() {
  const rows = state.audit.auditoria.filter(matches);
  return `<div class="panel">${filterBar()}<p class="metric-note">Registro inalterable desde la aplicación. Cada fila está encadenada por hash con la anterior (verificable con la función verificarAuditoria).</p>
    ${rows.length ? `<div class="table-wrap"><table class="mt-table"><thead><tr><th>Fecha (UTC)</th><th>Usuario</th><th>Acción</th><th>Registro</th><th>Cambios</th><th>Motivo</th></tr></thead><tbody>${rows.slice(0, 500).map(a => `<tr><td>${esc(a.FECHA_HORA.replace('T', ' ').replace('Z', ''))}</td><td>${esc(a.EMAIL)}</td><td><b>${esc(a.ACCION)}</b><div class="metric-note">${esc(a.MODULO)}</div></td><td>${esc(a.ENTIDAD)}<div class="metric-note">${esc(a.ID_REGISTRO)}</div></td><td class="mt-audit-changes">${changes(a)}</td><td>${esc(a.MOTIVO || '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sin registros</div>'}</div>`;
}

function eventsView() {
  const rows = state.audit.eventos.filter(matches);
  const danger = { ACCESO_DENEGADO: 'bad', LOGIN_FALLIDO: 'warn', CODIGO_BLOQUEADO: 'bad', LIMITE_PETICIONES: 'bad', LIMITE_CODIGOS: 'warn', SESION_RECHAZADA: 'warn', ERROR_INTERNO: 'bad', CODIGO_CORREO_NO_AUTORIZADO: 'warn', LOGIN_OK: 'good' };
  return `<div class="panel">${filterBar()}${rows.length ? `<div class="table-wrap"><table class="mt-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Correo</th><th>Detalle</th></tr></thead><tbody>${rows.slice(0, 500).map(e => `<tr><td>${esc(e.FECHA_HORA.replace('T', ' ').replace('Z', '').slice(0, 19))}</td><td><span class="status ${danger[e.TIPO] || 'mt-neutral'}">${esc(e.TIPO)}</span></td><td>${esc(e.EMAIL)}</td><td>${esc(e.DETALLE)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sin eventos</div>'}</div>`;
}

/* ------------------------------ Eventos de la pantalla ------------------------------ */

function bind(root) {
  const $ = s => root.querySelector(s);
  $('[data-retry]')?.addEventListener('click', reload);
  $('[data-new-user]')?.addEventListener('click', () => userForm());
  $('[data-new-role]')?.addEventListener('click', () => roleForm());
  root.querySelectorAll('[data-edit-user]').forEach(b => b.onclick = () => userForm(findUser(b.dataset.editUser)));
  root.querySelectorAll('[data-perms]').forEach(b => b.onclick = () => permsForm(findUser(b.dataset.perms)));
  root.querySelectorAll('[data-user-state]').forEach(b => b.onclick = async () => {
    const u = findUser(b.dataset.userState);
    const off = u.ESTADO_REGISTRO === 'ACTIVO';
    const r = await confirmDialog(off ? `¿Desactivar a ${u.NOMBRE}? Perderá el acceso de inmediato.` : `¿Activar a ${u.NOMBRE}?`, { okLabel: off ? 'Desactivar' : 'Activar', danger: off, requireReason: off });
    if (!r) return;
    run(() => api.estadoUsuario(u.ID_USUARIO, off ? 'INACTIVO' : 'ACTIVO', off ? r : ''), off ? 'Usuario desactivado' : 'Usuario activado');
  });
  root.querySelectorAll('[data-revoke]').forEach(b => b.onclick = async () => {
    const u = findUser(b.dataset.revoke);
    if (await confirmDialog(`¿Cerrar todas las sesiones de ${u.NOMBRE}?`)) run(() => api.revocarSesiones(u.ID_USUARIO), 'Sesiones cerradas');
  });
  root.querySelectorAll('[data-owner]').forEach(b => b.onclick = async () => {
    const u = findUser(b.dataset.owner);
    const make = !u.ES_PROPIETARIO;
    if (await confirmDialog(make ? `¿Nombrar a ${u.NOMBRE} PROPIETARIO? Tendrá TODOS los permisos, incluido administrar a otros propietarios.` : `¿Quitar a ${u.NOMBRE} la condición de propietario?`, { danger: make, okLabel: make ? 'Nombrar propietario' : 'Quitar' }))
      run(() => api.propietario(u.ID_USUARIO, make), 'Cambio aplicado');
  });
  root.querySelectorAll('[data-edit-role]').forEach(b => b.onclick = () => roleForm(state.data.roles.find(r => r.ID_ROL === b.dataset.editRole)));
  root.querySelectorAll('[data-role-state]').forEach(b => b.onclick = async () => {
    const r = state.data.roles.find(x => x.ID_ROL === b.dataset.roleState);
    const off = r.ESTADO_REGISTRO === 'ACTIVO';
    if (await confirmDialog(off ? `¿Desactivar el rol ${r.NOMBRE}?` : `¿Activar el rol ${r.NOMBRE}?`)) run(() => api.estadoRol(r.ID_ROL, off ? 'INACTIVO' : 'ACTIVO'), 'Rol actualizado');
  });
  const q = $('[data-audit-q]');
  if (q) q.oninput = () => { state.auditFilter = q.value; const pos = q.selectionStart; paint(); const n = ctx.content.querySelector('[data-audit-q]'); n.focus(); n.setSelectionRange(pos, pos); };
  $('[data-reload-audit]')?.addEventListener('click', () => { state.audit = null; paint(); loadAudit(); });
}

const findUser = id => state.data.usuarios.find(u => u.ID_USUARIO === id);

async function run(fn, msg) {
  try { await fn(); toast(msg); await reload(); } catch (e) { toast(e.message); }
}

/* ------------------------------ Formularios ------------------------------ */

function modal(title, inner, onSave, saveLabel = 'Guardar') {
  const b = document.createElement('div');
  b.className = 'modal-backdrop';
  b.innerHTML = `<div class="modal mt-form" role="dialog" aria-modal="true"><div class="mt-form-head"><h3>${esc(title)}</h3><button type="button" class="btn btn-secondary btn-sm" data-x aria-label="Cerrar">✕</button></div><form novalidate style="padding:4px 22px 0">${inner}<div class="mt-form-error" role="alert" hidden></div><div class="toolbar mt-form-actions"><button class="btn btn-primary" type="submit">${esc(saveLabel)}</button><button class="btn btn-secondary" type="button" data-x>Cancelar</button></div></form></div>`;
  document.body.append(b);
  const close = () => b.remove();
  b.querySelectorAll('[data-x]').forEach(x => x.onclick = close);
  const form = b.querySelector('form');
  form.onsubmit = async e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try { await onSave(form); close(); await reload(); }
    catch (err) { const box = form.querySelector('.mt-form-error'); box.textContent = err.message; box.hidden = false; }
    finally { btn.disabled = false; }
  };
  setTimeout(() => form.querySelector('input,select,textarea')?.focus(), 30);
  return form;
}

function userForm(u = null) {
  const self = u && u.ID_USUARIO === state.data.yo;
  const canAssign = !u && can(ctx.user, 'permisos.asignar');
  modal(u ? `Editar ${u.NOMBRE}` : 'Nuevo usuario', `<div class="form-grid">
    <div class="field"><label for="a-nombre">Nombre completo *</label><input id="a-nombre" name="NOMBRE" maxlength="80" value="${esc(u?.NOMBRE || '')}"></div>
    <div class="field"><label for="a-cargo">Cargo</label><input id="a-cargo" name="CARGO" maxlength="80" value="${esc(u?.CARGO || '')}"></div>
    <div class="field full"><label for="a-email">Correo (con este recibirá el código de acceso) *</label><input id="a-email" name="EMAIL" type="email" maxlength="120" value="${esc(u?.EMAIL || '')}" ${self ? 'disabled' : ''}></div>
    </div>${canAssign ? `<fieldset class="mt-section"><legend>Roles iniciales</legend>${rolesChecks([])}</fieldset><fieldset class="mt-section"><legend>Permisos adicionales</legend>${permChecks([])}</fieldset>` : (!u ? '<p class="metric-note">Usted no tiene permiso para asignar roles: el usuario se creará sin acceso.</p>' : '')}`,
  async form => {
    const f = new FormData(form);
    const datos = { NOMBRE: f.get('NOMBRE'), CARGO: f.get('CARGO') };
    if (!self) datos.EMAIL = f.get('EMAIL');
    if (u) await api.actualizarUsuario(u.ID_USUARIO, datos);
    else await api.crearUsuario({ ...datos, ROLES: f.getAll('rol'), PERMISOS_DIRECTOS: f.getAll('perm') });
    toast(u ? 'Usuario actualizado' : 'Usuario creado. Ya puede ingresar con su correo.');
  }, u ? 'Guardar' : 'Crear usuario');
}

function rolesChecks(selected) {
  const roles = (state.data.roles || []).filter(r => r.ESTADO_REGISTRO === 'ACTIVO');
  const m = mine();
  if (!roles.length) return '<p class="muted">No hay roles activos.</p>';
  return `<div class="mt-checks">${roles.map(r => {
    const allowed = !m || r.PERMISOS.every(p => m.has(p));
    return `<label class="mt-check-row ${allowed ? '' : 'disabled'}" title="${esc(r.PERMISOS.join(', '))}"><input type="checkbox" name="rol" value="${esc(r.ID_ROL)}" ${selected.includes(r.ID_ROL) ? 'checked' : ''} ${allowed ? '' : 'disabled'}> <span><b>${esc(r.NOMBRE)}</b><small>${esc(r.DESCRIPCION || '')}${allowed ? '' : ' · incluye permisos que usted no tiene'}</small></span></label>`;
  }).join('')}</div>`;
}

function permChecks(selected) {
  const m = mine();
  const groups = {};
  state.data.permisos.forEach(p => (groups[p.modulo] = groups[p.modulo] || []).push(p));
  return Object.entries(groups).map(([mod, list]) => `<div class="mt-perm-group"><h5>${esc(mod)}</h5><div class="mt-checks">${list.map(p => {
    const allowed = !p.reservado && (!m || m.has(p.codigo));
    return `<label class="mt-check-row ${allowed ? '' : 'disabled'}"><input type="checkbox" name="perm" value="${esc(p.codigo)}" ${selected.includes(p.codigo) ? 'checked' : ''} ${allowed ? '' : 'disabled'}> <span><code>${esc(p.codigo)}</code>${p.critico ? ' <span class="status bad">crítico</span>' : ''}<small>${esc(p.descripcion)}${p.reservado ? ' · reservado' : (allowed ? '' : ' · usted no lo tiene')}</small></span></label>`;
  }).join('')}</div></div>`).join('');
}

function permsForm(u) {
  const form = modal(`Permisos de ${u.NOMBRE}`, `<p class="metric-note">Permisos efectivos = permisos de sus roles + permisos adicionales. Aplica de inmediato en su próxima acción.</p>
    <fieldset class="mt-section"><legend>Roles</legend>${rolesChecks(u.ROLES)}</fieldset>
    <fieldset class="mt-section"><legend>Permisos adicionales</legend>${permChecks(u.PERMISOS_DIRECTOS)}</fieldset>
    <div class="field"><label for="a-motivo">Motivo del cambio (queda en la auditoría)</label><input id="a-motivo" name="motivo" maxlength="300"></div>
    <div class="mt-effective" data-effective></div>`,
  async form => {
    const f = new FormData(form);
    const r = await api.permisosUsuario(u.ID_USUARIO, f.getAll('rol'), f.getAll('perm'), f.get('motivo'));
    toast(r.sinCambios ? 'Sin cambios' : 'Permisos actualizados');
  });
  const update = () => {
    const f = new FormData(form);
    const set = new Set(f.getAll('perm'));
    f.getAll('rol').forEach(id => state.data.roles.find(r => r.ID_ROL === id)?.PERMISOS.forEach(p => set.add(p)));
    form.querySelector('[data-effective]').innerHTML = `<b>Permisos efectivos (${set.size}):</b> ${[...set].sort().map(p => `<span class="mt-chip">${esc(p)}</span>`).join(' ') || '<span class="muted">ninguno</span>'}`;
  };
  form.addEventListener('change', update);
  update();
}

function roleForm(r = null) {
  modal(r ? `Editar rol ${r.NOMBRE}` : 'Nuevo rol', `<div class="form-grid">
    <div class="field"><label for="r-nombre">Nombre *</label><input id="r-nombre" name="NOMBRE" maxlength="60" value="${esc(r?.NOMBRE || '')}"></div>
    <div class="field"><label for="r-desc">Descripción</label><input id="r-desc" name="DESCRIPCION" maxlength="300" value="${esc(r?.DESCRIPCION || '')}"></div></div>
    <fieldset class="mt-section"><legend>Permisos del rol</legend>${permChecks(r?.PERMISOS || [])}</fieldset>
    ${r ? '<p class="metric-note">Si el rol está asignado, el cambio afecta de inmediato a sus usuarios.</p>' : ''}`,
  async form => {
    const f = new FormData(form);
    await api.guardarRol(r?.ID_ROL || '', { NOMBRE: f.get('NOMBRE'), DESCRIPCION: f.get('DESCRIPCION'), PERMISOS: f.getAll('perm') });
    toast(r ? 'Rol actualizado' : 'Rol creado');
  });
}
