// Configuración PÚBLICA del frontend. Todo lo que hay aquí es visible para cualquiera:
// NO agregar contraseñas, claves, tokens ni IDs de libros. La seguridad la aplica el servidor.
export const APP={name:'SODIACERO',subtitle:'Sistema Integral de Gestión',version:'1.1'};
export const UNITS=['kg','ton','unidad','metro','barra','paquete','rollo'];
export const SHIFTS=['Turno 1','Turno 2','Turno 3'];
// Roles de la interfaz para los módulos locales (solo deciden qué se muestra; Etapa 3 los reemplaza por permisos del servidor)
export const ROLES={SUPER_ADMIN:['*'],GERENCIA:['ACCESS','READ_ALL'],SUPERVISOR:['ACCESS','CREATE','READ_OWN','READ_ALL','UPDATE'],OPERADOR:['ACCESS','CREATE','READ_OWN'],CONSULTA:['ACCESS','READ_ALL']};

export const API={
  // Única API activa: Apps Script del libro de Mantenimiento (Mantenimiento.gs + Seguridad.gs).
  // La URL es pública por naturaleza; no da acceso a nada sin una sesión válida.
  maintenanceUrl:'https://script.google.com/macros/s/AKfycbxt136GZAVg-gBfYcZbyYke49bZ3WjHU3Bxm8Cvu7C3Mui3BoyrM7RcDY8A-F-Szrs/exec'
};

// Mantenimiento: claves lógicas de las tablas. El servidor traduce cada clave a su hoja.
// Para migrar a otra API/BD solo hay que cambiar js/backend.js y js/maintenance/services/api.js.
export const MAINTENANCE={
  sheets:{ACTIVOS:'01_ACTIVOS',JERARQUIA:'02_JERARQUIA_ACTIVOS',EVENTOS:'03_EVENTOS',OT:'04_ORDENES_TRABAJO',TIEMPOS:'05_TIEMPOS',FMEA:'06_FMEA',MODOS_FALLA:'07_MODOS_FALLA',PLAN:'08_PLAN_MTTO',REPUESTOS:'09_REPUESTOS_OT',LECTURAS:'10_LECTURAS_OPERACION',DOCUMENTOS:'11_DOCUMENTOS',CATALOGOS:'12_CATALOGOS',PERSONAL:'17_PERSONAL',TARIFAS:'18_TARIFAS_HH',MANO_OBRA:'19_MANO_OBRA_OT',VARIABLES:'20_VARIABLES_ACTIVO',PERIODOS:'21_PERIODOS_INACTIVIDAD'},
  idFields:{ACTIVOS:'ID_ACTIVO',JERARQUIA:'ID_NODO',EVENTOS:'ID_EVENTO',OT:'ID_OT',TIEMPOS:'ID_TIEMPO',FMEA:'ID_FMEA',MODOS_FALLA:'ID_MODO_FALLA',PLAN:'ID_PLAN',REPUESTOS:'ID_CONSUMO',LECTURAS:'ID_LECTURA',DOCUMENTOS:'ID_DOCUMENTO',CATALOGOS:'ID_CATALOGO',PERSONAL:'ID_PERSONA',TARIFAS:'ID_TARIFA',MANO_OBRA:'ID_MANO_OBRA',VARIABLES:'ID_VARIABLE_ACTIVO',PERIODOS:'ID_PERIODO'}
};
