// Formularios del módulo de Proyectos (mismo formato que js/maintenance/domain/schema.js).
const opts = list => list.map(([value, label]) => ({ value, label }));
export const L = {
  TIPO: opts([['MEJORA_INTERNA', 'Mejora continua (interno)'], ['EXTERNO', 'Externo · otra línea de negocio']]),
  FASE: opts([['INICIO', 'Inicio'], ['PLANIFICACION', 'Planificación'], ['EJECUCION', 'Ejecución'], ['MONITOREO_CONTROL', 'Monitoreo y control'], ['CIERRE', 'Cierre']]),
  ESTADO: opts([['PROPUESTO', 'Propuesto'], ['APROBADO', 'Aprobado'], ['EN_EJECUCION', 'En ejecución'], ['SUSPENDIDO', 'Suspendido'], ['CERRADO', 'Cerrado'], ['CANCELADO', 'Cancelado']]),
  PRIORIDAD: opts([['ALTA', 'Alta'], ['MEDIA', 'Media'], ['BAJA', 'Baja']]),
  DIAS: opts([['L-V', 'Lunes a viernes'], ['L-S', 'Lunes a sábado']]),
  TIPO_ACT: opts([['TAREA', 'Tarea'], ['HITO', 'Hito (duración 0)']]),
  ENTREGABLE: opts([['PENDIENTE', 'Pendiente'], ['ENTREGADO', 'Entregado'], ['APROBADO', 'Aprobado'], ['RECHAZADO', 'Rechazado']]),
  COMPROMISO: opts([['ABIERTO', 'Abierto'], ['CUMPLIDO', 'Cumplido'], ['CANCELADO', 'Cancelado']]),
  SEGUIMIENTO: opts([['REUNION', 'Reunión de seguimiento'], ['INFORME_AVANCE', 'Informe de avance'], ['VISITA', 'Visita / inspección'], ['HITO', 'Revisión de hito'], ['OTRO', 'Otro']]),
  SALUD: opts([['VERDE', '🟢 En control'], ['AMARILLO', '🟡 En riesgo'], ['ROJO', '🔴 Crítico']]),
  CATEGORIA: opts([['TECNICO', 'Técnico'], ['ALCANCE', 'Alcance'], ['CRONOGRAMA', 'Cronograma'], ['COSTO', 'Costo'], ['CALIDAD', 'Calidad'], ['PROVEEDORES', 'Proveedores'], ['LEGAL', 'Legal / permisos'], ['SEGURIDAD', 'Seguridad'], ['OTRO', 'Otro']]),
  ESTRATEGIA: opts([['EVITAR', 'Evitar'], ['MITIGAR', 'Mitigar'], ['TRANSFERIR', 'Transferir'], ['ACEPTAR', 'Aceptar'], ['EXPLOTAR', 'Explotar (oportunidad)'], ['MEJORAR', 'Mejorar (oportunidad)'], ['COMPARTIR', 'Compartir (oportunidad)']]),
  ESTADO_RIESGO: opts([['ABIERTO', 'Abierto'], ['EN_TRATAMIENTO', 'En tratamiento'], ['CERRADO', 'Cerrado'], ['MATERIALIZADO', 'Materializado']]),
  NIVEL3: opts([['ALTO', 'Alto'], ['MEDIO', 'Medio'], ['BAJO', 'Bajo']]),
  CAMBIO: opts([['SOLICITADO', 'Solicitado'], ['APROBADO', 'Aprobado'], ['RECHAZADO', 'Rechazado'], ['IMPLEMENTADO', 'Implementado']]),
  P1A5: [1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n} – ${['Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta'][n - 1]}` }))
};
export const label = (lista, v) => (L[lista].find(o => o.value === String(v)) || {}).label || v || '';

export const PROJECT_FORM = [
  { title: 'Identificación', fields: [
    { name: 'NOMBRE', label: 'Nombre del proyecto', required: true, max: 150, full: true },
    { name: 'TIPO', label: 'Tipo de proyecto', type: 'select', options: L.TIPO, required: true },
    { name: 'PRIORIDAD', label: 'Prioridad', type: 'select', options: L.PRIORIDAD, required: true },
    { name: 'AREA_PROCESO', label: 'Área / proceso de la organización', max: 120 },
    { name: 'LINEA_NEGOCIO', label: 'Línea de negocio', type: 'ref' },
    { name: 'CLIENTE', label: 'Cliente / unidad beneficiaria', max: 120 },
    { name: 'FASE', label: 'Fase (ciclo de vida)', type: 'select', options: L.FASE, required: true },
    { name: 'ESTADO', label: 'Estado', type: 'select', options: L.ESTADO, required: true }
  ] },
  { title: 'Acta de constitución', fields: [
    { name: 'OBJETIVO', label: 'Objetivo', type: 'textarea', required: true, max: 2000, full: true },
    { name: 'JUSTIFICACION', label: 'Justificación / caso de negocio', type: 'textarea', max: 2000, full: true },
    { name: 'ALCANCE', label: 'Alcance (qué incluye)', type: 'textarea', max: 3000, full: true },
    { name: 'FUERA_ALCANCE', label: 'Fuera de alcance', type: 'textarea', max: 2000, full: true },
    { name: 'SUPUESTOS', label: 'Supuestos', type: 'textarea', max: 2000 },
    { name: 'RESTRICCIONES', label: 'Restricciones', type: 'textarea', max: 2000 },
    { name: 'CRITERIOS_EXITO', label: 'Criterios de éxito / aceptación', type: 'textarea', max: 2000, full: true }
  ] },
  { title: 'Responsables y calendario', fields: [
    { name: 'DIRECTOR', label: 'Director del proyecto', required: true, max: 80 },
    { name: 'PATROCINADOR', label: 'Patrocinador', max: 80 },
    { name: 'FECHA_INICIO', label: 'Fecha de inicio', type: 'date', required: true },
    { name: 'FECHA_FIN_OBJETIVO', label: 'Fecha fin objetivo (compromiso)', type: 'date' },
    { name: 'DIAS_LABORABLES', label: 'Días laborables', type: 'select', options: L.DIAS, required: true }
  ] },
  { title: 'Indicador, presupuesto y beneficio', fields: [
    { name: 'KPI', label: 'KPI impactado', max: 120 }, { name: 'UNIDAD_KPI', label: 'Unidad', max: 30 },
    { name: 'LINEA_BASE_KPI', label: 'Línea base', type: 'number' }, { name: 'META_KPI', label: 'Meta', type: 'number' },
    { name: 'PRESUPUESTO', label: 'Presupuesto (COP)', type: 'number', min: 0 }, { name: 'BENEFICIO_ESPERADO', label: 'Beneficio esperado (COP)', type: 'number', min: 0 }
  ] }
];

export const ACTIVITY_FORM = [
  { title: 'Actividad', fields: [
    { name: 'NOMBRE', label: 'Nombre', required: true, max: 200, full: true },
    { name: 'TIPO', label: 'Tipo', type: 'select', options: L.TIPO_ACT, required: true },
    { name: 'ID_PADRE', label: 'Dentro de (actividad resumen)', type: 'ref' },
    { name: 'DURACION_DIAS', label: 'Duración (días hábiles)', type: 'int', min: 0 }
  ] },
  { title: 'Dependencias y restricciones', note: 'Use los números EDT, como en MS Project: "2.1; 2.3SS+2; 3.1FF-1". FS = fin-inicio (por defecto), SS = inicio-inicio, FF = fin-fin; ±n = adelanto o retraso en días hábiles.', fields: [
    { name: 'PREDECESORAS_EDT', label: 'Predecesoras (EDT)', max: 300, full: true },
    { name: 'INICIO_RESTRICCION', label: 'No comenzar antes de', type: 'date' }
  ] },
  { title: 'Responsable y entregable', fields: [
    { name: 'RESPONSABLE', label: 'Responsable', max: 80 },
    { name: 'ENTREGABLE', label: 'Entregable', max: 200 },
    { name: 'ESTADO_ENTREGABLE', label: 'Estado del entregable', type: 'select', options: L.ENTREGABLE },
    { name: 'FECHA_ENTREGA_REAL', label: 'Fecha real de entrega', type: 'date' },
    { name: 'URL_EVIDENCIA', label: 'Evidencia (enlace)', type: 'url', full: true }
  ] },
  { title: 'Avance real', fields: [
    { name: 'AVANCE_PCT', label: '% de avance', type: 'number', min: 0, max: 100 },
    { name: 'FECHA_INICIO_REAL', label: 'Inicio real', type: 'date' },
    { name: 'FECHA_FIN_REAL', label: 'Fin real', type: 'date' }
  ] },
  { title: 'Costos (valor ganado)', fields: [
    { name: 'COSTO_PLANIFICADO', label: 'Costo planificado (COP)', type: 'number', min: 0 },
    { name: 'COSTO_REAL', label: 'Costo real (COP)', type: 'number', min: 0 },
    { name: 'NOTAS', label: 'Notas', type: 'textarea', max: 2000, full: true }
  ] }
];

export const COMMITMENT_FORM = [{ title: 'Compromiso', fields: [
  { name: 'DESCRIPCION', label: 'Compromiso', type: 'textarea', required: true, max: 1000, full: true },
  { name: 'RESPONSABLE', label: 'Responsable', required: true, max: 80 },
  { name: 'FECHA_COMPROMISO', label: 'Fecha compromiso', type: 'date', required: true },
  { name: 'ID_ACTIVIDAD', label: 'Actividad relacionada', type: 'ref' },
  { name: 'ID_SEGUIMIENTO', label: 'Reunión de origen', type: 'ref' },
  { name: 'ESTADO', label: 'Estado', type: 'select', options: L.COMPROMISO, required: true },
  { name: 'OBSERVACION', label: 'Observación', type: 'textarea', max: 1000, full: true }
] }];

export const TRACKING_FORM = [{ title: 'Registro de seguimiento', fields: [
  { name: 'FECHA', label: 'Fecha', type: 'date', required: true },
  { name: 'TIPO', label: 'Tipo', type: 'select', options: L.SEGUIMIENTO, required: true },
  { name: 'TITULO', label: 'Título', required: true, max: 150, full: true },
  { name: 'SALUD', label: 'Estado de salud del proyecto', type: 'select', options: L.SALUD, required: true },
  { name: 'ASISTENTES', label: 'Asistentes', type: 'textarea', max: 1000, full: true },
  { name: 'RESUMEN', label: 'Resumen / avance', type: 'textarea', required: true, max: 4000, full: true },
  { name: 'DECISIONES', label: 'Decisiones', type: 'textarea', max: 3000, full: true }
] }];

export const RISK_FORM = [{ title: 'Riesgo', fields: [
  { name: 'DESCRIPCION', label: 'Riesgo (causa → evento → efecto)', type: 'textarea', required: true, max: 1000, full: true },
  { name: 'CATEGORIA', label: 'Categoría', type: 'select', options: L.CATEGORIA, required: true },
  { name: 'ESTADO', label: 'Estado', type: 'select', options: L.ESTADO_RIESGO, required: true },
  { name: 'PROBABILIDAD', label: 'Probabilidad', type: 'select', options: L.P1A5, required: true },
  { name: 'IMPACTO', label: 'Impacto', type: 'select', options: L.P1A5, required: true },
  { name: 'ESTRATEGIA', label: 'Estrategia de respuesta', type: 'select', options: L.ESTRATEGIA, required: true },
  { name: 'RESPONSABLE', label: 'Responsable', max: 80 },
  { name: 'RESPUESTA', label: 'Plan de respuesta', type: 'textarea', max: 1000, full: true }
] }];

export const STAKEHOLDER_FORM = [{ title: 'Interesado', fields: [
  { name: 'NOMBRE', label: 'Nombre', required: true, max: 100 }, { name: 'ROL', label: 'Rol en el proyecto', max: 100 },
  { name: 'ORGANIZACION', label: 'Organización / área', max: 100 }, { name: 'CONTACTO', label: 'Contacto', max: 120 },
  { name: 'PODER', label: 'Poder / influencia', type: 'select', options: L.NIVEL3, required: true },
  { name: 'INTERES', label: 'Interés', type: 'select', options: L.NIVEL3, required: true }
] }];

export const CHANGE_FORM = [{ title: 'Solicitud de cambio', fields: [
  { name: 'FECHA_SOLICITUD', label: 'Fecha de solicitud', type: 'date', required: true },
  { name: 'SOLICITANTE', label: 'Solicitante', required: true, max: 80 },
  { name: 'DESCRIPCION', label: 'Cambio solicitado', type: 'textarea', required: true, max: 2000, full: true },
  { name: 'JUSTIFICACION', label: 'Justificación', type: 'textarea', max: 2000, full: true },
  { name: 'IMPACTO_ALCANCE', label: 'Impacto en alcance', type: 'textarea', max: 1000, full: true },
  { name: 'IMPACTO_DIAS', label: 'Impacto en cronograma (días)', type: 'int' },
  { name: 'IMPACTO_COSTO', label: 'Impacto en costo (COP)', type: 'number' },
  { name: 'ESTADO', label: 'Estado', type: 'select', options: L.CAMBIO, required: true }
] }];

export const LESSON_FORM = [{ title: 'Lección aprendida', fields: [
  { name: 'FECHA', label: 'Fecha', type: 'date', required: true },
  { name: 'CATEGORIA', label: 'Categoría', type: 'select', options: L.CATEGORIA, required: true },
  { name: 'SITUACION', label: 'Situación', type: 'textarea', max: 2000, full: true },
  { name: 'LECCION', label: 'Lección aprendida', type: 'textarea', required: true, max: 2000, full: true },
  { name: 'RECOMENDACION', label: 'Recomendación', type: 'textarea', max: 2000, full: true }
] }];

export const CATALOG_FORM = [{ title: 'Valor', fields: [
  { name: 'CATALOGO', label: 'Catálogo', type: 'select', options: opts([['FESTIVO', 'Festivo (día no laborable)'], ['LINEA_NEGOCIO', 'Línea de negocio']]), required: true, immutable: true },
  { name: 'CODIGO', label: 'Código (festivo: AAAA-MM-DD)', required: true, max: 40, immutable: true },
  { name: 'VALOR', label: 'Nombre', required: true, max: 120 }
] }];
