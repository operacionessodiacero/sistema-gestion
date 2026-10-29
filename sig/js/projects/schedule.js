// ARCHIVO GENERADO a partir de backend-privado/proyectos/Cronograma.gs — no editar a mano (ver build_schedule.sh).
/**
 * SODIACERO — CRONOGRAMA: motor de programación de proyectos (método de la ruta crítica, CPM).
 *
 * Código PURO (sin servicios de Google). Este mismo archivo se usa:
 *   - en el servidor (Apps Script), que es quien guarda las fechas calculadas en Sheets;
 *   - en el navegador (web/js/projects/schedule.js, generado a partir de este archivo) para vista previa.
 * Si lo modifica, regenere schedule.js (ver INSTALACION.md).
 *
 * Modelo (equivalente a MS Project):
 *   - Duración en días hábiles (lunes a viernes, o lunes a sábado) descontando festivos.
 *   - Inicio y fin INCLUSIVOS: una tarea de 1 día empieza y termina el mismo día.
 *   - Hito = duración 0.
 *   - Dependencias entre actividades de detalle (no resumen): FS (fin-inicio), SS (inicio-inicio),
 *     FF (fin-fin), con adelanto/retraso en días hábiles. Formato: "ACT-00003:FS:+2, ACT-00007:SS".
 *   - Restricción "no comenzar antes de" y fechas reales (las reales mandan sobre lo planificado).
 *   - Actividades resumen: inicio = mínimo, fin = máximo y avance ponderado por duración de sus hijas.
 *   - Holgura total y ruta crítica (holgura ≤ 0).
 */

