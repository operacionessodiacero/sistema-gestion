// Indicadores de la hoja de vida, calculados SOLO desde registros transaccionales.
// Regla: si no hay datos primarios suficientes, el valor es null y la UI muestra "N/D".
// Fase 1: conteos y costos directos. MTBF/MTTR/Disponibilidad/Downtime se calculan en
// domain/reliability.js a partir de 05_TIEMPOS (Fases 2 y 4).

const sum = (list, key) => list.reduce((s, r) => s + (Number(r[key]) || 0), 0);
const maxDate = list => list.filter(Boolean).sort().pop() || null;
const minDate = list => list.filter(Boolean).sort()[0] || null;

export function assetKpis(rec) {
  const ots = rec.OT || [];
  const eventos = rec.EVENTOS || [];
  const lecturas = (rec.LECTURAS || []).filter(l => l.VARIABLE === 'HORAS_OPERACION' && l.VALOR !== '');
  const hoy = new Date().toISOString().slice(0, 10);
  const lastHours = lecturas.sort((a, b) => String(a.FECHA_HORA).localeCompare(String(b.FECHA_HORA))).pop();
  return {
    horasOperacion: lastHours ? Number(lastHours.VALOR) : null,
    totalOT: ots.length,
    preventivos: ots.filter(o => o.TIPO_MTTO === 'PREVENTIVO').length,
    correctivos: ots.filter(o => o.TIPO_MTTO === 'CORRECTIVO' || o.TIPO_MTTO === 'EMERGENCIA').length,
    fallas: eventos.filter(e => e.TIPO_EVENTO === 'FALLA').length,
    downtimeMin: null,
    mtbfH: null,
    mttrMin: null,
    disponibilidad: null,
    ultimaIntervencion: maxDate(ots.map(o => String(o.FECHA_FIN || o.FECHA_INICIO || '').slice(0, 10))),
    proximoMantenimiento: minDate((rec.PLAN || []).filter(p => p.ESTADO !== 'INACTIVO').map(p => String(p.PROXIMA_EJECUCION || '').slice(0, 10)).filter(d => d >= hoy)),
    costoAcumulado: ots.length ? sum(ots, 'COSTO_TOTAL') : 0
  };
}
