// Definición de campos de cada formulario de mantenimiento.
// Una sola definición alimenta: el formulario (ui/form.js), la validación en el navegador (validate)
// y la interfaz. El servidor (Apps Script) vuelve a validar todo con sus propias reglas.
//
// type: text | textarea | number | int | date | datetime | url | select | cat | parent | ref
//   ref: opciones dinámicas (activos, personas, OT…) entregadas por el formulario (optionsFor)
//   cat: código de catálogo en 12_CATALOGOS · immutable: no editable después de crear

import { ASSET_LEVELS, NODE_LEVELS, LEVEL_LABEL } from './hierarchy.js';

const levelOptions = list => list.map(l => ({ value: l, label: LEVEL_LABEL[l] }));

export const ASSET_FORM = [
  {
    title: 'Identificación y ubicación', fields: [
      { name: 'NIVEL_JERARQUIA', label: 'Nivel', type: 'select', options: levelOptions(ASSET_LEVELS), required: true, immutable: true },
      { name: 'ID_PADRE', label: 'Pertenece a', type: 'parent', required: true, help: 'Proceso, línea, sistema o equipo del que forma parte.' },
      { name: 'NOMBRE_ACTIVO', label: 'Nombre del activo', required: true, max: 120 },
      { name: 'CODIGO_ACTIVO', label: 'Código', max: 30, immutable: true, help: 'Vacío = se genera automáticamente (ej. EQ-PRO-001). Si el equipo ya tiene placa/TAG, escríbalo.' },
      { name: 'TIPO_ACTIVO', label: 'Tipo de activo', type: 'cat', cat: 'TIPO_ACTIVO', required: true },
      { name: 'ESTADO_ACTIVO', label: 'Estado del activo', type: 'cat', cat: 'ESTADO_ACTIVO', required: true },
      { name: 'AREA', label: 'Área', required: true, max: 80, suggest: 'AREA' },
      { name: 'UBICACION', label: 'Ubicación física', required: true, max: 120, help: 'Ej. Nave 2, eje C-4' },
      { name: 'CRITICIDAD', label: 'Criticidad', type: 'cat', cat: 'CRITICIDAD' },
      { name: 'RESPONSABLE', label: 'Responsable', max: 80 }
    ]
  },
  {
    title: 'Datos técnicos', note: 'Opcionales: complete solo los que apliquen al equipo.', fields: [
      { name: 'FABRICANTE', label: 'Fabricante', max: 80 },
      { name: 'MARCA', label: 'Marca', max: 80 },
      { name: 'MODELO', label: 'Modelo', max: 80 },
      { name: 'SERIAL', label: 'Serial', max: 80 },
      { name: 'AÑO_FABRICACION', label: 'Año de fabricación', type: 'int', min: 1900, max: 2100 },
      { name: 'FECHA_INSTALACION', label: 'Fecha de instalación', type: 'date' },
      { name: 'CAPACIDAD_NOMINAL', label: 'Capacidad nominal', type: 'number', min: 0 },
      { name: 'UNIDAD_CAPACIDAD', label: 'Unidad de capacidad', type: 'cat', cat: 'UNIDAD_CAPACIDAD' },
      { name: 'POTENCIA_KW', label: 'Potencia (kW)', type: 'number', min: 0 },
      { name: 'VOLTAJE_V', label: 'Voltaje (V)', type: 'number', min: 0 },
      { name: 'FASES', label: 'Fases', type: 'cat', cat: 'FASES' },
      { name: 'PRESION_TRABAJO_BAR', label: 'Presión de trabajo (bar)', type: 'number', min: 0 },
      { name: 'VELOCIDAD_RPM', label: 'Velocidad (rpm)', type: 'number', min: 0 },
      { name: 'OTRA_ESPECIFICACION', label: 'Otras especificaciones', type: 'textarea', max: 1000, full: true }
    ]
  },
  {
    title: 'Datos administrativos', fields: [
      { name: 'FECHA_ADQUISICION', label: 'Fecha de adquisición', type: 'date' },
      { name: 'PROVEEDOR', label: 'Proveedor', max: 120 },
      { name: 'COSTO_ADQUISICION', label: 'Costo de adquisición', type: 'number', min: 0 },
      { name: 'GARANTIA', label: 'Garantía', max: 120, help: 'Ej. 12 meses, hasta 2027-05-30' },
      { name: 'VIDA_UTIL_ESTIMADA_ANIOS', label: 'Vida útil estimada (años)', type: 'number', min: 0, max: 200 }
    ]
  },
  {
    title: 'Documentación', fields: [
      { name: 'URL_FOTO', label: 'URL de la foto', type: 'url' },
      { name: 'URL_MANUAL', label: 'URL del manual', type: 'url' },
      { name: 'URL_FICHA_TECNICA', label: 'URL de la ficha técnica', type: 'url' },
      { name: 'URL_PLANOS', label: 'URL de planos', type: 'url' },
      { name: 'OBSERVACIONES', label: 'Observaciones', type: 'textarea', max: 2000, full: true }
    ]
  }
];