function crDia_(texto) {
  const m = String(texto || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
}
function crTexto_(dia) { return new Date(dia * 86400000).toISOString().slice(0, 10); }

function crCalendario_(diasLaborables, festivos) {
  const habiles = diasLaborables === 'L-S' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const fest = {};
  (festivos || []).forEach(function (f) { const d = crDia_(f); if (d !== null) fest[d] = 1; });
  const esHabil = function (d) { return habiles.indexOf(new Date(d * 86400000).getUTCDay()) !== -1 && !fest[d]; };
  const siguienteHabil = function (d) { let x = d, g = 0; while (!esHabil(x) && g++ < 400) x++; return x; };
  // n días hábiles después (n > 0) o antes (n < 0) de d
  const sumar = function (d, n) {
    let x = d, k = Math.abs(n), g = 0;
    const paso = n < 0 ? -1 : 1;
    while (k > 0 && g++ < 40000) { x += paso; if (esHabil(x)) k--; }
    return x;
  };
  // días hábiles entre a y b, ambos inclusive
  const contar = function (a, b) { let n = 0; for (let x = a; x <= b; x++) if (esHabil(x)) n++; return n; };
  return { esHabil: esHabil, siguienteHabil: siguienteHabil, sumar: sumar, contar: contar };
}

// "ACT-00003:FS:+2, ACT-00007:SS" → [{id, tipo, lag}]
function crPredecesoras_(texto) {
  return String(texto || '').split(/[,;]/).map(function (t) { return t.trim(); }).filter(Boolean).map(function (t) {
    const p = t.split(':');
    const tipo = String(p[1] || 'FS').toUpperCase();
    return { id: p[0].trim(), tipo: ['FS', 'SS', 'FF'].indexOf(tipo) === -1 ? 'FS' : tipo, lag: parseInt(p[2] || '0', 10) || 0 };
  });
}

/**
 * @param proyecto    {FECHA_INICIO:'yyyy-mm-dd', DIAS_LABORABLES:'L-V'|'L-S'}
 * @param actividades activas del proyecto (sin anuladas), con fechas en texto 'yyyy-mm-dd'
 * @param festivos    ['yyyy-mm-dd', …]
 * @param hoyTexto    fecha de corte para el avance planificado ('yyyy-mm-dd')
 */
function programarProyecto(proyecto, actividades, festivos, hoyTexto) {
  const cal = crCalendario_(proyecto.DIAS_LABORABLES, festivos);
  const errores = [];
  const porId = {}, hijos = {};
  actividades.forEach(function (a) { porId[a.ID_ACTIVIDAD] = a; });
  actividades.forEach(function (a) {
    const padre = a.ID_PADRE && porId[a.ID_PADRE] ? a.ID_PADRE : '';
    (hijos[padre] = hijos[padre] || []).push(a);
  });
  Object.keys(hijos).forEach(function (k) {
    hijos[k].sort(function (x, y) { return (Number(x.ORDEN) || 0) - (Number(y.ORDEN) || 0) || String(x.ID_ACTIVIDAD).localeCompare(String(y.ID_ACTIVIDAD)); });
  });

  // 1. EDT, nivel y orden de filas (recorrido en profundidad)
  const r = {}, orden = [], visto = {};
  (function recorrer(padre, prefijo, nivel) {
    (hijos[padre] || []).forEach(function (a, i) {
      if (visto[a.ID_ACTIVIDAD]) return;
      visto[a.ID_ACTIVIDAD] = 1;
      const edt = prefijo ? prefijo + '.' + (i + 1) : String(i + 1);
      r[a.ID_ACTIVIDAD] = { EDT: edt, NIVEL: nivel, ES_RESUMEN: (hijos[a.ID_ACTIVIDAD] || []).length > 0 ? 'SI' : 'NO' };
      orden.push(a.ID_ACTIVIDAD);
      recorrer(a.ID_ACTIVIDAD, edt, nivel + 1);
    });
  })('', '', 1);
  actividades.forEach(function (a) { if (!r[a.ID_ACTIVIDAD]) errores.push('Jerarquía circular en ' + a.ID_ACTIVIDAD); });

  const hojas = orden.filter(function (id) { return r[id].ES_RESUMEN === 'NO'; });
  const esHoja = {};
  hojas.forEach(function (id) { esHoja[id] = 1; });
  const dur = {}, preds = {}, sucs = {};
  hojas.forEach(function (id) {
    const a = porId[id];
    dur[id] = a.TIPO === 'HITO' ? 0 : Math.max(0, Math.round(Number(a.DURACION_DIAS) || 0));
    preds[id] = crPredecesoras_(a.PREDECESORAS).filter(function (p) {
      if (p.id === id || !esHoja[p.id]) { errores.push(id + ': predecesora no válida ' + p.id); return false; }
      return true;
    });
    preds[id].forEach(function (p) { (sucs[p.id] = sucs[p.id] || []).push({ id: id, tipo: p.tipo, lag: p.lag }); });
  });

  // 2. Orden topológico (Kahn). Un ciclo se reporta y se rompe en el orden de la EDT.
  const grado = {}, topo = [];
  hojas.forEach(function (id) { grado[id] = preds[id].length; });
  const cola = hojas.filter(function (id) { return grado[id] === 0; });
  while (cola.length) {
    const id = cola.shift();
    topo.push(id);
    (sucs[id] || []).forEach(function (s) { if (--grado[s.id] === 0) cola.push(s.id); });
  }
  if (topo.length < hojas.length) {
    errores.push('Dependencia circular entre actividades: ' + hojas.filter(function (id) { return topo.indexOf(id) === -1; }).join(', '));
    hojas.forEach(function (id) { if (topo.indexOf(id) === -1) topo.push(id); });
  }

  // 3. Pasada hacia adelante
  const inicioProyecto = cal.siguienteHabil(crDia_(proyecto.FECHA_INICIO) || crDia_(hoyTexto));
  const es = {}, ef = {};
  topo.forEach(function (id) {
    const a = porId[id], D = dur[id];
    let e = inicioProyecto;
    const restr = crDia_(a.INICIO_RESTRICCION);
    if (restr !== null) e = Math.max(e, restr);
    preds[id].forEach(function (p) {
      if (es[p.id] === undefined) return;
      const Dp = dur[p.id];
      let c;
      if (p.tipo === 'SS') c = cal.sumar(es[p.id], p.lag);
      else if (p.tipo === 'FF') { const f = cal.sumar(ef[p.id], p.lag); c = D === 0 ? f : cal.sumar(f, -(D - 1)); }
      else c = cal.sumar((Dp === 0 || D === 0) ? ef[p.id] : cal.sumar(ef[p.id], 1), p.lag);
      e = Math.max(e, c);
    });
    e = cal.siguienteHabil(e);
    const realIni = crDia_(a.FECHA_INICIO_REAL), realFin = crDia_(a.FECHA_FIN_REAL);
    if (realIni !== null) e = realIni;
    es[id] = e;
    ef[id] = D === 0 ? e : cal.sumar(e, D - 1);
    if (realFin !== null && Number(a.AVANCE_PCT) >= 100 && realFin >= e) ef[id] = realFin;
  });
  const finProyecto = hojas.length ? Math.max.apply(null, hojas.map(function (id) { return ef[id]; })) : inicioProyecto;

  // 4. Pasada hacia atrás: holgura total y ruta crítica
  const ls = {}, lf = {};
  topo.slice().reverse().forEach(function (id) {
    const D = dur[id];
    let f = finProyecto;
    (sucs[id] || []).forEach(function (s) {
      if (ls[s.id] === undefined) return;
      let c;
      if (s.tipo === 'SS') { const l = cal.sumar(ls[s.id], -s.lag); c = D === 0 ? l : cal.sumar(l, D - 1); }
      else if (s.tipo === 'FF') c = cal.sumar(lf[s.id], -s.lag);
      else { const l = cal.sumar(ls[s.id], -s.lag); c = (D === 0 || dur[s.id] === 0) ? l : cal.sumar(l, -1); }
      f = Math.min(f, c);
    });
    lf[id] = f;
    ls[id] = D === 0 ? f : cal.sumar(f, -(D - 1));
  });

  // 5. Avance planificado a la fecha de corte (contra línea base si existe)
  const hoy = crDia_(hoyTexto);
  const planPct = function (id) {
    const a = porId[id];
    const ini = crDia_(a.LB_INICIO) !== null ? crDia_(a.LB_INICIO) : es[id];
    const fin = crDia_(a.LB_FIN) !== null ? crDia_(a.LB_FIN) : ef[id];
    if (hoy === null) return 0;
    if (hoy < ini) return 0;
    if (hoy >= fin) return 100;
    return Math.min(100, cal.contar(ini, hoy) / Math.max(1, cal.contar(ini, fin)) * 100);
  };

  hojas.forEach(function (id) {
    const a = porId[id];
    const h = ls[id] >= es[id] ? cal.contar(es[id], ls[id]) - 1 : -(cal.contar(ls[id], es[id]) - 1);
    const av = Math.max(0, Math.min(100, Number(a.AVANCE_PCT) || 0));
    Object.assign(r[id], {
      FECHA_INICIO: crTexto_(es[id]), FECHA_FIN: crTexto_(ef[id]), DURACION_CALC: dur[id],
      HOLGURA_DIAS: h, CRITICA: h <= 0 && av < 100 ? 'SI' : 'NO', AVANCE_PCT: av, AVANCE_PLAN_PCT: Math.round(planPct(id) * 10) / 10,
      PESO: dur[id]
    });
  });

  // 6. Actividades resumen (de abajo hacia arriba)
  orden.slice().reverse().forEach(function (id) {
    if (r[id].ES_RESUMEN !== 'SI') return;
    const hs = (hijos[id] || []).map(function (h) { return r[h.ID_ACTIVIDAD]; }).filter(function (x) { return x && x.FECHA_INICIO; });
    if (!hs.length) return;
    const ini = Math.min.apply(null, hs.map(function (x) { return crDia_(x.FECHA_INICIO); }));
    const fin = Math.max.apply(null, hs.map(function (x) { return crDia_(x.FECHA_FIN); }));
    const peso = hs.reduce(function (s, x) { return s + x.PESO; }, 0);
    const pond = function (k) { return peso ? hs.reduce(function (s, x) { return s + x[k] * x.PESO; }, 0) / peso : hs.reduce(function (s, x) { return s + x[k]; }, 0) / hs.length; };
    Object.assign(r[id], {
      FECHA_INICIO: crTexto_(ini), FECHA_FIN: crTexto_(fin), DURACION_CALC: cal.contar(ini, fin),
      HOLGURA_DIAS: Math.min.apply(null, hs.map(function (x) { return x.HOLGURA_DIAS; })),
      CRITICA: hs.some(function (x) { return x.CRITICA === 'SI'; }) ? 'SI' : 'NO',
      AVANCE_PCT: Math.round(pond('AVANCE_PCT') * 10) / 10, AVANCE_PLAN_PCT: Math.round(pond('AVANCE_PLAN_PCT') * 10) / 10,
      PESO: peso
    });
  });

  // 7. Estado de cada actividad y totales del proyecto (valor ganado)
  orden.forEach(function (id) {
    const x = r[id];
    if (!x.FECHA_INICIO) return;
    x.ESTADO_CALC = x.AVANCE_PCT >= 100 ? 'COMPLETADA' : (hoy !== null && hoy > crDia_(x.FECHA_FIN) ? 'ATRASADA' : (x.AVANCE_PCT > 0 ? 'EN_CURSO' : (hoy !== null && hoy >= crDia_(x.FECHA_INICIO) ? 'DEBIO_INICIAR' : 'NO_INICIADA')));
  });
  let pesoT = 0, real = 0, plan = 0, PV = 0, EV = 0, AC = 0, BAC = 0;
  hojas.forEach(function (id) {
    const x = r[id], a = porId[id];
    pesoT += x.PESO; real += x.AVANCE_PCT * x.PESO; plan += x.AVANCE_PLAN_PCT * x.PESO;
    const cp = Number(a.COSTO_PLANIFICADO) || 0;
    BAC += cp; PV += cp * x.AVANCE_PLAN_PCT / 100; EV += cp * x.AVANCE_PCT / 100; AC += Number(a.COSTO_REAL) || 0;
  });
  const avance = pesoT ? real / pesoT : (hojas.length ? hojas.reduce(function (s, id) { return s + r[id].AVANCE_PCT; }, 0) / hojas.length : 0);
  const avancePlan = pesoT ? plan / pesoT : (hojas.length ? hojas.reduce(function (s, id) { return s + r[id].AVANCE_PLAN_PCT; }, 0) / hojas.length : 0);
  return {
    actividades: r, orden: orden, errores: errores,
    proyecto: {
      FECHA_INICIO_PLAN: hojas.length ? crTexto_(Math.min.apply(null, hojas.map(function (id) { return es[id]; }))) : crTexto_(inicioProyecto),
      FECHA_FIN_PLAN: crTexto_(finProyecto),
      DURACION_DIAS: hojas.length ? cal.contar(Math.min.apply(null, hojas.map(function (id) { return es[id]; })), finProyecto) : 0,
      AVANCE_PCT: Math.round(avance * 10) / 10,
      AVANCE_PLAN_PCT: Math.round(avancePlan * 10) / 10,
      SPI: BAC > 0 ? (PV > 0 ? EV / PV : null) : (avancePlan > 0 ? avance / avancePlan : null),
      CPI: AC > 0 ? EV / AC : null,
      BAC: BAC, PV: PV, EV: EV, AC: AC
    }
  };
}

export { programarProyecto, crPredecesoras_, crCalendario_, crDia_, crTexto_ };
