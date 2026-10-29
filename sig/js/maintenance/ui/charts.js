// Gráficas SVG sin librerías externas (funcionan sin internet y respetan la CSP).
import { esc } from './components.js';
import { HITOS } from '../domain/reliability.js';

export const COLORS = {
  operacion: '#2e9d4f', correctivo: '#d93025', preventivo: '#1a5fd0', inactividad: '#8a8f98', standby: '#1f9e9a',
  NO_REQUIERE_PRODUCCION: '#b06fc9', PARADA_EMERGENCIA_PLANTA: '#c49a1f', PARADA_MAYOR_PLANTA: '#c2571a', OTRA_INACTIVIDAD: '#a3a7ae', STANDBY: '#1f9e9a',
  bar: '#ed1c24', bar2: '#23262c', line: '#23262c', grid: '#e5e7eb', text: '#4b5563'
};
const W = 900;
const fmt = (v, d = 1) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: d });
const empty = msg => `<div class="mt-chart-empty">${esc(msg)}</div>`;

// Barras horizontales: items [{label, value, title?, color?}]
export function hBars(items, { unit = '', digits = 1, max = null, empty: e = 'Sin datos para graficar' } = {}) {
  if (!items.length) return empty(e);
  const top = (max ?? Math.max(...items.map(i => i.value), 0)) || 1;
  const rowH = 26, labelW = 260, h = items.length * rowH + 8;
  return `<svg class="mt-chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Gráfica de barras">${items.map((it, i) => {
    const y = i * rowH + 4, w = Math.max(1, (it.value / top) * (W - labelW - 90));
    return `<g><title>${esc(it.title || `${it.label}: ${fmt(it.value, digits)} ${unit}`)}</title>
      <text x="${labelW - 8}" y="${y + 16}" text-anchor="end" class="mt-chart-label">${esc(trunc(it.label, 38))}</text>
      <rect x="${labelW}" y="${y + 3}" width="${w}" height="${rowH - 8}" rx="3" fill="${it.color || COLORS.bar}"/>
      <text x="${labelW + w + 6}" y="${y + 16}" class="mt-chart-value">${fmt(it.value, digits)} ${esc(unit)}</text></g>`;
  }).join('')}</svg>`;
}

// Pareto: rows [{key, value, cum}] · labelFn(key)
export function paretoChart(rows, labelFn = k => k, { unit = 'fallas', empty: e = 'Sin fallas en el periodo' } = {}) {
  if (!rows.length) return empty(e);
  rows = rows.slice(0, 12);
  const h = 300, pad = { l: 44, r: 44, t: 16, b: 96 };
  const cw = (W - pad.l - pad.r) / rows.length, top = Math.max(...rows.map(r => r.value)) || 1;
  const y = v => pad.t + (1 - v / top) * (h - pad.t - pad.b);
  const yc = c => pad.t + (1 - c) * (h - pad.t - pad.b);
  const pts = rows.map((r, i) => `${pad.l + cw * i + cw / 2},${yc(r.cum)}`).join(' ');
  return `<svg class="mt-chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Pareto">
    <line x1="${pad.l}" x2="${W - pad.r}" y1="${yc(0.8)}" y2="${yc(0.8)}" stroke="${COLORS.text}" stroke-dasharray="4 4" opacity=".5"/><text x="${W - pad.r + 4}" y="${yc(0.8) + 4}" class="mt-chart-axis">80%</text>
    ${rows.map((r, i) => { const x = pad.l + cw * i + cw * 0.15, bh = h - pad.b - y(r.value); return `<g><title>${esc(labelFn(r.key))}: ${fmt(r.value)} ${unit} · acumulado ${fmt(r.cum * 100, 0)}%</title><rect x="${x}" y="${y(r.value)}" width="${cw * 0.7}" height="${bh}" rx="3" fill="${COLORS.bar}"/><text x="${x + cw * 0.35}" y="${y(r.value) - 4}" text-anchor="middle" class="mt-chart-value">${fmt(r.value)}</text><text transform="translate(${x + cw * 0.35},${h - pad.b + 12}) rotate(-35)" text-anchor="end" class="mt-chart-label">${esc(trunc(labelFn(r.key), 22))}</text></g>`; }).join('')}
    <polyline points="${pts}" fill="none" stroke="${COLORS.line}" stroke-width="2"/>${rows.map((r, i) => `<circle cx="${pad.l + cw * i + cw / 2}" cy="${yc(r.cum)}" r="3.5" fill="${COLORS.line}"/>`).join('')}
    <text x="${pad.l - 6}" y="${pad.t + 10}" text-anchor="end" class="mt-chart-axis">${fmt(top)}</text><text x="${W - pad.r + 4}" y="${pad.t + 10}" class="mt-chart-axis">100%</text>
  </svg>`;
}