export const NODE_FORM = [
  {
    title: 'Ubicación en la jerarquía', fields: [
      { name: 'NIVEL', label: 'Nivel', type: 'select', options: levelOptions(NODE_LEVELS), required: true, immutable: true },
      { name: 'ID_PADRE', label: 'Pertenece a', type: 'parent', help: 'La planta no tiene padre; el proceso cuelga de una planta y la línea de un proceso.' },
      { name: 'NOMBRE_NODO', label: 'Nombre', required: true, max: 100 },
      { name: 'PREFIJO_CODIGO', label: 'Prefijo para códigos (solo procesos)', max: 4, immutable: true, help: '2 a 4 letras. Se usa en los códigos de activos: EQ-PRO-001.' },
      { name: 'RESPONSABLE', label: 'Responsable', max: 80 },
      { name: 'DESCRIPCION', label: 'Descripción', type: 'textarea', max: 500, full: true }
    ]
  }
];

export const DOCUMENT_FORM = [
  {
    title: 'Documento', fields: [
      { name: 'TIPO_DOCUMENTO', label: 'Tipo', type: 'cat', cat: 'TIPO_DOCUMENTO', required: true },
      { name: 'TITULO', label: 'Título', required: true, max: 150 },
      { name: 'URL', label: 'Enlace (Drive, SharePoint…)', type: 'url', required: true, full: true },
      { name: 'FECHA_DOCUMENTO', label: 'Fecha del documento', type: 'date' },
      { name: 'OBSERVACIONES', label: 'Observaciones', type: 'textarea', max: 1000, full: true }
    ]
  }
];

export const CATALOG_FORM = [
  {
    title: 'Valor de catálogo', fields: [
      { name: 'CATALOGO', label: 'Catálogo', required: true, max: 40, immutable: true },
      { name: 'CODIGO', label: 'Código', required: true, max: 40, immutable: true, help: 'Se guarda en los registros. No se puede cambiar después.' },
      { name: 'VALOR', label: 'Texto visible', required: true, max: 120 },
      { name: 'ORDEN', label: 'Orden', type: 'int', min: 0, max: 9999 },
      { name: 'DESCRIPCION', label: 'Descripción', type: 'textarea', max: 500, full: true }
    ]
  }
];


const SI_NO = [{ value: 'SI', label: 'Sí' }, { value: 'NO', label: 'No' }];

export const EVENT_FORM = [
  {
    title: 'Qué ocurrió y dónde', fields: [
      { name: 'ID_ACTIVO', label: 'Activo', type: 'ref', required: true, immutable: true, full: true },
      { name: 'ID_COMPONENTE', label: 'Componente afectado (opcional)', type: 'ref', full: true },
      { name: 'TIPO_EVENTO', label: 'Tipo de evento', type: 'cat', cat: 'TIPO_EVENTO', required: true },
      { name: 'CON_PARADA', label: '¿Detuvo el equipo?', type: 'select', options: SI_NO, required: true },
      { name: 'FECHA_EVENTO', label: 'Fecha y hora', type: 'datetime', required: true },
      { name: 'REPORTADO_POR', label: 'Reportado por', required: true, max: 80 },
      { name: 'DESCRIPCION', label: 'Descripción', type: 'textarea', required: true, max: 2000, full: true },
      { name: 'SINTOMA', label: 'Síntoma observado', type: 'textarea', max: 1000, full: true },
      { name: 'ID_MODO_FALLA', label: 'Modo de falla', type: 'ref', full: true, help: 'Se verifica automáticamente si está contemplado en el FMEA.' },
      { name: 'ESTADO', label: 'Estado', type: 'select', options: [{ value: 'ABIERTO', label: 'Abierto' }, { value: 'EN_ATENCION', label: 'En atención' }, { value: 'CERRADO', label: 'Cerrado' }] }
    ]
  }
];

