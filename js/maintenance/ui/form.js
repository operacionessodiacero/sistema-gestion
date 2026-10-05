// Formulario modal por secciones, generado desde domain/schema.js.
// A diferencia de ui.js/modal(), espera la respuesta del servidor: si falla, el formulario
// queda abierto con el error y el usuario no pierde lo que escribió.
import { esc } from './components.js';
import { validate, clean } from '../domain/schema.js';
import * as catalogs from '../services/catalogs.js';

/**
 * @param {object} o
 *  title, form (secciones), values (iniciales), editing (bool), submitLabel
 *  optionsFor: {campo: values => [{value,label}]}   opciones dinámicas (ej. ID_PADRE según NIVEL)
 *  suggestions: {clave: [texto]}                    sugerencias (datalist) para campos con `suggest`
 *  hidden: (campo, values) => bool                  oculta campos que no aplican
 *  refreshOn: [campos]                              al cambiar estos, se recalculan opciones/visibilidad
 *  preview: values => html                          vista previa en vivo de lo que calculará el sistema
 *  width: 'wide'                                     formulario más ancho
 *  onSubmit: async datosLimpios => void             lanza Error para mostrar el mensaje
 */
export function openForm(o) {
  const { form, editing = false } = o;
  const values = { ...(o.values || {}) };
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal mt-form' + (o.width === 'wide' ? ' mt-form-wide' : '');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `<div class="mt-form-head"><h3>${esc(o.title)}</h3><button type="button" class="btn btn-secondary btn-sm" data-close aria-label="Cerrar">✕</button></div>
    <form novalidate>${form.map((s, i) => `<fieldset class="mt-section"${i > 0 && s.collapsed ? ' data-collapsed' : ''}><legend>${esc(s.title)}</legend>${s.note ? `<p class="metric-note">${esc(s.note)}</p>` : ''}<div class="form-grid">${s.fields.map(f => fieldHtml(f, values, o, editing)).join('')}</div></fieldset>`).join('')}
      ${o.preview ? '<div class="mt-preview" data-preview aria-live="polite"></div>' : ''}
      <div class="mt-form-error" role="alert" hidden></div>
      <div class="toolbar mt-form-actions"><button class="btn btn-primary" type="submit">${esc(o.submitLabel || 'Guardar')}</button><button class="btn btn-secondary" type="button" data-close>Cancelar</button></div>
    </form>`;
  backdrop.append(modal);
  document.body.append(backdrop);

  const formEl = modal.querySelector('form');
  const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  modal.querySelectorAll('[data-close]').forEach(b => b.onclick = close);

  const read = () => { for (const el of formEl.elements) if (el.name && !el.disabled) values[el.name] = el.type === 'datetime-local' ? el.value.replace('T', ' ') : el.value; return values; };

  const refresh = (initial = false) => {
    if (!initial) read();
    for (const [name, fn] of Object.entries(o.optionsFor || {})) {
      const sel = formEl.elements[name];
      if (!sel || sel.disabled || sel.tagName !== 'SELECT') continue;
      sel.innerHTML = optionsHtml(fn(values), values[name]);
      values[name] = sel.value;
    }
    if (o.hidden) for (const s of form) for (const f of s.fields) {
      const wrap = formEl.querySelector(`[data-field="${f.name}"]`);
      if (wrap) wrap.hidden = !!o.hidden(f.name, values);
    }
  };
  for (const name of o.refreshOn || []) { const el = formEl.elements[name]; if (el) el.addEventListener('change', () => refresh()); }
  refresh(true);
  const drawPreview = () => { if (!o.preview) return; read(); modal.querySelector('[data-preview]').innerHTML = o.preview({ ...values }) || ''; };
  formEl.addEventListener('input', drawPreview);
  formEl.addEventListener('change', drawPreview);
  drawPreview();

  formEl.onsubmit = async e => {
    e.preventDefault();
    read();
    const visibleForm = form.map(s => ({ ...s, fields: s.fields.filter(f => !(o.hidden && o.hidden(f.name, values))) }));
    const errors = validate(visibleForm, values, { catalogHas: (cat, code) => catalogs.has(cat, code) || String(o.values?.[findCatField(form, cat)] ?? '') === String(code), editing });
    showErrors(errors);
    if (Object.keys(errors).length) return;
    const btn = formEl.querySelector('[type=submit]');
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Guardando…';
    try {
      await o.onSubmit(clean(visibleForm, values, { editing }));
      close();
    } catch (err) {
      const box = modal.querySelector('.mt-form-error');
      box.textContent = err.message;
      box.hidden = false;
      box.scrollIntoView({ block: 'nearest' });
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  };

  function showErrors(errors) {
    modal.querySelectorAll('.mt-field-error').forEach(x => x.remove());
    modal.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
    modal.querySelector('.mt-form-error').hidden = true;
    let first = null;
    for (const [name, msg] of Object.entries(errors)) {
      const el = formEl.elements[name];
      if (!el) continue;
      el.setAttribute('aria-invalid', 'true');
      el.insertAdjacentHTML('afterend', `<div class="mt-field-error">${esc(msg)}</div>`);
      first = first || el;
    }
    if (first) first.focus();
  }

  setTimeout(() => { const f = [...formEl.elements].find(el => el.name && !el.disabled && el.type !== 'hidden'); f && f.focus(); }, 30);
  return { close };
}

function findCatField(form, cat) { const f = form.flatMap(s => s.fields).find(x => x.cat === cat); return f ? f.name : ''; }

function fieldHtml(f, values, o, editing) {
  const v = values[f.name] ?? '';
  const id = 'mtf-' + f.name;
  const locked = editing && f.immutable;
  const attrs = `id="${id}" name="${esc(f.name)}"${locked ? ' disabled' : ''}${f.required ? ' aria-required="true"' : ''}`;
  let input;
  if (f.type === 'textarea') {
    input = `<textarea ${attrs} maxlength="${f.max || 2000}">${esc(v)}</textarea>`;
  } else if (f.type === 'select' || f.type === 'cat' || f.type === 'parent' || f.type === 'ref') {
    let opts = f.type === 'cat' ? catalogs.options(f.cat) : (f.options || []);
    // Conserva un valor histórico aunque ya no esté activo en el catálogo
    if (f.type === 'cat' && v !== '' && !opts.some(x => x.value === String(v))) opts = [...opts, { value: String(v), label: catalogs.label(f.cat, v) + ' (inactivo)' }];
    if (locked && f.type === 'select') opts = f.options.filter(x => x.value === v);
    // Referencia bloqueada (no editable): se muestra su etiqueta legible
    if (locked && (f.type === 'ref' || f.type === 'parent')) { const fn = o.optionsFor?.[f.name]; const found = fn ? fn(values).find(x => String(x.value) === String(v)) : null; opts = v ? [{ value: v, label: found ? found.label : String(v) }] : []; }
    input = `<select ${attrs}>${optionsHtml(opts, v, !f.required || !v)}</select>`;
  } else {
    const type = { number: 'number', int: 'number', date: 'date', url: 'url', datetime: 'datetime-local' }[f.type] || 'text';
    const extra = (f.type === 'number' ? ' step="any"' : '') + (f.type === 'int' ? ' step="1"' : '') +
      (f.min !== undefined && (f.type === 'number' || f.type === 'int') ? ` min="${f.min}"` : '') +
      (f.type !== 'number' && f.type !== 'int' && f.max ? ` maxlength="${f.max}"` : '') +
      (f.suggest ? ` list="${id}-list" autocomplete="off"` : '') + (f.type === 'url' ? ' placeholder="https://"' : '');
    const shown = f.type === 'datetime' ? String(v).replace(' ', 'T').slice(0, 16) : v;
    input = `<input type="${type}" ${attrs} value="${esc(shown)}"${extra}>` +
      (f.suggest ? `<datalist id="${id}-list">${((o.suggestions || {})[f.suggest] || []).map(s => `<option value="${esc(s)}">`).join('')}</datalist>` : '');
  }
  return `<div class="field${f.full ? ' full' : ''}" data-field="${esc(f.name)}"><label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}${locked ? ' <span class="mt-lock" title="No se puede cambiar después de crear">🔒</span>' : ''}</label>${input}${f.help ? `<div class="metric-note">${esc(f.help)}</div>` : ''}</div>`;
}

function optionsHtml(opts, current, withBlank = true) {
  const cur = String(current ?? '');
  return (withBlank ? '<option value="">— Seleccione —</option>' : '') +
    opts.map(x => `<option value="${esc(x.value)}"${String(x.value) === cur ? ' selected' : ''}>${esc(x.label)}</option>`).join('');
}
