// Cálculos de confiabilidad, mantenibilidad y disponibilidad. Funciones PURAS: reciben los
// registros (data = {ACTIVOS, EVENTOS, TIEMPOS, OT, PERIODOS, ...}) y devuelven números.
// Regla: si falta un dato primario, el resultado es null ("N/D – Información insuficiente"). Nunca se inventa.
//
// Definiciones (minutos):
//   DT  = retorno a servicio − falla (inicio de parada)
//   Tiempo de respuesta = llegada de mtto − aviso a mtto
//   Diagnóstico = fin − inicio de diagnóstico
//   Reparación efectiva (wrench time) = fin − inicio de reparación
//   TTR = liberación − llegada de mantenimiento
//   LT (logístico) = esperas administrativa + personal + herramienta + otras
//   ST (suministro) = espera de repuesto
//   PD (demora de producción) = (reporte − detección) + espera de producción
//   NTTR = TTR − LT − ST
//   Tiempo total de intervención = retorno − aviso
//   UT/TTF = falla(n) − retorno(n−1) · TBF = falla(n) − falla(n−1)
//   MTBF = Σ UT / n · MTTR = Σ TTR / n
// Disponibilidad (tiempo calendario Tcal del periodo):
//   Ao (operacional, ISO 14224) = (Tcal − Tc − Tp) / Tcal
//   At (técnica, ISO 14224)     = (Tcal − Tc) / Tcal
//   SMRP = Uptime / (Uptime + Downtime) = (Tcal − Ti − Tc − Tp) / (Tcal − Ti)   (Uptime = operación + standby)
//   Tc: correctivo · Tp: preventivo · Ti: inactividad (no se requiere producción, paradas de planta)

import { descendantAssetIds, pathOf } from './hierarchy.js';

export const MIN = 60000;
export const ESPERAS_LT = ['MIN_ESPERA_ADMINISTRATIVA', 'MIN_ESPERA_PERSONAL', 'MIN_ESPERA_HERRAMIENTA', 'MIN_OTRAS_DEMORAS'];
export const HITOS = [
  ['FECHA_HORA_FALLA', 'Falla / inicio de parada'], ['FECHA_HORA_DETECCION', 'Detección'], ['FECHA_HORA_REPORTE', 'Reporte'],
  ['FECHA_HORA_AVISO_MTTO', 'Aviso a mantenimiento'], ['FECHA_HORA_LLEGADA_MTTO', 'Llegada de mantenimiento'],
  ['FECHA_HORA_INICIO_DIAGNOSTICO', 'Inicio de diagnóstico'], ['FECHA_HORA_FIN_DIAGNOSTICO', 'Fin de diagnóstico'],
  ['FECHA_HORA_INICIO_REPARACION', 'Inicio de reparación'], ['FECHA_HORA_FIN_REPARACION', 'Fin de reparación'],
  ['FECHA_HORA_PRUEBA', 'Prueba'], ['FECHA_HORA_LIBERACION', 'Liberación'], ['FECHA_HORA_RETORNO_SERVICIO', 'Retorno a servicio']
];

// 'yyyy-mm-dd HH:mm' → ms de reloj de pared (igual que el servidor). Solo para comparar/restar.
export function ms(v) {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : NaN;
}
export const fmtMs = t => new Date(t).toISOString().slice(0, 16).replace('T', ' ');
export function nowMs() { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()); }
const diff = (t, a, b) => { const x = ms(t[a]), y = ms(t[b]); return Number.isFinite(x) && Number.isFinite(y) ? (y - x) / MIN : null; };
const num = v => (v === '' || v === null || v === undefined ? 0 : Number(v) || 0);
const live = r => r && r.ESTADO_REGISTRO !== 'ANULADO';
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

/* ---------------------------- Cronología de un evento ---------------------------- */