export const OT_FORM = [
  {
    title: 'Orden de trabajo', fields: [
      { name: 'ID_ACTIVO', label: 'Activo', type: 'ref', required: true, immutable: true, full: true },
      { name: 'ID_EVENTO', label: 'Evento de origen', type: 'ref', immutable: true },
      { name: 'ID_PLAN', label: 'Plan preventivo', type: 'ref', immutable: true },
      { name: 'TIPO_MTTO', label: 'Tipo de mantenimiento', type: 'cat', cat: 'TIPO_MTTO', required: true },
      { name: 'PRIORIDAD', label: 'Prioridad', type: 'cat', cat: 'PRIORIDAD', required: true },
      { name: 'FECHA_SOLICITUD', label: 'Fecha de solicitud', type: 'date', required: true },
      { name: 'FECHA_PROGRAMADA', label: 'Fecha programada', type: 'date' },
      { name: 'RESPONSABLE', label: 'Responsable', required: true, max: 80 },
      { name: 'ESTADO', label: 'Estado', type: 'select', options: [{ value: 'ABIERTA', label: 'Abierta' }, { value: 'PROGRAMADA', label: 'Programada' }, { value: 'EN_EJECUCION', label: 'En ejecución' }, { value: 'EN_ESPERA', label: 'En espera' }, { value: 'CERRADA', label: 'Cerrada' }] },
      { name: 'DESCRIPCION', label: 'Descripción del trabajo solicitado', type: 'textarea', required: true, max: 2000, full: true }
    ]
  },
  {
    title: 'Ejecución', fields: [
      { name: 'FECHA_INICIO', label: 'Inicio', type: 'datetime' },
      { name: 'FECHA_FIN', label: 'Fin', type: 'datetime' },
      { name: 'DIAGNOSTICO', label: 'Diagnóstico', type: 'textarea', max: 2000, full: true },
      { name: 'TRABAJO_REALIZADO', label: 'Trabajo realizado', type: 'textarea', max: 3000, full: true },
      { name: 'COSTO_SERVICIOS', label: 'Costo de servicios externos (COP)', type: 'number', min: 0, help: 'Contratistas, tornería, rebobinado… La mano de obra y los repuestos se suman solos.' }
    ]
  },
  {
    title: 'Análisis de falla y causa raíz', note: 'Obligatorio para cerrar correctivos: causa inmediata.', fields: [
      { name: 'ID_COMPONENTE', label: 'Componente que falló', type: 'ref', full: true },
      { name: 'ID_MODO_FALLA', label: 'Modo de falla', type: 'ref' },
      { name: 'CLASIFICACION_CAUSA', label: 'Clasificación de la causa', type: 'cat', cat: 'CLASIFICACION_CAUSA' },
      { name: 'SINTOMA', label: 'Síntoma', type: 'textarea', max: 1000, full: true },
      { name: 'CAUSA_INMEDIATA', label: 'Causa inmediata', type: 'textarea', max: 1000, full: true },
      { name: 'CAUSA_RAIZ', label: 'Causa raíz', type: 'textarea', max: 1000, full: true },
      { name: 'ACCION_CORRECTIVA', label: 'Acción correctiva', type: 'textarea', max: 1000, full: true },
      { name: 'ACCION_PREVENTIVA', label: 'Acción preventiva', type: 'textarea', max: 1000, full: true },
      { name: 'LECCION_APRENDIDA', label: 'Lección aprendida', type: 'textarea', max: 1000, full: true }
    ]
  }
];

