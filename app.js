// App TPM Sodiacero: tarjetas rojas/azules + inventario de equipos.

const C = window.APP_CONFIG;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const fechaHora = d => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

let inventario = [];
let tarjetas = [];
let fotoTarjeta = '';
let fotoActivo = '';

// ---------- Utilidades de interfaz ----------
function toast(msg, tipo = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast visible ' + tipo;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.className = 'toast', 4500);
}

function abrirDialogo(html) {
  $('#dlg-body').innerHTML = html;
  const d = $('#dlg');
  if (!d.open) d.showModal();
  $('#dlg-body').scrollTop = 0;
}
const cerrarDialogo = () => $('#dlg').close();

function opciones(sel, lista, placeholder) {
  sel.innerHTML = (placeholder ? `<option value="">${esc(placeholder)}</option>` : '') +
    lista.map(v => `<option>${esc(v)}</option>`).join('');
}

function opcionesAgrupadas(sel, grupos, clave, placeholder) {
  sel.innerHTML = (placeholder ? `<option value="">${esc(placeholder)}</option>` : '') +
    grupos.map(g => `<optgroup label="${esc(g.grupo)}">${g[clave].map(v => `<option>${esc(v)}</option>`).join('')}</optgroup>`).join('');
}

function pillsCriticidad(cont) {
  cont.innerHTML = C.CRITICIDADES.map(c => `
    <label class="pill pill-crit">
      <input type="radio" name="criticidad" value="${c.valor}">
      <span><i>${c.valor}</i><b>${esc(c.nombre)}</b><small>${esc(c.desc)}</small></span>
    </label>`).join('');
}

const estadoInfo = nombre => C.ESTADOS_EQUIPO.find(e => e.nombre === nombre) || { nombre, color: 'gris', nivel: 0 };
const criticidadInfo = valor => C.CRITICIDADES.find(c => c.valor === valor);

// Combina el estado del equipo con su criticidad para ordenar qué intervenir primero
function prioridadActivo(a) {
  const nivel = estadoInfo(a.estado).nivel;
  if (nivel < 0) return { puntos: -1, nombre: 'Dado de baja', clase: 'baja' };
  const puntos = nivel * ({ A: 3, B: 2, C: 1 }[a.criticidad] || 1);
  if (puntos >= 6) return { puntos, nombre: 'Urgente', clase: 'urgente' };
  if (puntos >= 3) return { puntos, nombre: 'Alta', clase: 'alta' };
  if (puntos >= 1) return { puntos, nombre: 'Media', clase: 'media' };
  return { puntos, nombre: 'Sin novedad', clase: 'ok' };
}

function pills(cont, name, lista, tipo = 'radio', conNumero = false) {
  cont.innerHTML = lista.map((v, i) => `
    <label class="pill${conNumero ? ' pill-num' : ''}">
      <input type="${tipo}" name="${name}" value="${esc(v)}">
      <span>${conNumero ? `<i>${i + 1}</i>` : ''}${esc(v)}</span>
    </label>`).join('');
}

function enlazarArea(selArea, selUbic) {
  const wrap = selUbic.closest('.campo');
  const actualizar = () => {
    const a = C.AREAS.find(x => x.nombre === selArea.value);
    if (a && a.ubicaciones) {
      opciones(selUbic, a.ubicaciones, 'Seleccione hangar / ubicación');
      wrap.hidden = false;
    } else {
      selUbic.innerHTML = '';
      wrap.hidden = true;
    }
  };
  selArea.addEventListener('change', actualizar);
  actualizar();
  return actualizar;
}

function radioVal(form, name) {
  const r = form.querySelector(`input[name="${name}"]:checked`);
  return r ? r.value : '';
}

function comprimirImagen(file, max = 1280, calidad = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k);
      cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

function enlazarFoto(input, preview, alCambiar) {
  input.addEventListener('change', async () => {
    const f = input.files[0];
    if (!f) return;
    try {
      const data = await comprimirImagen(f);
      alCambiar(data);
      preview.innerHTML = `<img src="${data}" alt="Foto seleccionada"><button type="button" class="btn-quitar">Quitar foto</button>`;
      preview.classList.add('con-foto');
      $('.btn-quitar', preview).onclick = () => {
        alCambiar('');
        input.value = '';
        preview.innerHTML = '';
        preview.classList.remove('con-foto');
      };
    } catch (e) { toast(e.message, 'error'); }
  });
}

