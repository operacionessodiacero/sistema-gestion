# SODIACERO — Sistema Integral de Gestión

Aplicación web estática (HTML, CSS y JavaScript sin compilación) publicada en GitHub Pages.

## Seguridad
- Este repositorio es **público**: no contiene contraseñas, claves, tokens ni identificadores de libros.
- GitHub Pages solo sirve archivos. **Toda autenticación y autorización ocurre en el servidor** (Google Apps Script):
  inicio de sesión con código de un solo uso enviado al correo registrado, sesiones con vencimiento,
  validación de cada operación y auditoría.
- El código del servidor se mantiene fuera de este repositorio.

## Módulos
- **Mantenimiento**: inventario y jerarquía de activos, hoja de vida, eventos y cronología de intervención, órdenes de trabajo con horas hombre, repuestos y costos, FMEA y taxonomía de modos de falla, plan preventivo, lecturas operacionales, disponibilidad (Ao, At ISO 14224 y SMRP) e indicadores. Datos en Google Sheets a través de la API segura.
- **Proyectos** (PMBOK): portafolio de mejora continua interna y proyectos externos, acta de constitución, cronograma tipo Gantt con EDT, dependencias, ruta crítica y línea base, entregables, compromisos, seguimiento con semáforo, riesgos, interesados, control de cambios, lecciones aprendidas y valor ganado (SPI/CPI).
- **Administración**: usuarios, roles, permisos granulares y auditoría (autorizados en el servidor).
- **Dashboard gerencial**: resumen en línea de Mantenimiento y Proyectos.
- **Producción, Calidad, Almacén, Seguridad y Ambiente, Planes de acción**: reservados para etapas posteriores (no guardan datos).

## Estructura
```
index.html · css/ · js/ (app, auth, backend, maintenance/…) · assets/
```

## Probar localmente
Servir la carpeta con un servidor HTTP local (por ejemplo, Live Server de VS Code). No requiere compilación.