export const TIEMPOS_FORM = [
  {
    title: 'Hitos (registre solo los que conozca; deben ir en orden)', fields: [
      ['FECHA_HORA_FALLA', 'Falla / inicio de la parada', true], ['FECHA_HORA_DETECCION', 'Detección'], ['FECHA_HORA_REPORTE', 'Reporte'],
      ['FECHA_HORA_AVISO_MTTO', 'Aviso a mantenimiento'], ['FECHA_HORA_LLEGADA_MTTO', 'Llegada de mantenimiento'],
      ['FECHA_HORA_INICIO_DIAGNOSTICO', 'Inicio de diagnóstico'], ['FECHA_HORA_FIN_DIAGNOSTICO', 'Fin de diagnóstico'],
      ['FECHA_HORA_INICIO_REPARACION', 'Inicio de reparación'], ['FECHA_HORA_FIN_REPARACION', 'Fin de reparación'],
      ['FECHA_HORA_PRUEBA', 'Prueba'], ['FECHA_HORA_LIBERACION', 'Liberación'], ['FECHA_HORA_RETORNO_SERVICIO', 'Retorno a servicio']
    ].map(([name, label, required]) => ({ name, label, type: 'datetime', required: !!required }))
  },
  {
    title: 'Esperas dentro de la parada (minutos)', note: 'Solo cuando apliquen. Permiten ver dónde se pierde el tiempo.', fields: [
      { name: 'MIN_ESPERA_PRODUCCION', label: 'Espera de producción', type: 'number', min: 0 },
      { name: 'MIN_ESPERA_ADMINISTRATIVA', label: 'Espera administrativa / autorización', type: 'number', min: 0 },
      { name: 'MIN_ESPERA_REPUESTO', label: 'Espera de repuesto', type: 'number', min: 0 },
      { name: 'MIN_ESPERA_PERSONAL', label: 'Espera de personal', type: 'number', min: 0 },
      { name: 'MIN_ESPERA_HERRAMIENTA', label: 'Espera de herramienta', type: 'number', min: 0 },
      { name: 'MIN_OTRAS_DEMORAS', label: 'Otras demoras', type: 'number', min: 0 },
      { name: 'OBSERVACION_DEMORAS', label: 'Justificación de las esperas', type: 'textarea', max: 1000, full: true }
    ]
  }
];

export const FMEA_FORM = [
  {
    title: 'Elemento analizado', fields: [
      { name: 'ID_ACTIVO', label: 'Activo', type: 'ref', required: true, full: true },
      { name: 'ID_COMPONENTE', label: 'Componente (opcional)', type: 'ref', full: true },
      { name: 'FUNCION', label: 'Función', type: 'textarea', required: true, max: 500, full: true },
      { name: 'FALLA_FUNCIONAL', label: 'Falla funcional', type: 'textarea', required: true, max: 500, full: true }
    ]
  },
  {
    title: 'Modo, efecto y causa', fields: [
      { name: 'ID_MODO_FALLA', label: 'Modo de falla', type: 'ref', required: true, full: true },
      { name: 'EFECTO_FALLA', label: 'Efecto de la falla', type: 'textarea', required: true, max: 1000, full: true },
      { name: 'CAUSA_POTENCIAL', label: 'Causa potencial', type: 'textarea', required: true, max: 1000, full: true },
      { name: 'CONTROL_ACTUAL', label: 'Control actual', type: 'textarea', max: 1000, full: true }
    ]
  },
  {
    title: 'Evaluación (escalas 1 a 10) · NPR = S × O × D lo calcula el sistema', fields: [
      { name: 'SEVERIDAD', label: 'Severidad (S)', type: 'cat', cat: 'SEVERIDAD', required: true },
      { name: 'OCURRENCIA', label: 'Ocurrencia (O)', type: 'cat', cat: 'OCURRENCIA', required: true },
      { name: 'DETECCION', label: 'Detección (D)', type: 'cat', cat: 'DETECCION', required: true }
    ]
  },
  {
    title: 'Acción', fields: [
      { name: 'ACCION_RECOMENDADA', label: 'Acción recomendada', type: 'textarea', max: 1000, full: true },
      { name: 'RESPONSABLE', label: 'Responsable', max: 80 },
      { name: 'FECHA_OBJETIVO', label: 'Fecha objetivo', type: 'date' },
      { name: 'ESTADO', label: 'Estado de la acción', type: 'select', options: [{ value: 'ABIERTO', label: 'Abierta' }, { value: 'EN_PROCESO', label: 'En proceso' }, { value: 'CERRADO', label: 'Cerrada' }] },
      { name: 'ID_EVENTO_ORIGEN', label: 'Falla real de origen', type: 'ref', immutable: true }
    ]
  }
];

