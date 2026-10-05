// Dashboard gerencial: resumen de los datos REALES de Mantenimiento y Proyectos (Google Sheets vía la API segura).
// Cada bloque se muestra solo si el usuario tiene permiso de consultar ese módulo; el servidor vuelve a exigirlo.
import { can } from './permissions.js';
import * as mtto from './maintenance/services/api.js';
import * as pry from './projects/api.js';
import { plans } from './maintenance/services/operations.js';
import { planStatus } from './maintenance/ui/plan.js';
import { availability, otStats, rangeFor } from './maintenance/domain/reliability.js';
import { overdue } from './projects/ui/tracking.js';
import { esc, kpi, ND, fmtNumber } from './maintenance/ui/components.js';

let ctx = null;
let listening = false;

export function renderDashboard(context) {
  ctx = context;
  if (!listening) {
    listening = true;
    const again = () => { if ((location.hash || '').startsWith('#/dashboard')) paint(); };
    window.addEventListener('sodiacero:mtto', again);
    window.addEventListener('sodiacero:pry', again);
  }
  paint();
  if (can(ctx.user, 'mantenimiento.ver')) mtto.load();
  if (can(ctx.user, 'proyectos.ver')) pry.load();
}

const pct = v => (v === null || v === undefined || !Number.isFinite(Number(v)) ? ND : esc(fmtNumber(Number(v) * 100, 1) + ' %'));
const loading = text => `<div class="mt-loading" role="status"><span class="mt-spinner"></span> ${esc(text)}</div>`;
const failed = (text, err) => `<p class="metric-note">${esc(text)}: ${esc(err)}</p>`;
const alert = (n, text, href, cls) => `<a class="mt-alert-card ${n ? cls : 'ok'}" href="${href}"><b>${n}</b><span>${esc(text)}</span></a>`;

function paint() {
  const { content, user } = ctx;
  const blocks = [];
  if (can(user, 'mantenimiento.ver')) blocks.push(maintenanceBlock());
  if (can(user, 'proyectos.ver')) blocks.push(projectsBlock());
  content.innerHTML = `<div class="page-title"><div><h2>Dashboard Gerencial</h2><div class="muted">Resumen en línea de los registros en Google Sheets · últimos 30 días</div></div></div>
    ${blocks.length ? blocks.join('') : '<div class="panel"><p>No tiene módulos con indicadores asignados.</p></div>'}`;
}

function maintenanceBlock() {
  const st = mtto.getState();
  const head = '<h3 class="mt-section-title">Mantenimiento <a class="metric-note" href="#/mantenimiento">abrir módulo →</a></h3>';
  if (!st.ready) return head + (st.error ? failed('No se pudieron cargar los datos de mantenimiento', st.error) : loading('Cargando mantenimiento…'));
  const d = mtto.data();
  const live = r => r.ESTADO_REGISTRO !== 'ANULADO';
  const activos = (d.ACTIVOS || []).filter(live);
  if (!activos.length) return head + '<div class="panel"><p class="muted">Aún no hay activos registrados. Empiece por la jerarquía y el inventario de activos.</p></div>';
  const [from, to] = rangeFor('30');
  const ot = otStats(d, new Set(activos.map(a => a.ID_ACTIVO)), from, to);
  const plantas = (d.JERARQUIA || []).filter(n => live(n) && n.NIVEL === 'PLANTA');
  const disp = plantas.map(p => ({ p, a: availability(d, p.ID_NODO, from, to) }));
  const prevVencidos = plans.active().filter(p => planStatus(p).code === 'VENCIDO').length;
  const abiertos = (d.EVENTOS || []).filter(e => live(e) && e.ESTADO === 'ABIERTO').length;
  return head + `<section class="cards">
      ${disp.length === 1 ? kpi('Disponibilidad operacional (Ao)', pct(disp[0].a.Ao), disp[0].a.incompletos.length ? 'Hay paradas sin cronología completa' : esc(disp[0].p.NOMBRE_NODO)) : kpi('Activos registrados', esc(activos.length))}
      ${kpi('OT abiertas', esc(ot.open), `${fmtNumber(ot.backlogHours, 1)} h hombre registradas`)}
      ${kpi('Cumplimiento preventivo', pct(ot.pmCompliance), `${ot.pmProgrammed} preventivas programadas`)}
      ${kpi('OT del periodo', esc(ot.total), `${ot.corr} correctivas · ${ot.prev} planificadas`)}
    </section>
    ${disp.length > 1 ? `<section class="cards">${disp.map(x => kpi('Ao · ' + x.p.NOMBRE_NODO, pct(x.a.Ao), x.a.incompletos.length ? 'Paradas sin cronología completa' : '')).join('')}</section>` : ''}
    <section class="panel"><div class="mt-alert-grid">
      ${alert(ot.overdue, 'OT vencidas', '#/mantenimiento/ot', 'bad')}
      ${alert(prevVencidos, 'tareas preventivas vencidas', '#/mantenimiento/plan/preventivo', 'bad')}
      ${alert(abiertos, 'eventos abiertos sin atender', '#/mantenimiento/eventos', 'warn')}
    </div></section>`;
}

