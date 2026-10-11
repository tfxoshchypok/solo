// Builders shared by the engine suites. A nested literal in, the normalized frozen map out —
// the same shape `stores/tree.js` holds, so a test never hand-writes parentId/childIds pairs.

/**
 * @param {object} spec nested node literal: { id, kind, name, children?, ...fields }
 * @returns {{ rootId: string, nodes: object }}
 */
export function tree(spec) {
  const nodes = {}
  walk(spec, null, nodes)
  return { rootId: spec.id, nodes }
}

function walk(spec, parentId, nodes) {
  const { children = [], ...rest } = spec
  const node = { ...rest, parentId, childIds: children.map((c) => c.id) }
  if (node.kind === 'consumer') {
    node.childIds = []
  } else {
    node.childrenKind = childrenKindOf(children)
  }
  nodes[node.id] = node
  for (const child of children) walk(child, node.id, nodes)
}

function childrenKindOf(children) {
  if (children.length === 0) return 'undecided'
  return children[0].kind === 'consumer' ? 'consumers' : 'panels'
}

/** A whole load types row, every cell but the name empty. Its id is in no table, which is valid. */
export function loadTypeRow(fields = {}) {
  return {
    id: 'lt-test',
    name: 'Тестовий тип',
    ratedPowerKw: null,
    phases: null,
    breakerCurve: null,
    continuous: null,
    powerFactor: null,
    demandFactor: null,
    rcdType: null,
    ...fields,
  }
}

/** A whole zones row, every cell but the name empty. */
export function zoneRow(fields = {}) {
  return {
    id: 'zn-test',
    name: 'Тестова зона',
    rcdRequired: null,
    leakageMa: null,
    minIp: null,
    separateRcd: null,
    purpose: null,
    ...fields,
  }
}

/** A consumer child literal for `tree()`, holding copies of whole rows (002/FR-010). */
export function consumer(
  id,
  { loadType = loadTypeRow(), zone = zoneRow(), cableSectionMm2 = null, ...extra } = {},
) {
  return { id, kind: 'consumer', name: id, loadType, zone, cableSectionMm2, ...extra }
}

/** A chain of `count` panels below the entry, ids p1 … pN. */
export function panelChain(count) {
  let node = null
  for (let i = count; i >= 1; i -= 1) {
    node = { id: `p${i}`, kind: 'panel', name: `Щиток ${i}`, children: node ? [node] : [] }
  }
  return tree({ id: 'root', kind: 'entry', name: 'Ввід', children: node ? [node] : [] })
}