export const MODE_FORM = [
  {
    title: 'Modo de falla', fields: [
      { name: 'CODIGO', label: 'Código', required: true, max: 15, immutable: true, help: 'Categoría: 2–4 letras (MEC). Modo: CAT-SUB (MEC-ROD).' },
      { name: 'NOMBRE', label: 'Nombre', required: true, max: 100 },
      { name: 'DESCRIPCION', label: 'Descripción', type: 'textarea', max: 500, full: true }
    ]
  }
];

export const PLAN_FORM = [
  {
    title: 'Tarea periódica', fields: [
      { name: 'ID_ACTIVO', label: 'Activo', type: 'ref', required: true, immutable: true, full: true },
      { name: 'ACTIVIDAD', label: 'Actividad', type: 'textarea', required: true, max: 500, full: true },
      { name: 'TIPO', label: 'Tipo', type: 'cat', cat: 'TIPO_MTTO', required: true },
      { name: 'REQUIERE_PARADA', label: '¿Requiere parada?', type: 'select', options: SI_NO, required: true },
      { name: 'FRECUENCIA', label: 'Frecuencia', type: 'number', min: 0.01, required: true },
      { name: 'UNIDAD_FRECUENCIA', label: 'Unidad', type: 'cat', cat: 'UNIDAD_FRECUENCIA', required: true },
      { name: 'FECHA_INICIO', label: 'Fecha de inicio (calendario)', type: 'date' },
      { name: 'ULTIMA_EJECUCION', label: 'Última ejecución conocida', type: 'date' },
      { name: 'ULTIMO_VALOR_CONTADOR', label: 'Contador en la última ejecución (horas, ciclos, t)', type: 'number', min: 0 },
      { name: 'RESPONSABLE', label: 'Responsable', max: 80 },
      { name: 'DURACION_ESTIMADA_MIN', label: 'Duración estimada (min)', type: 'number', min: 0 }
    ]
  }
];

export const VARIABLE_FORM = [
  {
    title: 'Variable de condición del activo', fields: [
      { name: 'ID_ACTIVO', label: 'Activo', type: 'ref', required: true, immutable: true, full: true },
      { name: 'VARIABLE', label: 'Variable', type: 'cat', cat: 'VARIABLE_LECTURA', required: true, immutable: true },
      { name: 'UNIDAD', label: 'Unidad (vacío = la del catálogo)', max: 20 },
      { name: 'LIMITE_INFERIOR', label: 'Límite inferior', type: 'number' },
      { name: 'LIMITE_SUPERIOR', label: 'Límite superior', type: 'number' }
    ]
  }
];

export const READING_FORM = [
  {
    title: 'Lectura', fields: [
      { name: 'ID_ACTIVO', label: 'Activo', type: 'ref', required: true, immutable: true, full: true },
      { name: 'VARIABLE', label: 'Variable', type: 'ref', required: true, immutable: true },
      { name: 'FECHA_HORA', label: 'Fecha y hora', type: 'datetime', required: true },
      { name: 'VALOR', label: 'Valor', type: 'number', required: true },
      { name: 'OBSERVACION', label: 'Observación', type: 'textarea', max: 500, full: true }
    ]
  }
];

export const PERSON_FORM = [
  {
    title: 'Persona (técnico interno o contratista)', fields: [
      { name: 'NOMBRE', label: 'Nombre', required: true, max: 80 },
      { name: 'CARGO', label: 'Cargo', max: 80 },
      { name: 'TIPO_PERSONAL', label: 'Tipo', type: 'cat', cat: 'TIPO_PERSONAL', required: true },
      { name: 'EMAIL', label: 'Correo (opcional)', max: 120 }
    ]
  }
];

export const RATE_FORM = [
  {
    title: 'Tarifa de hora hombre', note: 'Las OT usan la tarifa vigente en la fecha del trabajo. Cambiar la tarifa no altera costos pasados.', fields: [
      { name: 'ID_PERSONA', label: 'Persona', type: 'ref', required: true, immutable: true },
      { name: 'VALOR_HORA', label: 'Valor hora (COP)', type: 'number', min: 1, required: true },
      { name: 'VIGENTE_DESDE', label: 'Vigente desde', type: 'date', required: true },
      { name: 'OBSERVACION', label: 'Observación', max: 200 }
    ]
  }
];