function projectsBlock() {
  const st = pry.getState();
  const head = '<h3 class="mt-section-title">Proyectos <a class="metric-note" href="#/proyectos">abrir módulo →</a></h3>';
  if (!st.ready) return head + (st.error ? failed('No se pudieron cargar los proyectos', st.error) : loading('Cargando proyectos…'));
  const vigentes = pry.rows('PROYECTOS').filter(p => pry.live(p) && !['CERRADO', 'CANCELADO'].includes(p.ESTADO));
  if (!vigentes.length) return head + '<div class="panel"><p class="muted">Aún no hay proyectos vigentes. Cree el primero desde el módulo Proyectos.</p></div>';
  const ids = new Set(vigentes.map(p => p.ID_PROYECTO));
  const venc = pry.rows('COMPROMISOS').filter(c => pry.live(c) && ids.has(c.ID_PROYECTO) && overdue(c)).length;
  const conSpi = vigentes.filter(p => p.SPI !== '' && p.SPI !== null && p.SPI !== undefined);
  const atrasados = conSpi.filter(p => Number(p.SPI) < 0.95);
  const riesgosAltos = pry.rows('RIESGOS').filter(r => pry.live(r) && ids.has(r.ID_PROYECTO) && !['CERRADO', 'MATERIALIZADO'].includes(r.ESTADO) && Number(r.NIVEL) >= 15).length;
  const enEjec = vigentes.filter(p => p.ESTADO === 'EN_EJECUCION');
  return head + `<section class="cards">
      ${kpi('Proyectos vigentes', esc(vigentes.length), `${vigentes.filter(p => p.TIPO === 'MEJORA_INTERNA').length} mejora continua · ${vigentes.filter(p => p.TIPO === 'EXTERNO').length} externos`)}
      ${kpi('En ejecución', esc(enEjec.length))}
      ${kpi('Atrasados (SPI < 0,95)', esc(atrasados.length), conSpi.length ? '' : 'Sin cronogramas con avance')}
      ${kpi('Compromisos vencidos', esc(venc), riesgosAltos ? `${riesgosAltos} riesgos altos abiertos` : '')}
    </section>
    <section class="panel"><h3>Avance de proyectos vigentes</h3>
      ${vigentes.sort((a, b) => String(a.CODIGO).localeCompare(String(b.CODIGO))).map(p => {
        const real = Number(p.AVANCE_PCT) || 0, plan = Number(p.AVANCE_PLAN_PCT) || 0;
        return `<a class="kpi-row" href="#/proyectos/${encodeURIComponent(p.ID_PROYECTO)}/resumen" style="color:inherit;text-decoration:none"><b>${esc(p.CODIGO)} · ${esc(p.NOMBRE)}</b><div class="bar" title="Plan ${fmtNumber(plan, 0)} %"><span style="width:${Math.min(100, real)}%"></span></div><b>${fmtNumber(real, 0)}% <span class="muted">/ ${fmtNumber(plan, 0)}%</span></b></a>`;
      }).join('')}
      <p class="metric-note">Avance real / planificado a hoy, calculado desde el cronograma.</p>
    </section>`;
}