function ocupado(btn, si, texto) {
  if (si) { btn.dataset.txt = btn.textContent; btn.textContent = texto || 'Guardando…'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.txt || btn.textContent; btn.disabled = false; }
}

// ---------- Navegación ----------
function ir(vista) {
  $$('.vista').forEach(v => v.hidden = v.id !== 'v-' + vista);
  $$('[data-ir]').forEach(b => b.classList.toggle('activo', b.dataset.ir === vista));
  Store.set('tpm_vista', vista);
  if (vista === 'tarjetas') cargarTarjetas();
  if (vista === 'inventario') cargarInventario().then(pintarInventario).catch(() => {});
  window.scrollTo(0, 0);
}

// ---------- Tarjetas: formulario ----------
function colorActual() { return radioVal($('#f-tarjeta'), 'color') || 'roja'; }

function actualizarColor() {
  const c = colorActual();
  document.body.dataset.color = c;
  $('#pilar').textContent = c === 'roja' ? 'Mantenimiento planificado' : 'Mantenimiento autónomo';
  avisoClasificacion();
}

function avisoClasificacion() {
  const cl = radioVal($('#f-tarjeta'), 'clasificacion');
  const h = $('#hint-clasif');
  if (cl === C.CLASIFICACIONES[2] && colorActual() === 'azul') {
    h.innerHTML = 'Si requiere intervención de mantenimiento, normalmente se reporta con <b>tarjeta roja</b>. <button type="button" class="link" id="a-roja">Cambiar a roja</button>';
    h.hidden = false;
    $('#a-roja').onclick = () => { $('#f-tarjeta [name=color][value=roja]').checked = true; actualizarColor(); };
  } else if (cl && cl !== C.CLASIFICACIONES[2] && colorActual() === 'roja') {
    h.innerHTML = 'Limpieza y mantenimiento autónomo normalmente se reportan con <b>tarjeta azul</b>. <button type="button" class="link" id="a-azul">Cambiar a azul</button>';
    h.hidden = false;
    $('#a-azul').onclick = () => { $('#f-tarjeta [name=color][value=azul]').checked = true; actualizarColor(); };
  } else {
    h.hidden = true;
  }
}

function actualizarDatalist() {
  const area = $('#t-area').value;
  $('#dl-equipos').innerHTML = inventario
    .filter(a => !area || a.area === area)
    .map(a => `<option value="${esc(a.codigo + ' · ' + a.nombre)}">`).join('');
}

function activoDeTexto(v) {
  v = v.trim();
  return inventario.find(a => v === a.codigo + ' · ' + a.nombre || v.toUpperCase() === a.codigo);
}

function datosTarjeta() {
  const f = $('#f-tarjeta');
  const equipoTxt = $('#t-equipo').value.trim();
  const act = activoDeTexto(equipoTxt);
  return {
    color: colorActual(),
    clasificacion: radioVal(f, 'clasificacion'),
    area: $('#t-area').value,
    ubicacion: $('#t-ubicacion').closest('.campo').hidden ? '' : $('#t-ubicacion').value,
    linea: $('#t-linea').value.trim(),
    equipo: act ? act.nombre : equipoTxt,
    codigoActivo: act ? act.codigo : '',
    subEquipo: $('#t-sub').value.trim(),
    paso: $('#t-paso').value,
    reportadoPor: $('#t-reporta').value.trim(),
    prioridad: radioVal(f, 'prioridad'),
    anormalidad: $$('input[name=anormalidad]:checked', f).map(x => x.value).join(', '),
    descripcion: $('#t-desc').value.trim()
  };
}

function validarTarjeta(d) {
  const faltan = [];
  if (!d.clasificacion) faltan.push('clasificación');
  if (!d.area) faltan.push('área');
  if (!$('#t-ubicacion').closest('.campo').hidden && !d.ubicacion) faltan.push('hangar / ubicación');
  if (!d.equipo) faltan.push('equipo');
  if (!d.reportadoPor) faltan.push('reportado por');
  if (!d.prioridad) faltan.push('prioridad');
  if (!d.anormalidad) faltan.push('tipo de anormalidad');
  if (!d.descripcion) faltan.push('descripción del problema');
  return faltan;
}