export function cronoMetrics(t) {
  if (!t) return null;
  const lt = ESPERAS_LT.reduce((s, k) => s + num(t[k]), 0);
  const st = num(t.MIN_ESPERA_REPUESTO);
  const ttr = diff(t, 'FECHA_HORA_LLEGADA_MTTO', 'FECHA_HORA_LIBERACION');
  const rep = diff(t, 'FECHA_HORA_DETECCION', 'FECHA_HORA_REPORTE');
  return {
    dt: diff(t, 'FECHA_HORA_FALLA', 'FECHA_HORA_RETORNO_SERVICIO'),
    respuesta: diff(t, 'FECHA_HORA_AVISO_MTTO', 'FECHA_HORA_LLEGADA_MTTO'),
    diagnostico: diff(t, 'FECHA_HORA_INICIO_DIAGNOSTICO', 'FECHA_HORA_FIN_DIAGNOSTICO'),
    reparacion: diff(t, 'FECHA_HORA_INICIO_REPARACION', 'FECHA_HORA_FIN_REPARACION'),
    ttr, lt, st,
    pd: rep === null && !num(t.MIN_ESPERA_PRODUCCION) ? null : (rep || 0) + num(t.MIN_ESPERA_PRODUCCION),
    nttr: ttr === null ? null : ttr - lt - st,
    total: diff(t, 'FECHA_HORA_AVISO_MTTO', 'FECHA_HORA_RETORNO_SERVICIO'),
    prueba: diff(t, 'FECHA_HORA_FIN_REPARACION', 'FECHA_HORA_LIBERACION')
  };
}

// Clase de parada según el tipo de evento (catálogo TIPO_EVENTO, campo DESCRIPCION)
export function eventClass(data, tipo) {
  const c = (data.CATALOGOS || []).find(x => x.CATALOGO === 'TIPO_EVENTO' && String(x.CODIGO) === String(tipo));
  const d = String(c?.DESCRIPCION || '').toUpperCase();
  return d === 'PREVENTIVO' || d === 'SIN_PARADA' ? d : 'CORRECTIVO';
}
function inactivityClass(data, cat) {
  const c = (data.CATALOGOS || []).find(x => x.CATALOGO === 'CATEGORIA_INACTIVIDAD' && String(x.CODIGO) === String(cat));
  return String(c?.DESCRIPCION || '').toUpperCase() === 'STANDBY' ? 'STANDBY' : 'INACTIVO';
}

/* ---------------------------- Intervalos ---------------------------- */

export function union(list) {
  const s = list.filter(i => i[1] > i[0]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of s) { if (out.length && a <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b); else out.push([a, b]); }
  return out;
}
export const clip = (list, a, b) => list.map(([x, y]) => [Math.max(x, a), Math.min(y, b)]).filter(i => i[1] > i[0]);
export function subtract(A, B) {
  let out = A.map(i => [...i]);
  for (const [b0, b1] of B) {
    const next = [];
    for (const [a0, a1] of out) {
      if (b1 <= a0 || b0 >= a1) { next.push([a0, a1]); continue; }
      if (b0 > a0) next.push([a0, b0]);
      if (b1 < a1) next.push([b1, a1]);
    }
    out = next;
  }
  return out;
}
export const total = list => list.reduce((s, [a, b]) => s + (b - a), 0);

/* ---------------------------- Alcance ---------------------------- */

// Activos cubiertos por un alcance: un activo (con sus componentes) o un nodo (línea/proceso/planta)
export function scopeAssets(data, id) {
  const isAsset = (data.ACTIVOS || []).some(a => a.ID_ACTIVO === id);
  return new Set([...(isAsset ? [id] : []), ...descendantAssetIds(data, id)]);
}
// Referencias cuyos periodos de inactividad aplican: el propio alcance y sus ancestros (línea, proceso, planta)
function periodRefs(data, id) { return new Set([id, ...pathOf(data, id).map(p => p.id)]); }

function tiemposByEvent(data) {
  const m = {};
  for (const t of data.TIEMPOS || []) if (live(t)) m[t.ID_EVENTO] = t;
  return m;
}

// Eventos con parada del alcance, con su intervalo [inicio, retorno] si la cronología lo permite
export function stopEvents(data, assets) {
  const tByE = tiemposByEvent(data);
  return (data.EVENTOS || []).filter(e => live(e) && assets.has(e.ID_ACTIVO) && e.CON_PARADA === 'SI' && eventClass(data, e.TIPO_EVENTO) !== 'SIN_PARADA')
    .map(e => {
      const t = tByE[e.ID_EVENTO];
      const a = ms(t?.FECHA_HORA_FALLA || e.FECHA_EVENTO), b = ms(t?.FECHA_HORA_RETORNO_SERVICIO);
      return { ev: e, crono: t || null, clase: eventClass(data, e.TIPO_EVENTO), start: a, end: Number.isFinite(b) ? b : null, metrics: cronoMetrics(t) };
    });
}

