// Comunicación con el backend de Google Apps Script.
// Sin URL configurada funciona en modo demostración (guarda en el navegador).

const Store = {
  get(k, def) {
    try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* almacenamiento no disponible */ }
  }
};

const Api = (() => {
  const apiUrl = () => Store.get('tpm_api_url', '') || window.APP_CONFIG.API_URL;
  const modoDemo = () => !apiUrl();

  async function remoto(action, data) {
    let res;
    try {
      // Cuerpo como texto plano para evitar la verificación CORS previa de Apps Script
      res = await fetch(apiUrl(), {
        method: 'POST',
        body: JSON.stringify({ action, clave: Store.get('tpm_clave', ''), data })
      });
    } catch (e) {
      throw new Error('Sin conexión con el servidor. Revise internet o la URL en Ajustes.');
    }
    if (!res.ok) throw new Error('Error del servidor (' + res.status + ')');
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Error del servidor');
    return j.data;
  }

  // ---------- Modo demostración ----------
  const pad = (n, d) => String(n).padStart(d, '0');
  const ahora = () => {
    const d = new Date(), p = n => pad(n, 2);
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  function leerDemo() {
    try {
      return JSON.parse(Store.get('tpm_demo', '')) || null;
    } catch (e) { return null; }
  }
  function demoState() {
    return leerDemo() || { cont: {}, tarjetas: [], inventario: [] };
  }
  function guardarDemo(s) { Store.set('tpm_demo', JSON.stringify(s)); }
  function sig(s, k) { s.cont[k] = (s.cont[k] || 0) + 1; return s.cont[k]; }

  const demo = {
    ping: () => ({ ok: true, hora: ahora() }),
    crearTarjeta(d) {
      const s = demoState();
      const color = d.color === 'azul' ? 'azul' : 'roja';
      const tarjeta = (color === 'roja' ? 'TR-' : 'TA-') + pad(sig(s, 'tarjeta_' + color), 5);
      const aviso = 'AV-' + pad(sig(s, 'aviso'), 6);
      const fecha = ahora();
      const { foto, ...resto } = d;
      s.tarjetas.unshift({ ...resto, tarjeta, aviso, fecha, color: color === 'roja' ? 'Roja' : 'Azul', estado: 'Abierta' });
      guardarDemo(s);
      return { tarjeta, aviso, fecha, fotoUrl: '' };
    },
    subirImagenTarjeta: () => ({ url: '' }),
    cerrarTarjeta(d) {
      const s = demoState();
      const t = s.tarjetas.find(x => x.tarjeta === d.tarjeta);
      if (!t) throw new Error('No se encontró ' + d.tarjeta);
      Object.assign(t, { estado: 'Cerrada', fechaCierre: ahora(), firmaRecibido: d.firmaRecibido, observacionCierre: d.observacion || '' });
      guardarDemo(s);
      return { fechaCierre: t.fechaCierre };
    },
    listarTarjetas: () => demoState().tarjetas,
    crearActivo(d) {
      const s = demoState();
      const cod = (d.areaCodigo || 'GEN').toUpperCase();
      const codigo = 'SDA-' + cod + '-' + pad(sig(s, 'activo_' + cod), 4);
      const fecha = ahora();
      const { foto, areaCodigo, ...resto } = d;
      s.inventario.unshift({ ...resto, codigo, fecha });
      guardarDemo(s);
      return { codigo, fecha, fotoUrl: '' };
    },
    listarInventario: () => demoState().inventario
  };

  async function call(action, data = {}) {
    if (modoDemo()) {
      await new Promise(r => setTimeout(r, 250));
      return demo[action](data);
    }
    return remoto(action, data);
  }

  return { call, modoDemo, apiUrl };
})();
