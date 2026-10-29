// Configuración general de la app TPM Sodiacero.
window.APP_CONFIG = {
  // URL de la aplicación web de Google Apps Script (termina en /exec).
  // Si se deja vacía, la app funciona en "modo demostración" guardando solo en este navegador.
  // También se puede escribir desde la pestaña Ajustes de la app.
  API_URL: 'https://script.google.com/macros/s/AKfycbwm_BG8tj_86nqyYAX3Nd0MHaBiH6T2RxZw0uf1SXhfDzg1bGrS9gGX27XaB8N6wMpK/exec',

  EMPRESA: 'SODIACERO',

  // "codigo" se usa para generar el código de los activos: SDA-<codigo>-0001
  AREAS: [
    { nombre: 'Taller', codigo: 'TAL' },
    {
      nombre: 'Patio de alistamiento de materia prima', codigo: 'PAT',
      ubicaciones: ['Hangar 1', 'Hangar 2', 'Hangar 3', 'Hangar 4', 'Hangar 5']
    },
    { nombre: 'Despachos', codigo: 'DES' },
    { nombre: 'Almacén de materia prima para proceso (horno)', codigo: 'AMP' },
    { nombre: 'Almacenamiento y preparación de materiales', codigo: 'APM' },
    { nombre: 'Mallas', codigo: 'MAL' },
    { nombre: 'Tren de laminación 230', codigo: 'L230' },
    { nombre: 'Tren de laminación 380', codigo: 'L380' },
    { nombre: 'Entorchado', codigo: 'ENT' },
    { nombre: 'Almacén de repuestos y maquinaria', codigo: 'ALM' }
  ],

  CLASIFICACIONES: ['Limpieza', 'Mantenimiento autónomo', 'Requiere intervención de mantenimiento'],

  ANORMALIDADES: [
    'Fallos menores', 'Condiciones básicas', 'Lugar difícil acceso',
    'Fuentes de contaminación', 'Defecto de calidad', 'Organización y orden'
  ],

  // Tipos de equipo agrupados por familia (se muestran agrupados en la lista)
  TIPOS_EQUIPO: [
    {
      grupo: 'Laminación y proceso', tipos: [
        'Horno de recalentamiento', 'Caja / castillo de laminación', 'Caja de piñones',
        'Guías y cajas de guía', 'Mesa de rodillos / camino de rodillos', 'Lecho / mesa de enfriamiento',
        'Formadora de espiras / bobinadora', 'Enderezadora', 'Trefiladora', 'Dobladora / estribadora',
        'Soldadora de mallas (electrosoldado)', 'Entorchadora / torsionadora', 'Empaquetadora / flejadora'
      ]
    },
    {
      grupo: 'Corte y conformado', tipos: [
        'Cizalla en caliente', 'Cizalla en frío', 'Sierra / tronzadora', 'Prensa hidráulica',
        'Prensa mecánica', 'Punzonadora / troqueladora', 'Oxicorte / plasma'
      ]
    },
    {
      grupo: 'Izaje y movimiento de material', tipos: [
        'Puente grúa', 'Grúa pórtico / semipórtico', 'Polipasto / diferencial', 'Montacargas',
        'Cargador / equipo de patio', 'Volqueta / camión', 'Vehículo liviano', 'Electroimán de izaje',
        'Banda / transportador'
      ]
    },
    {
      grupo: 'Accionamiento y transmisión', tipos: [
        'Motor eléctrico AC', 'Motor eléctrico DC', 'Motorreductor', 'Reductor / caja de engranajes',
        'Acople / transmisión', 'Motor de combustión'
      ]
    },
    {
      grupo: 'Fluidos, aire y térmicos', tipos: [
        'Bomba de agua', 'Bomba hidráulica', 'Unidad hidráulica', 'Sistema de lubricación',
        'Compresor de aire', 'Secador de aire', 'Ventilador / soplador / extractor',
        'Torre de enfriamiento', 'Intercambiador de calor', 'Quemador / sistema de combustión',
        'Tanque / recipiente a presión'
      ]
    },
    {
      grupo: 'Eléctrico, control e instrumentación', tipos: [
        'Transformador / subestación', 'Tablero eléctrico / CCM', 'Variador de velocidad',
        'Planta eléctrica / generador', 'Banco de condensadores', 'PLC / sistema de control',
        'Sensor / instrumento de medición', 'Pirómetro', 'Báscula'
      ]
    },
    {
      grupo: 'Taller y herramientas', tipos: [
        'Torno', 'Fresadora', 'Taladro', 'Rectificadora / esmeril', 'Equipo de soldadura',
        'Herramienta eléctrica', 'Herramienta neumática', 'Equipo de medición / metrología'
      ]
    },
    {
      grupo: 'Seguridad e infraestructura', tipos: [
        'Sistema contra incendio', 'Extractor / colector de polvo', 'Iluminación', 'Otro'
      ]
    }
  ],

  CRITICIDADES: [
    { valor: 'A', nombre: 'Crítico', desc: 'Si falla, se detiene la producción o hay riesgo para personas o el ambiente. No tiene respaldo.' },
    { valor: 'B', nombre: 'Importante', desc: 'Si falla, baja la producción o la calidad, pero hay respaldo o se repara rápido.' },
    { valor: 'C', nombre: 'Bajo impacto', desc: 'Si falla, no afecta la producción. Puede esperar al mantenimiento programado.' }
  ],

  // Unidades del Sistema Internacional primero; HP y psi por ser comunes en placas de equipos
  UNIDADES: [
    { grupo: 'Potencia', unidades: ['kW', 'W', 'HP', 'kVA'] },
    { grupo: 'Energía', unidades: ['kWh'] },
    { grupo: 'Carga / masa', unidades: ['t', 'kg', 't/h'] },
    { grupo: 'Caudal', unidades: ['m³/h', 'L/min'] },
    { grupo: 'Presión', unidades: ['bar', 'psi'] },
    { grupo: 'Eléctricas', unidades: ['V', 'A'] },
    { grupo: 'Otras', unidades: ['rpm', 'mm', 'm', '°C'] }
  ],

  // nivel: qué tan urgente es intervenir (se combina con la criticidad para priorizar)
  ESTADOS_EQUIPO: [
    { nombre: 'Operativo', color: 'verde', nivel: 0 },
    { nombre: 'Operativo – requiere intervención', color: 'ambar', nivel: 2 },
    { nombre: 'En mantenimiento', color: 'azul', nivel: 1 },
    { nombre: 'Fuera de servicio', color: 'rojo', nivel: 3 },
    { nombre: 'Dado de baja', color: 'gris', nivel: -1 }
  ]
};