export const LABOR_FORM = [
  {
    title: 'Mano de obra', note: 'El costo se calcula con la tarifa vigente de la persona en esa fecha.', fields: [
      { name: 'ID_PERSONA', label: 'Persona', type: 'ref', required: true },
      { name: 'FECHA', label: 'Fecha', type: 'date', required: true },
      { name: 'HORAS', label: 'Horas hombre', type: 'number', min: 0.05, max: 24, required: true },
      { name: 'ACTIVIDAD', label: 'Actividad', max: 200 }
    ]
  }
];

export const PART_FORM = [
  {
    title: 'Repuesto o material consumido', fields: [
      { name: 'CODIGO_REPUESTO', label: 'Código (almacén)', max: 40 },
      { name: 'DESCRIPCION', label: 'Descripción', required: true, max: 200 },
      { name: 'CANTIDAD', label: 'Cantidad', type: 'number', min: 0.0001, required: true },
      { name: 'UNIDAD', label: 'Unidad', type: 'cat', cat: 'UNIDAD_REPUESTO', required: true },
      { name: 'COSTO_UNITARIO', label: 'Costo unitario (COP)', type: 'number', min: 0, required: true }
    ]
  }
];

export const PERIOD_FORM = [
  {
    title: 'Periodo sin producción requerida, parada de planta o standby', note: 'Se usa para separar disponibilidad operacional (Ao), técnica (At) y SMRP.', fields: [
      { name: 'ID_REFERENCIA', label: 'Línea, proceso o activo', type: 'ref', required: true, immutable: true, full: true },
      { name: 'CATEGORIA', label: 'Categoría', type: 'cat', cat: 'CATEGORIA_INACTIVIDAD', required: true, full: true },
      { name: 'INICIO', label: 'Inicio', type: 'datetime', required: true },
      { name: 'FIN', label: 'Fin', type: 'datetime', required: true },
      { name: 'OBSERVACION', label: 'Observación', type: 'textarea', max: 500, full: true }
    ]
  }
];

export const fieldsOf = form => form.flatMap(s => s.fields);

// Validación en el navegador. Devuelve {campo: mensaje}. `catalogHas(cat, code)` verifica catálogos.
export function validate(form, values, { catalogHas, editing = false } = {}) {
  const errors = {};
  for (const f of fieldsOf(form)) {
    if (editing && f.immutable) continue;
    const raw = values[f.name];
    const v = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!v) { if (f.required) errors[f.name] = 'Obligatorio'; continue; }
    if (f.max && v.length > f.max) errors[f.name] = `Máximo ${f.max} caracteres`;
    if (f.type === 'number' || f.type === 'int') {
      const n = Number(v.replace(',', '.'));
      if (!Number.isFinite(n)) errors[f.name] = 'Debe ser numérico';
      else if (f.type === 'int' && !Number.isInteger(n)) errors[f.name] = 'Debe ser entero';
      else if (f.min !== undefined && n < f.min) errors[f.name] = `Mínimo ${f.min}`;
      else if (f.max !== undefined && n > f.max) errors[f.name] = `Máximo ${f.max}`;
    }
    if (f.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v + 'T00:00:00')))) errors[f.name] = 'Fecha no válida';
    if (f.type === 'datetime' && !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) errors[f.name] = 'Fecha y hora no válidas';
    if (f.type === 'url' && !/^https?:\/\/[^\s<>"']+$/i.test(v)) errors[f.name] = 'Debe iniciar con https://';
    if (f.type === 'select' && f.options && !f.options.some(o => o.value === v)) errors[f.name] = 'Valor no permitido';
    if (f.type === 'cat' && catalogHas && !catalogHas(f.cat, v)) errors[f.name] = 'No está en el catálogo';
  }
  return errors;
}

// Convierte los valores del formulario a lo que se envía (números como número, vacíos como '')
export function clean(form, values, { editing = false } = {}) {
  const out = {};
  for (const f of fieldsOf(form)) {
    if (editing && f.immutable) continue;
    if (!(f.name in values)) continue;
    const v = String(values[f.name] ?? '').trim();
    out[f.name] = v && (f.type === 'number' || f.type === 'int') ? Number(v.replace(',', '.')) : (f.type === 'datetime' ? v.replace('T', ' ').slice(0, 16) : v);
  }
  return out;
}
