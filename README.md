# SODIACERO Campo

Un solo link para capturar información en planta desde el celular: **https://operacionessodiacero.github.io/sistema-gestion/**

- **Tarjetas TPM** roja (mantenimiento planificado) y azul (mantenimiento autónomo), con foto y ficha.
- **Inventario de equipos**: registro de activos con código automático (SDA-TAL-0001…), estado, criticidad y foto.

Los datos se guardan en Google Sheets y Drive a través del Apps Script de la app TPM (la URL y la clave se configuran en **Ajustes**). El **servidor de la empresa** (SODIACERO Gestión 4.0.2 o posterior) consulta la nube cada pocos minutos y guarda una copia en su carpeta de datos; en la app de escritorio se consultan en el menú **Captura móvil**. La nube es solo de captura: lo que se borre de la hoja se conserva en el servidor.

## Estructura

| Ruta | Qué es |
|---|---|
| `/` (`index.html`, `app.js`, `api.js`, `config.js`, `styles.css`) | App de captura en campo (antes en `tpm-sodiacero`) |
| `/sig/` | Sistema Integral de Gestión en línea (versión anterior, con su propio Apps Script). Sus funciones están en la app de escritorio 4.0 |

El link anterior `https://operacionessodiacero.github.io/tpm-sodiacero/` redirige aquí y conserva los links de instalación (`#k=CLAVE`). Como las dos direcciones son del mismo sitio, los celulares conservan la clave y el nombre ya guardados.

## Seguridad
- Este repositorio es **público**: no contiene la clave de acceso. La clave se entrega con el link de instalación (`…/sistema-gestion/#k=CLAVE`) o se escribe en Ajustes.
- La URL del Apps Script es pública por naturaleza; sin la clave no da acceso a nada.