/* ---------------------------- Disponibilidad ---------------------------- */

export function availability(data, scopeId, from, to) {
  const assets = scopeAssets(data, scopeId);
  const tcal = to - from;
  const stops = stopEvents(data, assets).filter(s => Number.isFinite(s.start) && s.start < to && (s.end === null || s.end > from));
  const incompletos = stops.filter(s => s.end === null);
  const corr = clip(union(stops.filter(s => s.clase === 'CORRECTIVO' && s.end).map(s => [s.start, s.end])), from, to);
  const prev = subtract(clip(union(stops.filter(s => s.clase === 'PREVENTIVO' && s.end).map(s => [s.start, s.end])), from, to), corr);
  const refs = periodRefs(data, scopeId);
  const periods = (data.PERIODOS || []).filter(p => p.ESTADO_REGISTRO === 'ACTIVO' && refs.has(p.ID_REFERENCIA));
  const byCat = {};
  for (const p of periods) (byCat[p.CATEGORIA] = byCat[p.CATEGORIA] || []).push([ms(p.INICIO), ms(p.FIN)]);
  const mtto = union([...corr, ...prev]);
  const inactRaw = union(periods.filter(p => inactivityClass(data, p.CATEGORIA) === 'INACTIVO').map(p => [ms(p.INICIO), ms(p.FIN)]));
  const inact = subtract(clip(inactRaw, from, to), mtto);
  const standby = subtract(subtract(clip(union(periods.filter(p => inactivityClass(data, p.CATEGORIA) === 'STANDBY').map(p => [ms(p.INICIO), ms(p.FIN)])), from, to), mtto), inact);
  const busy = union([...mtto, ...inact, ...standby]);
  const oper = subtract([[from, to]], busy);
  const h = x => x / 3600000;
  const Tc = h(total(corr)), Tp = h(total(prev)), Ti = h(total(inact)), Ts = h(total(standby)), Top = h(total(oper)), Tcal = h(tcal);
  const ok = incompletos.length === 0 && Tcal > 0;
  return {
    from, to, Tcal, Tc, Tp, Ti, Ts, Top,
    Ao: ok ? (Tcal - Tc - Tp) / Tcal : null,
    At: ok ? (Tcal - Tc) / Tcal : null,
    SMRP: ok && Tcal - Ti > 0 ? (Tcal - Ti - Tc - Tp) / (Tcal - Ti) : null,
    incompletos: incompletos.map(s => s.ev),
    lanes: {
      operacion: oper, correctivo: corr, preventivo: prev, standby,
      inactividad: inact,
      categorias: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, clip(union(v), from, to)]))
    },
    stops
  };
}

/* ---------------------------- Confiabilidad ---------------------------- */

// Fallas (TIPO_EVENTO = FALLA) del alcance en el periodo, ordenadas, con UT/TBF/TTR
export function failureStats(data, scopeId, from, to) {
  const assets = scopeAssets(data, scopeId);
  const tByE = tiemposByEvent(data);
  const all = (data.EVENTOS || []).filter(e => live(e) && assets.has(e.ID_ACTIVO) && e.TIPO_EVENTO === 'FALLA')
    .map(e => { const t = tByE[e.ID_EVENTO]; return { ev: e, start: ms(t?.FECHA_HORA_FALLA || e.FECHA_EVENTO), end: ms(t?.FECHA_HORA_RETORNO_SERVICIO), m: cronoMetrics(t) }; })
    .filter(f => Number.isFinite(f.start)).sort((a, b) => a.start - b.start);
  const inRange = all.filter(f => f.start >= from && f.start <= to);
  const ut = [], tbf = [];
  for (const f of inRange) {
    const i = all.indexOf(f);
    const prev = i > 0 ? all[i - 1] : null;
    if (!prev) continue;
    tbf.push((f.start - prev.start) / 3600000);
    if (Number.isFinite(prev.end)) ut.push((f.start - prev.end) / 3600000);
  }
  const ttr = inRange.map(f => f.m?.ttr).filter(x => x !== null && x !== undefined);
  const dt = inRange.map(f => f.m?.dt).filter(x => x !== null && x !== undefined);
  const wrench = inRange.map(f => f.m?.reparacion).filter(x => x !== null && x !== undefined);
  const lt = inRange.filter(f => f.m).map(f => f.m.lt + f.m.st);
  return {
    count: inRange.length, failures: inRange,
    mtbfH: mean(ut), mtbfN: ut.length, tbfH: mean(tbf),
    mttrMin: mean(ttr), mttrN: ttr.length,
    meanDtMin: mean(dt), dtMin: dt.length === inRange.length ? dt.reduce((s, x) => s + x, 0) : null,
    wrenchMin: mean(wrench), logisticMin: mean(lt),
    wrenchShare: ttr.length && wrench.length ? wrench.reduce((s, x) => s + x, 0) / ttr.reduce((s, x) => s + x, 0) : null
  };
}

