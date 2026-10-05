// Dashboard de mantenimiento: alertas accionables + indicadores del periodo + composición del inventario.
import * as assets from '../services/assets.js';
import * as hierarchy from '../services/hierarchy.js';
import * as catalogs from '../services/catalogs.js';
import { events, workOrders, plans, readings, timesOfEvent } from '../services/operations.js';
import { LEVEL_LABEL, ASSET_LEVELS } from '../domain/hierarchy.js';
import { esc, kpi, emptyState } from './components.js';
import { render as renderIndicators } from './indicators.js';
import { planStatus } from './plan.js';

export function render(el, { user }) {
  const list = assets.list();
  if (!list.length) {
    el.innerHTML = emptyState({ icon: '▦', title: 'El dashboard se alimenta del inventario y de los registros de mantenimiento', text: 'Registre la jerarquía y los activos para empezar. Los indicadores (MTBF, MTTR, disponibilidad…) se calculan a partir de eventos y tiempos reales, nunca de valores digitados.', action: '<a class="btn btn-primary" href="#/mantenimiento/activos">Ir al inventario</a>' });
    return;
  }
  const hoy = new Date().toISOString().slice(0, 10);
  const otVencidas = workOrders.where(o => o.ESTADO !== 'CERRADA' && o.FECHA_PROGRAMADA && String(o.FECHA_PROGRAMADA).slice(0, 10) < hoy);
  const planesVencidos = plans.active().filter(p => planStatus(p).code === 'VENCIDO');
  const sinCrono = events.where(e => e.CON_PARADA === 'SI' && (!timesOfEvent(e.ID_EVENTO) || !timesOfEvent(e.ID_EVENTO).FECHA_HORA_RETORNO_SERVICIO));
  const noFmea = events.where(e => e.EN_FMEA === 'NO');
  const lastByVar = {};
  readings.all().forEach(r => { const k = r.ID_ACTIVO + '|' + r.VARIABLE; if (!lastByVar[k] || String(r.FECHA_HORA) > String(lastByVar[k].FECHA_HORA)) lastByVar[k] = r; });
  const fuera = Object.values(lastByVar).filter(r => r.ESTADO === 'FUERA_DE_LIMITE');
  const abiertos = events.where(e => e.ESTADO === 'ABIERTO');
  const alert = (n, text, href, cls) => n ? `<a class="mt-alert-card ${cls}" href="${href}"><b>${n}</b><span>${esc(text)}</span></a>` : '';
  const alerts = [
    alert(otVencidas.length, 'OT vencidas', '#/mantenimiento/ot', 'bad'),
    alert(planesVencidos.length, 'tareas preventivas vencidas', '#/mantenimiento/plan/preventivo', 'bad'),
    alert(fuera.length, 'variables fuera de límite (última lectura)', '#/mantenimiento/plan/lecturas', 'bad'),
    alert(abiertos.length, 'eventos abiertos sin atender', '#/mantenimiento/eventos', 'warn'),
    alert(sinCrono.length, 'paradas sin cronología completa', '#/mantenimiento/eventos', 'warn'),
    alert(noFmea.length, 'fallas no contempladas en el FMEA', '#/mantenimiento/eventos', 'warn')
  ].join('');
  const count = (key, value) => list.filter(a => String(a[key]) === String(value)).length;

  el.innerHTML = `
    <section class="panel"><h3>Atención requerida</h3>${alerts ? `<div class="mt-alert-grid">${alerts}</div>` : '<p class="muted">Sin alertas pendientes.</p>'}</section>
    <h3 class="mt-section-title">Indicadores del periodo</h3>
    <div data-ind></div>
    <h3 class="mt-section-title">Inventario</h3>
    <section class="cards">
      ${kpi('Activos registrados', esc(list.length), ASSET_LEVELS.map(l => `${count('NIVEL_JERARQUIA', l)} ${LEVEL_LABEL[l].toLowerCase()}`).join(' · '))}
      ${kpi('Procesos / líneas', esc(`${hierarchy.byLevel('PROCESO').length} / ${hierarchy.byLevel('LINEA').length}`))}
      ${kpi('Activos críticos (A)', esc(count('CRITICIDAD', 'A')))}
      ${kpi('Fuera de servicio', esc(count('ESTADO_ACTIVO', 'FUERA_SERVICIO')), catalogs.label('ESTADO_ACTIVO', 'EN_MANTENIMIENTO') + ': ' + count('ESTADO_ACTIVO', 'EN_MANTENIMIENTO'))}
    </section>`;
  renderIndicators(el.querySelector('[data-ind]'), { user, compact: true });
}
