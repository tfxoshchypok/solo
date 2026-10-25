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
  if (node.kind === 'entry') {
    node.projectProperties = { ...emptyProjectProperties(), ...rest.projectProperties }
  }
  if (node.kind === 'panel') Object.assign(node, panelFields(rest))
  nodes[node.id] = node
  for (const child of children) walk(child, node.id, nodes)
}

/** The entry's six project properties, all empty (003/FR-003). */
export function emptyProjectProperties() {
  return {
    supplyPhases: null,
    moduleReservePct: null,
    separateRcdMode: null,
    maxLinesPerGroupRcd: null,
    neutralBreak: null,
    selectiveFeederRcd: null,
  }
}

/** The keys a new panel gets (003/FR-009), each object key overridable through the spec. */
function panelFields({ overrides, incomingDevices = [], buySeparately, calculated }) {
  return {
    overrides: {
      moduleReservePct: null,
      separateRcdMode: null,
      maxLinesPerGroupRcd: null,
      neutralBreak: null,
      selectiveFeederRcd: null,
      ...overrides,
    },
    incomingDevices,
    buySeparately: {
      neutralBars: false,
      peBar: false,
      combBusbars: false,
      cableGlands: false,
      blankingPlates: false,
      ...buySeparately,
    },
    calculated: {
      enclosure: null,
      deviceComposition: null,
      accessoryQuantities: null,
      groupRcd: null,
      phase: null,
      ...calculated,
    },
  }
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

/** A whole incoming device widths row (003/FR-009). */
export function incomingDeviceRow({
  id = 'iw-test',
  name = 'Тестовий апарат',
  width1ph = 2,
  width3ph = 4,
} = {}) {
  return { id, name, width1ph, width3ph }
}

/** A consumer child literal for `tree()`, holding copies of whole rows (002/FR-010). */
export function consumer(
  id,
  {
    loadType = loadTypeRow(),
    zone = zoneRow(),
    cableSectionMm2 = null,
    calculated = { groupRcd: null, phase: null },
    ...extra
  } = {},
) {
  return { id, kind: 'consumer', name: id, loadType, zone, cableSectionMm2, calculated, ...extra }
}

/** A chain of `count` panels below the entry, ids p1 … pN. */
export function panelChain(count) {
  let node = null
  for (let i = count; i >= 1; i -= 1) {
    node = { id: `p${i}`, kind: 'panel', name: `Щиток ${i}`, children: node ? [node] : [] }
  }
  return tree({ id: 'root', kind: 'entry', name: 'Ввід', children: node ? [node] : [] })
}
