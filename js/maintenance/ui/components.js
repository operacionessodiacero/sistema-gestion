// Piezas de interfaz reutilizables del módulo de mantenimiento (solo presentación).
import { esc } from '../../ui.js';

export { esc };

export const ND = '<span class="mt-nd" title="No hay datos primarios suficientes para calcularlo">N/D – Información insuficiente</span>';

export function emptyState({ icon = '◇', title, text = '', action = '' }) {
  return `<div class="mt-empty"><div class="mt-empty-icon" aria-hidden="true">${icon}</div><h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${action ? `<div class="mt-empty-actions">${action}</div>` : ''}</div>`;
}

// value: HTML ya seguro (usar esc o ND); note: texto plano
export function kpi(label, value, note = '') {
  return `<div class="card mt-kpi"><div class="label">${esc(label)}</div><div class="value">${value}</div>${note ? `<div class="metric-note">${esc(note)}</div>` : ''}</div>`;
}

const STATE_CLASS = {
  ACTIVO: 'good', OPERATIVO: 'good', CERRADA: 'good', CERRADO: 'good',
  INACTIVO: 'warn', EN_MANTENIMIENTO: 'warn', STANDBY: 'warn', ABIERTA: 'warn', ABIERTO: 'warn',
  ANULADO: 'bad', FUERA_SERVICIO: 'bad', BAJA: 'bad'
};
export function badge(code, label) {
  if (code === '' || code === undefined || code === null) return '<span class="muted">—</span>';
  return `<span class="status ${STATE_CLASS[code] || 'mt-neutral'}">${esc(label ?? code)}</span>`;
}

export function critBadge(code) {
  if (!code) return '<span class="muted">—</span>';
  return `<span class="mt-crit mt-crit-${esc(String(code).toLowerCase())}" title="Criticidad ${esc(code)}">${esc(code)}</span>`;
}

export function tabs(items, active, hrefBase) {
  return `<nav class="mt-tabs" role="tablist">${items.map(([key, label, extra]) =>
    `<a role="tab" href="${hrefBase}${key}" class="${key === active ? 'active' : ''}" aria-selected="${key === active}">${esc(label)}${extra ? ` <span class="mt-tab-count">${esc(extra)}</span>` : ''}</a>`).join('')}</nav>`;
}

export function dataTable(rows, cols, { onRowHref, empty = 'Sin registros' } = {}) {
  if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
  return `<div class="table-wrap"><table class="mt-table"><thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r =>
    `<tr${onRowHref ? ` class="mt-click" data-href="${esc(onRowHref(r))}"` : ''}>${cols.map(c => `<td>${c.html ? c.html(r) : esc(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// Hace navegables las filas creadas con onRowHref
export function bindRowLinks(root) {
  root.querySelectorAll('tr[data-href]').forEach(tr => {
    tr.tabIndex = 0;
    tr.onclick = e => { if (!e.target.closest('a,button')) location.hash = tr.dataset.href; };
    tr.onkeydown = e => { if (e.key === 'Enter') location.hash = tr.dataset.href; };
  });
}

export function fmtNumber(v, digits = 0) {
  if (v === '' || v === null || v === undefined || !Number.isFinite(Number(v))) return '';
  return Number(v).toLocaleString('es-CO', { maximumFractionDigits: digits });
}
export function fmtMoney(v) {
  if (v === '' || v === null || v === undefined || !Number.isFinite(Number(v))) return '';
  return Number(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

export function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }

// Diálogo de confirmación. Con requireReason devuelve el motivo escrito (o null si se cancela).
export function confirmDialog(message, { okLabel = 'Confirmar', danger = false, requireReason = false } = {}) {
  return new Promise(resolve => {
    const b = document.createElement('div');
    b.className = 'modal-backdrop';
    b.innerHTML = `<div class="modal mt-confirm" role="dialog" aria-modal="true"><p>${esc(message)}</p>${requireReason ? '<div class="field"><label for="mt-reason">Motivo *</label><textarea id="mt-reason" maxlength="500" placeholder="Explique por qué (queda en la auditoría)"></textarea><div class="mt-field-error" hidden></div></div>' : ''}<div class="toolbar"><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okLabel)}</button><button class="btn btn-secondary" data-cancel>Cancelar</button></div></div>`;
    const close = v => { b.remove(); resolve(v); };
    b.querySelector('[data-ok]').onclick = () => {
      if (!requireReason) return close(true);
      const r = b.querySelector('#mt-reason').value.trim();
      if (r.length < 5) { const e = b.querySelector('.mt-field-error'); e.textContent = 'Escriba el motivo (mínimo 5 caracteres)'; e.hidden = false; return; }
      close(r);
    };
    b.querySelector('[data-cancel]').onclick = () => close(requireReason ? null : false);
    b.onclick = e => { if (e.target === b) close(requireReason ? null : false); };
    document.body.append(b);
    (b.querySelector('#mt-reason') || b.querySelector('[data-ok]')).focus();
  });
}
