// Acciones de usuario compartidas por varias vistas (inventario, hoja de vida, catálogos).
import { toast } from '../../ui.js';
import { can } from '../../permissions.js';
import * as assets from '../services/assets.js';
import * as hierarchy from '../services/hierarchy.js';
import * as documents from '../services/documents.js';
import * as catalogs from '../services/catalogs.js';
import { ASSET_FORM, NODE_FORM, DOCUMENT_FORM, CATALOG_FORM } from '../domain/schema.js';
import { LEVEL_LABEL } from '../domain/hierarchy.js';
import { openForm } from './form.js';
import { confirmDialog } from './components.js';

// Qué puede hacer el usuario en Mantenimiento (solo para mostrar botones; el servidor vuelve a verificar)
export const perms = user => ({
  crear: can(user, 'mantenimiento.crear'), editar: can(user, 'mantenimiento.editar'),
  inactivar: can(user, 'mantenimiento.inactivar'), anular: can(user, 'mantenimiento.anular'),
  jerarquia: can(user, 'mantenimiento.jerarquia.gestionar'), catalogos: can(user, 'mantenimiento.catalogos.gestionar'),
  cerrarOT: can(user, 'mantenimiento.ot.cerrar'), verCostos: can(user, 'mantenimiento.costos.ver'),
  configCostos: can(user, 'mantenimiento.costos.configurar')
});
export const canEditAssets = user => can(user, 'mantenimiento.crear') || can(user, 'mantenimiento.editar');
export const canEditCatalogs = user => can(user, 'mantenimiento.catalogos.gestionar');

// La auditoría de mantenimiento la registra el SERVIDOR (15_AUDITORIA) con el usuario de la sesión.

export function openAssetForm(user, { asset = null, preset = {} } = {}) {
  const editing = !!asset;
  openForm({
    title: editing ? `Editar ${asset.CODIGO_ACTIVO} · ${asset.NOMBRE_ACTIVO}` : 'Nuevo activo',
    form: ASSET_FORM,
    editing,
    values: editing ? asset : { ESTADO_ACTIVO: 'OPERATIVO', ...preset },
    submitLabel: editing ? 'Guardar cambios' : 'Crear activo',
    refreshOn: ['NIVEL_JERARQUIA'],
    optionsFor: { ID_PADRE: v => v.NIVEL_JERARQUIA ? assets.parentOptions(v.NIVEL_JERARQUIA, asset?.ID_ACTIVO) : [] },
    suggestions: { AREA: assets.areas() },
    hidden: name => name === 'COSTO_ADQUISICION' && !can(user, 'mantenimiento.costos.ver'),
    onSubmit: async datos => {
      const r = editing ? await assets.update(asset.ID_ACTIVO, datos, user) : await assets.create(datos, user);
      toast(editing ? `Activo ${r.CODIGO_ACTIVO} actualizado` : `Activo creado: ${r.CODIGO_ACTIVO}`);
      if (!editing) location.hash = `#/mantenimiento/hoja-vida/${r.ID_ACTIVO}`;
    }
  });
}

export function openNodeForm(user, { node = null, preset = {} } = {}) {
  const editing = !!node;
  openForm({
    title: editing ? `Editar ${LEVEL_LABEL[node.NIVEL].toLowerCase()} · ${node.NOMBRE_NODO}` : 'Nueva ubicación en la jerarquía',
    form: NODE_FORM,
    editing,
    values: editing ? node : preset,
    submitLabel: editing ? 'Guardar cambios' : 'Crear',
    refreshOn: ['NIVEL'],
    optionsFor: { ID_PADRE: v => v.NIVEL ? hierarchy.parentOptions(v.NIVEL) : [] },
    hidden: (name, v) => (name === 'PREFIJO_CODIGO' && v.NIVEL !== 'PROCESO') || (name === 'ID_PADRE' && v.NIVEL === 'PLANTA'),
    onSubmit: async datos => {
      if (datos.NIVEL && datos.NIVEL !== 'PLANTA' && !datos.ID_PADRE) throw new Error('Seleccione a qué pertenece');
      const r = editing ? await hierarchy.update(node.ID_NODO, datos, user) : await hierarchy.create(datos, user);
      toast(`${LEVEL_LABEL[r.NIVEL]} ${editing ? 'actualizado' : 'creado'}: ${r.NOMBRE_NODO}`);
    }
  });
}

export function openDocumentForm(user, asset) {
  openForm({
    title: `Documento para ${asset.CODIGO_ACTIVO}`,
    form: DOCUMENT_FORM,
    submitLabel: 'Agregar documento',
    onSubmit: async datos => {
      const r = await documents.create({ ...datos, ID_ACTIVO: asset.ID_ACTIVO }, user);
      toast('Documento agregado');
    }
  });
}

export function openCatalogForm(user, { entry = null, catalogo = '' } = {}) {
  const editing = !!entry;
  openForm({
    title: editing ? `Editar ${entry.CATALOGO} · ${entry.CODIGO}` : (catalogo ? `Nuevo valor en ${catalogo}` : 'Nuevo catálogo'),
    form: CATALOG_FORM,
    editing,
    values: editing ? entry : { CATALOGO: catalogo, ORDEN: catalogo ? catalogs.entries(catalogo, { includeInactive: true }).length + 1 : 1 },
    onSubmit: async datos => {
      const r = editing ? await catalogs.update(entry.ID_CATALOGO, datos, user) : await catalogs.create(datos, user);
      toast('Catálogo actualizado');
      if (!editing) location.hash = `#/mantenimiento/catalogos/${encodeURIComponent(r.CATALOGO)}`;
    }
  });
}

const STATE_VERB = { ACTIVO: 'reactivar', INACTIVO: 'inactivar', ANULADO: 'anular' };

// service: módulo de servicio con setRecordState · name: texto para el mensaje
export async function changeState(user, service, id, estado, name) {
  const anular = estado === 'ANULADO';
  if (!can(user, anular ? 'mantenimiento.anular' : 'mantenimiento.inactivar')) { toast('No tiene permiso para esta operación'); return false; }
  const msg = anular
    ? `¿Anular ${name}? El registro se conserva para la trazabilidad, pero ya no podrá usarse ni reactivarse.`
    : `¿Desea ${STATE_VERB[estado]} ${name}?`;
  const answer = await confirmDialog(msg, { okLabel: STATE_VERB[estado][0].toUpperCase() + STATE_VERB[estado].slice(1), danger: estado !== 'ACTIVO', requireReason: anular });
  if (!answer) return false;
  try {
    await service.setRecordState(id, estado, user, anular ? answer : '');
    toast(`${name}: ${estado}`);
    return true;
  } catch (e) {
    toast(e.message);
    return false;
  }
}