async function guardarTarjeta(e) {
  e.preventDefault();
  const d = datosTarjeta();
  const faltan = validarTarjeta(d);
  if (faltan.length) { toast('Falta: ' + faltan.join(', '), 'error'); return; }
  if (!fotoTarjeta && !confirm('La tarjeta no tiene foto. ¿Guardar de todas formas?')) return;

  const btn = $('#btn-guardar-tarjeta');
  ocupado(btn, true, 'Generando número…');
  try {
    Store.set('tpm_nombre', d.reportadoPor);
    const r = await Api.call('crearTarjeta', { ...d, foto: fotoTarjeta });
    const reg = { ...d, ...r, color: d.color };
    btn.textContent = 'Generando imagen…';
    const imagen = await renderTarjeta(reg, fotoTarjeta);
    btn.textContent = 'Subiendo a Drive…';
    const subida = await subirImagen(reg, imagen);
    mostrarResultadoTarjeta(reg, imagen, subida);
    limpiarFormTarjeta();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    ocupado(btn, false);
  }
}

async function subirImagen(reg, imagen) {
  try {
    const r = await Api.call('subirImagenTarjeta', { tarjeta: reg.tarjeta, nombre: reg.tarjeta + ' - ' + reg.aviso, imagen });
    return { ok: true, url: r.url };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function mostrarResultadoTarjeta(reg, imagen, subida) {
  const estadoDrive = Api.modoDemo()
    ? '<p class="nota">Modo demostración: la imagen no se envía a Drive hasta configurar la conexión en Ajustes.</p>'
    : subida.ok
      ? `<p class="ok">✔ Imagen guardada en Google Drive. ${subida.url ? `<a href="${esc(subida.url)}" target="_blank" rel="noopener">Abrir en Drive</a>` : ''}</p>`
      : `<p class="error">No se pudo subir la imagen: ${esc(subida.error)} <button type="button" class="btn sec" id="btn-reintentar">Reintentar</button></p>`;
  abrirDialogo(`
    <h2>Tarjeta ${reg.color === 'roja' ? 'roja' : 'azul'} registrada</h2>
    <div class="res-nums">
      <div><span>Tarjeta</span><b>${esc(reg.tarjeta)}</b></div>
      <div><span>Aviso</span><b>${esc(reg.aviso)}</b></div>
      <div><span>Fecha</span><b>${esc(reg.fecha)}</b></div>
    </div>
    <div id="estado-drive">${estadoDrive}</div>
    <img class="res-img" src="${imagen}" alt="Tarjeta ${esc(reg.tarjeta)} diligenciada">
    <div class="acciones">
      <a class="btn sec" download="${esc(reg.tarjeta)}.jpg" href="${imagen}">Descargar imagen</a>
      <button type="button" class="btn" data-cerrar>Nueva tarjeta</button>
    </div>`);
  const re = $('#btn-reintentar');
  if (re) re.onclick = async () => {
    ocupado(re, true, 'Subiendo…');
    const s = await subirImagen(reg, imagen);
    if (s.ok) mostrarResultadoTarjeta(reg, imagen, s);
    else { ocupado(re, false); toast(s.error, 'error'); }
  };
}

function limpiarFormTarjeta() {
  const f = $('#f-tarjeta');
  const color = colorActual();
  const area = $('#t-area').value;
  const ubic = $('#t-ubicacion').value;
  f.reset();
  $(`[name=color][value=${color}]`, f).checked = true;
  $('#t-area').value = area;
  $('#t-area').dispatchEvent(new Event('change'));
  $('#t-ubicacion').value = ubic;
  $('#t-reporta').value = Store.get('tpm_nombre', '');
  fotoTarjeta = '';
  $('#t-foto-prev').innerHTML = '';
  $('#t-foto-prev').classList.remove('con-foto');
  $('#t-activo').hidden = true;
  actualizarColor();
}

// ---------- Imagen de la tarjeta (formato TPM) ----------
function htmlTarjeta(t, foto) {
  const roja = t.color === 'roja' || t.color === 'Roja';
  const anorm = (t.anormalidad || '').split(',').map(s => s.trim());
  const campo = (lbl, val, cls = '') => `<div class="tc-f ${cls}"><span>${lbl}</span><b>${esc(val) || '&nbsp;'}</b></div>`;
  return `
  <div class="tpm-card ${roja ? 'tc-roja' : 'tc-azul'}">
    <div class="tc-top">
      <div class="tc-num"><span>Tarjeta</span><b>${esc(t.tarjeta)}</b></div>
      <div class="tc-title">
        <div class="tc-emp">${esc(C.EMPRESA)}</div>
        <div class="tc-pilar">PILAR DEL<br><b>${roja ? 'MANTENIMIENTO PLANIFICADO' : 'MANTENIMIENTO AUTÓNOMO'}</b></div>
      </div>
      <div class="tc-num"><span>Aviso</span><b>${esc(t.aviso)}</b></div>
    </div>
    <div class="tc-body">
      <div class="tc-grid">
        ${campo('Fecha', t.fecha)}
        ${campo('Paso autónomo', t.paso)}
        ${campo('Área', t.area)}
        ${campo('Ubicación / Hangar', t.ubicacion)}
        ${campo('Línea', t.linea)}
        ${campo('Equipo', (t.codigoActivo ? t.codigoActivo + ' · ' : '') + (t.equipo || ''))}
        ${campo('Sub-equipo', t.subEquipo)}
        ${campo('Reportado por', t.reportadoPor)}
      </div>
      <div class="tc-fila">
        <div class="tc-prio"><span>Prioridad</span>
          ${['A', 'B', 'C'].map(p => `<i class="${t.prioridad === p ? 'sel' : ''}">${p}</i>`).join('')}
        </div>
        <div class="tc-clasif"><span>Clasificación</span><b>${esc(t.clasificacion)}</b></div>
      </div>
      <div class="tc-sec">TIPO DE ANORMALIDAD</div>
      <div class="tc-anorm">
        ${C.ANORMALIDADES.map((a, i) => `<div class="${anorm.includes(a) ? 'sel' : ''}"><i>${i + 1}</i><span>${esc(a)}</span><em>${anorm.includes(a) ? '✔' : ''}</em></div>`).join('')}
      </div>
      <div class="tc-sec">DESCRIPCIÓN DEL PROBLEMA</div>
      <div class="tc-desc">${esc(t.descripcion)}</div>
      <div class="tc-sec">REGISTRO FOTOGRÁFICO</div>
      <div class="tc-foto">${foto ? `<img src="${foto}" alt="">` : '<span>Sin foto</span>'}</div>
      <div class="tc-pie">
        <div>Fecha cierre <b>${esc(t.fechaCierre) || '______________'}</b></div>
        <div>Firma recibido <b>${esc(t.firmaRecibido) || '__________________'}</b></div>
        <div class="tc-tpm">TPM</div>
      </div>
    </div>
  </div>`;
}

async function renderTarjeta(reg, foto) {
  const host = $('#render-host');
  host.innerHTML = htmlTarjeta(reg, foto);
  await Promise.all($$('img', host).map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  try {
    const canvas = await html2canvas(host.firstElementChild, { scale: 2, backgroundColor: '#ffffff', logging: false });
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    host.innerHTML = '';
  }
}

// ---------- Tarjetas: listado ----------
async function cargarTarjetas() {
  const lista = $('#lista-tarjetas');
  lista.innerHTML = '<p class="vacio">Cargando…</p>';
  try {
    tarjetas = await Api.call('listarTarjetas', {});
    pintarTarjetas();
  } catch (err) {
    lista.innerHTML = `<p class="vacio error">${esc(err.message)}</p>`;
  }
}

function pintarTarjetas() {
  const color = $('#ft-color').value;
  const estado = $('#ft-estado').value;
  const q = $('#ft-buscar').value.trim().toLowerCase();
  const abiertas = c => tarjetas.filter(t => t.color === c && t.estado === 'Abierta').length;
  $('#resumen-tarjetas').innerHTML = `
    <div class="stat st-roja"><b>${abiertas('Roja')}</b><span>Rojas abiertas</span></div>
    <div class="stat st-azul"><b>${abiertas('Azul')}</b><span>Azules abiertas</span></div>
    <div class="stat"><b>${tarjetas.filter(t => t.estado === 'Cerrada').length}</b><span>Cerradas</span></div>`;

  const vis = tarjetas.filter(t =>
    (!color || t.color === color) && (!estado || t.estado === estado) &&
    (!q || [t.tarjeta, t.aviso, t.equipo, t.codigoActivo, t.area, t.ubicacion, t.descripcion, t.reportadoPor]
      .join(' ').toLowerCase().includes(q)));
  $('#lista-tarjetas').innerHTML = vis.length ? vis.map(t => `
    <button type="button" class="item ${t.color === 'Azul' ? 'it-azul' : 'it-roja'}" data-tarjeta="${esc(t.tarjeta)}">
      <div class="item-top">
        <b>${esc(t.tarjeta)}</b><span class="chip">${esc(t.aviso)}</span>
        <span class="estado ${t.estado === 'Cerrada' ? 'cerrada' : 'abierta'}">${esc(t.estado)}</span>
      </div>
      <div class="item-main">${esc(t.equipo)}${t.subEquipo ? ' — ' + esc(t.subEquipo) : ''}</div>
      <div class="item-meta">${esc(t.area)}${t.ubicacion ? ' · ' + esc(t.ubicacion) : ''} · ${esc(t.fecha)}</div>
      <div class="item-meta">${esc(t.clasificacion)} · Prioridad ${esc(t.prioridad)}</div>
    </button>`).join('') : '<p class="vacio">No hay tarjetas con esos filtros.</p>';
}

function detalleTarjeta(id) {
  const t = tarjetas.find(x => x.tarjeta === id);
  if (!t) return;
  const fila = (k, v) => v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '';
  const link = (k, url) => url ? `<dt>${k}</dt><dd><a href="${esc(url)}" target="_blank" rel="noopener">Abrir en Drive</a></dd>` : '';
  abrirDialogo(`
    <h2><span class="dot ${t.color === 'Azul' ? 'azul' : 'roja'}"></span>Tarjeta ${esc(t.tarjeta)}</h2>
    <dl class="detalle">
      ${fila('Aviso', t.aviso)}${fila('Estado', t.estado)}${fila('Fecha', t.fecha)}
      ${fila('Clasificación', t.clasificacion)}${fila('Área', t.area)}${fila('Ubicación', t.ubicacion)}
      ${fila('Línea', t.linea)}${fila('Equipo', t.equipo)}${fila('Código activo', t.codigoActivo)}
      ${fila('Sub-equipo', t.subEquipo)}${fila('Paso autónomo', t.paso)}${fila('Reportado por', t.reportadoPor)}
      ${fila('Prioridad', t.prioridad)}${fila('Anormalidad', t.anormalidad)}${fila('Descripción', t.descripcion)}
      ${link('Foto', t.fotoUrl)}${link('Imagen tarjeta', t.imagenUrl)}
      ${fila('Fecha cierre', t.fechaCierre)}${fila('Firma recibido', t.firmaRecibido)}${fila('Observación cierre', t.observacionCierre)}
    </dl>
    ${t.estado === 'Abierta' ? `
    <form id="f-cierre" class="cierre">
      <h3>Cerrar tarjeta</h3>
      <div class="campo"><label for="c-firma">Recibido por (nombre) *</label><input id="c-firma" required></div>
      <div class="campo"><label for="c-obs">Observación / trabajo realizado</label><textarea id="c-obs" rows="3"></textarea></div>
      <button class="btn" id="btn-cerrar-t">Cerrar tarjeta</button>
    </form>` : ''}
    <div class="acciones"><button type="button" class="btn sec" data-cerrar>Volver</button></div>`);
  const f = $('#f-cierre');
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const firma = $('#c-firma').value.trim();
    if (!firma) { toast('Escriba quién recibe', 'error'); return; }
    const btn = $('#btn-cerrar-t');
    ocupado(btn, true, 'Cerrando…');
    try {
      await Api.call('cerrarTarjeta', { tarjeta: t.tarjeta, firmaRecibido: firma, observacion: $('#c-obs').value.trim() });
      toast(`Tarjeta ${t.tarjeta} cerrada`, 'ok');
      cerrarDialogo();
      cargarTarjetas();
    } catch (err) {
      toast(err.message, 'error');
      ocupado(btn, false);
    }
  };
}

// ---------- Inventario ----------
async function cargarInventario() {
  try {
    inventario = await Api.call('listarInventario', {});
    actualizarDatalist();
  } catch (err) {
    if (!$('#v-inventario').hidden) $('#lista-inv').innerHTML = `<p class="vacio error">${esc(err.message)}</p>`;
    throw err;
  }
}

function pintarInventario() {
  const area = $('#fi-area').value;
  const estado = $('#fi-estado').value;
  const q = $('#fi-buscar').value.trim().toLowerCase();
  const enArea = inventario.filter(a => !area || a.area === area);
  $('#inv-resumen').innerHTML = [...C.ESTADOS_EQUIPO].sort((x, y) => y.nivel - x.nivel).map(e => `
    <button type="button" class="est-chip est-${e.color}${estado === e.nombre ? ' activo' : ''}" data-estado="${esc(e.nombre)}">
      <b>${enArea.filter(a => a.estado === e.nombre).length}</b>${esc(e.nombre)}
    </button>`).join('');

  const vis = enArea
    .filter(a => (!estado || a.estado === estado) &&
      (!q || [a.codigo, a.nombre, a.tipo, a.marca, a.modelo, a.serie, a.linea, a.ubicacion].join(' ').toLowerCase().includes(q)))
    .map(a => ({ a, p: prioridadActivo(a) }))
    .sort((x, y) => y.p.puntos - x.p.puntos || String(x.a.codigo).localeCompare(y.a.codigo));
  $('#inv-cuenta').textContent = `${vis.length} de ${inventario.length} activos · ordenados por prioridad de intervención`;
  $('#lista-inv').innerHTML = vis.length ? vis.map(({ a, p }) => {
    const color = estadoInfo(a.estado).color;
    const crit = criticidadInfo(a.criticidad);
    return `
    <button type="button" class="item it-inv borde-${color}" data-codigo="${esc(a.codigo)}">
      <div class="item-top"><b>${esc(a.codigo)}</b>${crit ? `<span class="chip">${esc(crit.valor)} · ${esc(crit.nombre)}</span>` : ''}
        <span class="prio prio-${p.clase}">${esc(p.nombre)}</span>
        <span class="estado est-${color}">${esc(a.estado)}</span></div>
      <div class="item-main">${esc(a.nombre)}</div>
      <div class="item-meta">${esc(a.area)}${a.ubicacion ? ' · ' + esc(a.ubicacion) : ''}${a.linea ? ' · ' + esc(a.linea) : ''}</div>
      <div class="item-meta">${[a.tipo, a.marca, a.modelo, a.capacidad].filter(Boolean).map(esc).join(' · ')}</div>
    </button>`;
  }).join('') : `<p class="vacio">${inventario.length ? 'Sin resultados.' : 'Aún no hay activos registrados.'}</p>`;
}

function detalleActivo(codigo) {
  const a = inventario.find(x => x.codigo === codigo);
  if (!a) return;
  const fila = (k, v) => v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '';
  abrirDialogo(`
    <h2>${esc(a.codigo)}</h2>
    <dl class="detalle">
      ${fila('Nombre', a.nombre)}${fila('Área', a.area)}${fila('Ubicación', a.ubicacion)}${fila('Línea / Proceso', a.linea)}
      ${fila('Tipo', a.tipo)}${fila('Marca', a.marca)}${fila('Modelo', a.modelo)}${fila('Serie', a.serie)}
      ${fila('Año', a.anio)}${fila('Capacidad / Potencia', a.capacidad)}
      ${fila('Criticidad', criticidadInfo(a.criticidad) ? a.criticidad + ' – ' + criticidadInfo(a.criticidad).nombre : a.criticidad)}
      ${fila('Estado', a.estado)}${fila('Prioridad', prioridadActivo(a).nombre)}${fila('Responsable', a.responsable)}${fila('Observaciones', a.observaciones)}
      ${fila('Registrado', a.fecha)}${fila('Registrado por', a.registradoPor)}
      ${a.fotoUrl ? `<dt>Foto</dt><dd><a href="${esc(a.fotoUrl)}" target="_blank" rel="noopener">Abrir en Drive</a></dd>` : ''}
    </dl>
    <div class="acciones">
      <button type="button" class="btn sec" data-cerrar>Volver</button>
      <button type="button" class="btn" id="btn-tarjeta-activo">Crear tarjeta para este equipo</button>
    </div>`);
  $('#btn-tarjeta-activo').onclick = () => {
    cerrarDialogo();
    ir('nueva');
    $('#t-area').value = a.area;
    $('#t-area').dispatchEvent(new Event('change'));
    if (a.ubicacion) $('#t-ubicacion').value = a.ubicacion;
    $('#t-linea').value = a.linea || '';
    $('#t-equipo').value = a.codigo + ' · ' + a.nombre;
    $('#t-equipo').dispatchEvent(new Event('input'));
  };
}

async function guardarActivo(e) {
  e.preventDefault();
  const areaSel = $('#i-area').value;
  const area = C.AREAS.find(x => x.nombre === areaSel);
  const ubicVisible = !$('#i-ubicacion').closest('.campo').hidden;
  const d = {
    area: areaSel, areaCodigo: area ? area.codigo : '',
    ubicacion: ubicVisible ? $('#i-ubicacion').value : '',
    linea: $('#i-linea').value.trim(), nombre: $('#i-nombre').value.trim(), tipo: $('#i-tipo').value,
    marca: $('#i-marca').value.trim(), modelo: $('#i-modelo').value.trim(), serie: $('#i-serie').value.trim(),
    anio: $('#i-anio').value.trim(),
    capacidad: $('#i-capacidad').value.trim() ? $('#i-capacidad').value.trim() + ' ' + $('#i-unidad').value : '',
    criticidad: radioVal($('#f-activo'), 'criticidad'), estado: $('#i-estado').value,
    responsable: $('#i-responsable').value.trim(), observaciones: $('#i-obs').value.trim(),
    registradoPor: Store.get('tpm_nombre', '')
  };
  const faltan = [];
  if (!d.area) faltan.push('área');
  if (ubicVisible && !d.ubicacion) faltan.push('hangar / ubicación');
  if (!d.nombre) faltan.push('nombre del equipo');
  if (!d.estado) faltan.push('estado');
  if (faltan.length) { toast('Falta: ' + faltan.join(', '), 'error'); return; }

  const btn = $('#btn-guardar-activo');
  ocupado(btn, true, 'Generando código…');
  try {
    const r = await Api.call('crearActivo', { ...d, foto: fotoActivo });
    abrirDialogo(`
      <h2>Activo registrado</h2>
      <p>Código asignado automáticamente:</p>
      <div class="codigo-grande">${esc(r.codigo)}</div>
      <p class="nota">${esc(d.nombre)} · ${esc(d.area)}${d.ubicacion ? ' · ' + esc(d.ubicacion) : ''}</p>
      <div class="acciones">
        <button type="button" class="btn sec" id="btn-ver-inv">Ver inventario</button>
        <button type="button" class="btn" data-cerrar>Registrar otro</button>
      </div>`);
    $('#btn-ver-inv').onclick = () => { cerrarDialogo(); modoInventario('lista'); };
    // Se conservan área, ubicación, línea y responsable para agilizar el levantamiento
    ['#i-nombre', '#i-marca', '#i-modelo', '#i-serie', '#i-anio', '#i-capacidad', '#i-obs'].forEach(s => $(s).value = '');
    $('#i-tipo').value = '';
    $$('[name=criticidad]', $('#f-activo')).forEach(x => x.checked = false);
    fotoActivo = '';
    $('#i-foto').value = '';
    $('#i-foto-prev').innerHTML = '';
    $('#i-foto-prev').classList.remove('con-foto');
    cargarInventario().then(pintarInventario).catch(() => {});
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    ocupado(btn, false);
  }
}

function modoInventario(m) {
  $$('[data-inv]').forEach(b => b.classList.toggle('activo', b.dataset.inv === m));
  $('#inv-registro').hidden = m !== 'registro';
  $('#inv-lista').hidden = m !== 'lista';
  if (m === 'lista') pintarInventario();
}

// ---------- Ajustes ----------
function pintarModo() {
  const demo = Api.modoDemo();
  $('#banner-demo').hidden = !demo;
  $('#a-estado').innerHTML = demo
    ? '<span class="estado abierta">Modo demostración</span> Los datos se guardan solo en este navegador.'
    : '<span class="estado cerrada">Conectado a Google</span> Los datos van a Google Sheets y Drive.';
}

async function probarConexion() {
  const btn = $('#btn-probar');
  ocupado(btn, true, 'Probando…');
  try {
    const r = await Api.call('ping', {});
    toast(Api.modoDemo() ? 'Modo demostración activo' : 'Conexión correcta. Hora del servidor: ' + r.hora, 'ok');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    ocupado(btn, false);
  }
}

// ---------- Inicio ----------
// Un link de instalación como .../#k=CLAVE guarda la clave en el dispositivo y la quita de la barra de direcciones.
function leerLinkInstalacion() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (!p.has('k')) return;
  Store.set('tpm_clave', p.get('k'));
  if (p.get('api')) Store.set('tpm_api_url', p.get('api'));
  history.replaceState(null, '', location.pathname + location.search);
}

function iniciar() {
  leerLinkInstalacion();
  const areas = C.AREAS.map(a => a.nombre);
  pills($('#t-clasif'), 'clasificacion', C.CLASIFICACIONES);
  pills($('#t-prio'), 'prioridad', ['A', 'B', 'C']);
  pills($('#t-anorm'), 'anormalidad', C.ANORMALIDADES, 'checkbox', true);
  pillsCriticidad($('#i-crit'));
  opciones($('#t-area'), areas, 'Seleccione el área');
  opciones($('#i-area'), areas, 'Seleccione el área');
  opciones($('#fi-area'), areas, 'Todas las áreas');
  opciones($('#t-paso'), ['1', '2', '3', '4', '5', '6', '7'], '—');
  opcionesAgrupadas($('#i-tipo'), C.TIPOS_EQUIPO, 'tipos', 'Seleccione');
  opcionesAgrupadas($('#i-unidad'), C.UNIDADES, 'unidades');
  const estados = C.ESTADOS_EQUIPO.map(e => e.nombre);
  opciones($('#i-estado'), estados);
  opciones($('#fi-estado'), estados, 'Todos los estados');
  enlazarArea($('#t-area'), $('#t-ubicacion'));
  enlazarArea($('#i-area'), $('#i-ubicacion'));

  const reloj = () => $('#reloj').textContent = fechaHora(new Date());
  reloj();
  setInterval(reloj, 1000);

  $('#t-reporta').value = Store.get('tpm_nombre', '');
  $$('[name=color]').forEach(r => r.addEventListener('change', actualizarColor));
  $('#t-clasif').addEventListener('change', avisoClasificacion);
  $('#t-area').addEventListener('change', actualizarDatalist);
  $('#t-equipo').addEventListener('input', () => {
    const a = activoDeTexto($('#t-equipo').value);
    $('#t-activo').hidden = !a;
    if (a) {
      $('#t-activo').textContent = 'Activo vinculado: ' + a.codigo;
      if (!$('#t-linea').value && a.linea) $('#t-linea').value = a.linea;
    }
  });
  enlazarFoto($('#t-foto'), $('#t-foto-prev'), v => fotoTarjeta = v);
  enlazarFoto($('#i-foto'), $('#i-foto-prev'), v => fotoActivo = v);
  $('#f-tarjeta').addEventListener('submit', guardarTarjeta);
  $('#f-activo').addEventListener('submit', guardarActivo);
  actualizarColor();

  $$('[data-ir]').forEach(b => b.addEventListener('click', () => ir(b.dataset.ir)));
  $$('[data-inv]').forEach(b => b.addEventListener('click', () => modoInventario(b.dataset.inv)));
  ['#ft-color', '#ft-estado'].forEach(s => $(s).addEventListener('change', pintarTarjetas));
  $('#ft-buscar').addEventListener('input', pintarTarjetas);
  $('#fi-area').addEventListener('change', pintarInventario);
  $('#fi-estado').addEventListener('change', pintarInventario);
  $('#inv-resumen').addEventListener('click', e => {
    const b = e.target.closest('[data-estado]');
    if (!b) return;
    $('#fi-estado').value = $('#fi-estado').value === b.dataset.estado ? '' : b.dataset.estado;
    pintarInventario();
  });
  $('#fi-buscar').addEventListener('input', pintarInventario);
  $('#btn-recargar').addEventListener('click', cargarTarjetas);
  $('#lista-tarjetas').addEventListener('click', e => {
    const b = e.target.closest('[data-tarjeta]'); if (b) detalleTarjeta(b.dataset.tarjeta);
  });
  $('#lista-inv').addEventListener('click', e => {
    const b = e.target.closest('[data-codigo]'); if (b) detalleActivo(b.dataset.codigo);
  });
  $('#dlg').addEventListener('click', e => {
    if (e.target.closest('[data-cerrar]') || e.target === $('#dlg')) cerrarDialogo();
  });

  $('#a-url').value = Store.get('tpm_api_url', '') || C.API_URL;
  $('#a-clave').value = Store.get('tpm_clave', '');
  $('#a-nombre').value = Store.get('tpm_nombre', '');
  $('#f-ajustes').addEventListener('submit', e => {
    e.preventDefault();
    Store.set('tpm_api_url', $('#a-url').value.trim());
    Store.set('tpm_clave', $('#a-clave').value);
    Store.set('tpm_nombre', $('#a-nombre').value.trim());
    $('#t-reporta').value = $('#a-nombre').value.trim();
    pintarModo();
    toast('Ajustes guardados', 'ok');
    cargarInventario().catch(() => {});
  });
  $('#btn-probar').addEventListener('click', probarConexion);
  pintarModo();

  ir(Store.get('tpm_vista', 'nueva'));
  modoInventario('registro');
  cargarInventario().catch(() => {});
}

document.addEventListener('DOMContentLoaded', iniciar);