// Líneas por mes: series [{name, color, values:[number|null]}], labels ['2026-07', …]
export function lineChart(labels, series, { unit = '', digits = 1, empty: e = 'Sin datos suficientes', labelFn = monthLabel } = {}) {
  const vals = series.flatMap(s => s.values).filter(v => v !== null && v !== undefined);
  if (!vals.length) return empty(e);
  const h = 230, pad = { l: 56, r: 16, t: 14, b: 40 };
  const top = Math.max(...vals) * 1.1 || 1;
  const x = i => pad.l + (labels.length === 1 ? (W - pad.l - pad.r) / 2 : i * (W - pad.l - pad.r) / (labels.length - 1));
  const y = v => pad.t + (1 - v / top) * (h - pad.t - pad.b);
  const grid = [0, 0.5, 1].map(f => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(top * f)}" y2="${y(top * f)}" stroke="${COLORS.grid}"/><text x="${pad.l - 6}" y="${y(top * f) + 4}" text-anchor="end" class="mt-chart-axis">${fmt(top * f, digits)}</text>`).join('');
  return `<svg class="mt-chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Tendencia">${grid}
    ${labels.map((l, i) => labels.length > 16 && i % Math.ceil(labels.length / 12) ? '' : `<text x="${x(i)}" y="${h - 14}" text-anchor="middle" class="mt-chart-axis">${esc(labelFn(l))}</text>`).join('')}
    ${series.map(s => {
      const segs = []; let cur = [];
      s.values.forEach((v, i) => { if (v === null || v === undefined) { if (cur.length) segs.push(cur); cur = []; } else cur.push(`${x(i)},${y(v)}`); });
      if (cur.length) segs.push(cur);
      return segs.map(sg => `<polyline points="${sg.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5"/>`).join('') +
        s.values.map((v, i) => v === null || v === undefined ? '' : `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.color}"><title>${esc(s.name)} ${esc(labelFn(labels[i]))}: ${fmt(v, digits)} ${esc(unit)}</title></circle>`).join('');
    }).join('')}
  </svg>${series.length > 1 ? `<div class="mt-legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}`;
}