export function pareto(items, keyFn, valueFn = () => 1) {
  const m = new Map();
  for (const it of items) { const k = keyFn(it); if (!k) continue; m.set(k, (m.get(k) || 0) + valueFn(it)); }
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const sum = rows.reduce((s, r) => s + r[1], 0);
  let acc = 0;
  return rows.map(([k, v]) => { acc += v; return { key: k, value: v, cum: sum ? acc / sum : 0 }; });
}

export function monthsBetween(from, to) {
  const out = [];
  const d = new Date(from); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
  while (d.getTime() <= to) { out.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); }
  return out;
}
export function monthRange(key) {
  const [y, m] = key.split('-').map(Number);
  return [Date.UTC(y, m - 1, 1), Date.UTC(y, m, 1)];
}

/* ---------------------------- Órdenes de trabajo ---------------------------- */

export function otStats(data, assets, from, to) {
  const hoy = new Date().toISOString().slice(0, 10);
  const ots = (data.OT || []).filter(o => live(o) && assets.has(o.ID_ACTIVO));
  const inRange = ots.filter(o => { const t = ms(o.FECHA_SOLICITUD); return t >= from && t <= to; });
  const open = ots.filter(o => o.ESTADO !== 'CERRADA');
  const prevProg = ots.filter(o => o.TIPO_MTTO === 'PREVENTIVO' && o.FECHA_PROGRAMADA && ms(o.FECHA_PROGRAMADA) >= from && ms(o.FECHA_PROGRAMADA) <= Math.min(to, ms(hoy)));
  const prevOnTime = prevProg.filter(o => o.ESTADO === 'CERRADA' && String(o.FECHA_FIN).slice(0, 10) <= String(o.FECHA_PROGRAMADA).slice(0, 10));
  const corr = inRange.filter(o => o.TIPO_MTTO === 'CORRECTIVO' || o.TIPO_MTTO === 'EMERGENCIA').length;
  const prev = inRange.filter(o => o.TIPO_MTTO === 'PREVENTIVO' || o.TIPO_MTTO === 'PREDICTIVO' || o.TIPO_MTTO === 'INSPECCION').length;
  const hasCost = inRange.some(o => 'COSTO_TOTAL' in o);
  return {
    total: inRange.length, open: open.length,
    overdue: open.filter(o => o.FECHA_PROGRAMADA && String(o.FECHA_PROGRAMADA).slice(0, 10) < hoy).length,
    backlogHours: open.reduce((s, o) => s + num(o.HORAS_HOMBRE), 0),
    corr, prev,
    pmCompliance: prevProg.length ? prevOnTime.length / prevProg.length : null, pmProgrammed: prevProg.length,
    hh: inRange.reduce((s, o) => s + num(o.HORAS_HOMBRE), 0),
    cost: hasCost ? inRange.reduce((s, o) => s + num(o.COSTO_TOTAL), 0) : null,
    costLabor: hasCost ? inRange.reduce((s, o) => s + num(o.COSTO_MANO_OBRA), 0) : null,
    costParts: hasCost ? inRange.reduce((s, o) => s + num(o.COSTO_REPUESTOS), 0) : null,
    costServices: hasCost ? inRange.reduce((s, o) => s + num(o.COSTO_SERVICIOS), 0) : null,
    list: inRange
  };
}

// Periodos de consulta estándar
export function rangeFor(key, custom = {}) {
  const to = nowMs();
  const day = 86400000;
  if (key === '30') return [to - 30 * day, to];
  if (key === '90') return [to - 90 * day, to];
  if (key === '365') return [to - 365 * day, to];
  if (key === 'custom' && custom.from && custom.to) return [ms(custom.from), ms(custom.to) + day];
  return [to - 30 * day, to];
}
