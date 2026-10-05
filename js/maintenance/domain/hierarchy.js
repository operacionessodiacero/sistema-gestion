// Reglas y utilidades de la jerarquía PLANTA → PROCESO → LÍNEA → SISTEMA → EQUIPO → SUBEQUIPO → COMPONENTE.
// Funciones puras: reciben `data` ({JERARQUIA:[...], ACTIVOS:[...]}) y no tocan la interfaz ni la red.
// Las mismas reglas se validan en el servidor (AppsScript-Mantenimiento.gs → MTTO_PADRES_PERMITIDOS).

export const NODE_LEVELS = ['PLANTA', 'PROCESO', 'LINEA'];
export const ASSET_LEVELS = ['SISTEMA', 'EQUIPO', 'SUBEQUIPO', 'COMPONENTE'];
export const LEVEL_LABEL = {
  PLANTA: 'Planta', PROCESO: 'Proceso', LINEA: 'Línea',
  SISTEMA: 'Sistema', EQUIPO: 'Equipo', SUBEQUIPO: 'Subequipo', COMPONENTE: 'Componente'
};
export const LEVEL_PREFIX = { SISTEMA: 'SIS', EQUIPO: 'EQ', SUBEQUIPO: 'SEQ', COMPONENTE: 'CMP' };
export const NODE_PARENT = { PLANTA: null, PROCESO: 'PLANTA', LINEA: 'PROCESO' };
export const PARENT_RULES = {
  SISTEMA: ['NODO:PROCESO', 'NODO:LINEA'],
  EQUIPO: ['NODO:PROCESO', 'NODO:LINEA', 'SISTEMA'],
  SUBEQUIPO: ['EQUIPO'],
  COMPONENTE: ['EQUIPO', 'SUBEQUIPO']
};

export const isLive = r => r && r.ESTADO_REGISTRO !== 'ANULADO';
export const isActive = r => r && (r.ESTADO_REGISTRO || 'ACTIVO') === 'ACTIVO';

export const findNode = (data, id) => (data.JERARQUIA || []).find(n => n.ID_NODO === id) || null;
export const findAsset = (data, id) => (data.ACTIVOS || []).find(a => a.ID_ACTIVO === id) || null;

// 'NODO:LINEA', 'EQUIPO', … o null si no existe/está anulado
export function kindOf(data, id) {
  const n = findNode(data, id);
  if (n && isLive(n)) return 'NODO:' + n.NIVEL;
  const a = findAsset(data, id);
  if (a && isLive(a)) return a.NIVEL_JERARQUIA;
  return null;
}

// Ruta desde la raíz hasta el elemento: [{id, name, code, level, isNode}]
export function pathOf(data, id) {
  const out = [];
  let cur = id, guard = 0;
  while (cur && guard++ < 25) {
    const a = findAsset(data, cur);
    if (a) { out.unshift({ id: a.ID_ACTIVO, name: a.NOMBRE_ACTIVO, code: a.CODIGO_ACTIVO, level: a.NIVEL_JERARQUIA, isNode: false }); cur = a.ID_PADRE; continue; }
    const n = findNode(data, cur);
    if (!n) break;
    out.unshift({ id: n.ID_NODO, name: n.NOMBRE_NODO, code: n.CODIGO_NODO, level: n.NIVEL, isNode: true });
    cur = n.ID_PADRE;
  }
  return out;
}

export function resolveLocation(data, idPadre) {
  const loc = { PROCESO: '', LINEA: '', ID_PROCESO: '', ID_LINEA: '' };
  for (const p of pathOf(data, idPadre).reverse()) {
    if (!p.isNode) continue;
    if (p.level === 'LINEA' && !loc.ID_LINEA) { loc.LINEA = p.name; loc.ID_LINEA = p.id; }
    if (p.level === 'PROCESO') { loc.PROCESO = p.name; loc.ID_PROCESO = p.id; break; }
  }
  return loc;
}

// Opciones válidas de padre para un nivel de activo (solo registros ACTIVOS)
export function allowedParents(data, level, excludeId) {
  const rules = PARENT_RULES[level] || [];
  const opts = [];
  for (const n of data.JERARQUIA || []) {
    if (isActive(n) && rules.includes('NODO:' + n.NIVEL)) opts.push(option(data, n.ID_NODO));
  }
  for (const a of data.ACTIVOS || []) {
    if (a.ID_ACTIVO !== excludeId && isActive(a) && rules.includes(a.NIVEL_JERARQUIA)) opts.push(option(data, a.ID_ACTIVO));
  }
  return opts.sort((x, y) => x.label.localeCompare(y.label, 'es'));
}

export function allowedNodeParents(data, level) {
  const parentLevel = NODE_PARENT[level];
  if (!parentLevel) return [];
  return (data.JERARQUIA || []).filter(n => isActive(n) && n.NIVEL === parentLevel).map(n => option(data, n.ID_NODO));
}

function option(data, id) {
  const p = pathOf(data, id);
  return { value: id, label: p.map(x => x.isNode ? x.name : `${x.code} ${x.name}`).join(' › ') };
}

// IDs de todos los activos que cuelgan (directa o indirectamente) de un activo o nodo
export function descendantAssetIds(data, rootId) {
  const out = [];
  const stack = [rootId];
  const nodesByParent = group(data.JERARQUIA || [], 'ID_PADRE');
  const assetsByParent = group(data.ACTIVOS || [], 'ID_PADRE');
  while (stack.length) {
    const id = stack.pop();
    for (const n of nodesByParent[id] || []) stack.push(n.ID_NODO);
    for (const a of assetsByParent[id] || []) { out.push(a.ID_ACTIVO); stack.push(a.ID_ACTIVO); }
  }
  return out;
}

// Árbol combinado de nodos y activos para la vista de jerarquía
export function buildTree(data, { showInactive = false } = {}) {
  const visible = r => showInactive ? isLive(r) : isActive(r);
  const items = [
    ...(data.JERARQUIA || []).filter(visible).map(n => ({ id: n.ID_NODO, parent: n.ID_PADRE || '', isNode: true, level: n.NIVEL, name: n.NOMBRE_NODO, code: n.CODIGO_NODO, rec: n, children: [] })),
    ...(data.ACTIVOS || []).filter(visible).map(a => ({ id: a.ID_ACTIVO, parent: a.ID_PADRE || '', isNode: false, level: a.NIVEL_JERARQUIA, name: a.NOMBRE_ACTIVO, code: a.CODIGO_ACTIVO, rec: a, children: [] }))
  ];
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  const roots = [];
  for (const i of items) (byId[i.parent] ? byId[i.parent].children : roots).push(i);
  const order = i => (i.isNode ? NODE_LEVELS.indexOf(i.level) : 10 + ASSET_LEVELS.indexOf(i.level));
  const sort = list => { list.sort((a, b) => order(a) - order(b) || String(a.code).localeCompare(String(b.code), 'es')); list.forEach(i => sort(i.children)); };
  sort(roots);
  return roots;
}

function group(list, key) {
  const g = {};
  for (const r of list) (g[r[key]] = g[r[key]] || []).push(r);
  return g;
}