// Línea de tiempo de estados (como el diagrama SMRP / ISO 14224)
// lanes: [{label, color, intervals:[[a,b]], hours}]
export function stateTimeline(from, to, lanes) {
  const labelW = 210, rowH = 34, pad = 28;
  const h = lanes.length * rowH + pad + 10;
  const x = t => labelW + (t - from) / (to - from) * (W - labelW - 60);
  const days = (to - from) / 86400000;
  const step = days <= 2 ? 6 * 3600000 : days <= 10 ? 86400000 : days <= 45 ? 7 * 86400000 : days <= 120 ? 14 * 86400000 : 30 * 86400000;
  const ticks = [];
  for (let t = from; t <= to; t += step) ticks.push(t);
  const tl = t => { const d = new Date(t); return days <= 2 ? `${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}h` : `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  return `<svg class="mt-chart mt-timeline-chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Línea de tiempo de estados">
    ${ticks.map(t => `<line x1="${x(t)}" x2="${x(t)}" y1="${pad - 6}" y2="${h - 6}" stroke="${COLORS.grid}" stroke-dasharray="3 3"/><text x="${x(t)}" y="${pad - 12}" text-anchor="middle" class="mt-chart-axis">${tl(t)}</text>`).join('')}
    ${lanes.map((ln, i) => {
      const yy = pad + i * rowH;
      return `<g><text x="0" y="${yy + 20}" class="mt-chart-label">${esc(ln.label)}</text>
        <line x1="${labelW}" x2="${W - 60}" y1="${yy + 16}" y2="${yy + 16}" stroke="${COLORS.grid}"/>
        ${ln.intervals.map(([a, b]) => `<rect x="${x(a)}" y="${yy + 9}" width="${Math.max(1.5, x(b) - x(a))}" height="14" rx="2" fill="${ln.color}"><title>${esc(ln.label)}: ${fmt((b - a) / 3600000)} h</title></rect>`).join('')}
        <text x="${W - 4}" y="${yy + 20}" text-anchor="end" class="mt-chart-value">${fmt(ln.hours)} h</text></g>`;
    }).join('')}
  </svg>`;
}

// Cronología de UNA intervención (concepto CMD): segmentos entre hitos
const SEG = [
  ['FECHA_HORA_FALLA', 'FECHA_HORA_AVISO_MTTO', 'Detección y reporte', '#c49a1f'],
  ['FECHA_HORA_AVISO_MTTO', 'FECHA_HORA_LLEGADA_MTTO', 'Respuesta (logístico)', '#8a8f98'],
  ['FECHA_HORA_LLEGADA_MTTO', 'FECHA_HORA_INICIO_DIAGNOSTICO', 'Preparación', '#a3a7ae'],
  ['FECHA_HORA_INICIO_DIAGNOSTICO', 'FECHA_HORA_FIN_DIAGNOSTICO', 'Diagnóstico', '#6f42c1'],
  ['FECHA_HORA_FIN_DIAGNOSTICO', 'FECHA_HORA_INICIO_REPARACION', 'Espera (repuesto / autorización)', '#f0a020'],
  ['FECHA_HORA_INICIO_REPARACION', 'FECHA_HORA_FIN_REPARACION', 'Reparación (wrench time)', '#d93025'],
  ['FECHA_HORA_FIN_REPARACION', 'FECHA_HORA_LIBERACION', 'Prueba y liberación', '#1a5fd0'],
  ['FECHA_HORA_LIBERACION', 'FECHA_HORA_RETORNO_SERVICIO', 'Retorno a servicio', '#1f9e9a']
];
export function interventionBar(t, msFn) {
  if (!t) return empty('Sin cronología registrada');
  const segs = SEG.map(([a, b, label, color]) => ({ a: msFn(t[a]), b: msFn(t[b]), label, color })).filter(s => Number.isFinite(s.a) && Number.isFinite(s.b) && s.b > s.a);
  if (!segs.length) return empty('Faltan hitos para dibujar la cronología');
  const t0 = Math.min(...segs.map(s => s.a)), t1 = Math.max(...segs.map(s => s.b));
  const x = v => (v - t0) / (t1 - t0) * (W - 20) + 10;
  const marks = HITOS.map(([k, l]) => ({ k, l, t: msFn(t[k]) })).filter(m => Number.isFinite(m.t));
  return `<svg class="mt-chart" viewBox="0 0 ${W} 120" role="img" aria-label="Cronología de la intervención">
    ${segs.map(s => `<rect x="${x(s.a)}" y="34" width="${Math.max(2, x(s.b) - x(s.a))}" height="30" fill="${s.color}"><title>${esc(s.label)}: ${fmt((s.b - s.a) / 60000, 0)} min</title></rect>${x(s.b) - x(s.a) > 60 ? `<text x="${(x(s.a) + x(s.b)) / 2}" y="54" text-anchor="middle" class="mt-chart-seg">${fmt((s.b - s.a) / 60000, 0)} min</text>` : ''}`).join('')}
    ${marks.map((m, i) => `<line x1="${x(m.t)}" x2="${x(m.t)}" y1="26" y2="72" stroke="#23262c" stroke-width="1"/><text x="${x(m.t)}" y="${i % 2 ? 90 : 104}" text-anchor="middle" class="mt-chart-axis"><title>${esc(m.l)}</title>${esc(m.l.split(' ')[0])}</text>`).join('')}
    <text x="10" y="18" class="mt-chart-axis">${esc(new Date(t0).toISOString().slice(0, 16).replace('T', ' '))}</text><text x="${W - 10}" y="18" text-anchor="end" class="mt-chart-axis">${esc(new Date(t1).toISOString().slice(0, 16).replace('T', ' '))}</text>
  </svg><div class="mt-legend">${segs.map(s => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>`;
}

function trunc(s, n) { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function monthLabel(k) { const [y, m] = String(k).split('-'); return m ? `${MESES[+m - 1]} ${y.slice(2)}` : k; }
