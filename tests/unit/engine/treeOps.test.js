import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import * as v from 'valibot'
import { freeze } from 'immer'
import { ConsumerNodeSchema } from '@/schemas/index.js'
import {
  addNode,
  removeNode,
  moveNode,
  reorderSibling,
  renameNode,
  setNote,
  setConsumerLoadType,
  setConsumerZone,
  setConsumerCopyValue,
  setCableSection,
  wrapChildrenInPanel,
  descendantIds,
  depthOf,
  isDescendantOf,
  MAX_PANEL_DEPTH,
  RuleError,
} from '@/modules/tree/engine/treeOps.js'
import { tree, consumer, panelChain, loadTypeRow, zoneRow } from '../../fixtures/tree.js'

// Rows as the reference store holds them; the engine copies whatever row it is handed (002/FR-010).
const lamp = loadTypeRow({ id: 'lt-lamp', name: 'Світильник' })
const hall = zoneRow({ id: 'zn-hall', name: 'Коридор' })
const fridge = loadTypeRow({ id: 'lt-fridge', name: 'Холодильник', ratedPowerKw: 0.3 })
const kitchen = zoneRow({ id: 'zn-kitchen', name: 'Кухня', rcdRequired: true, leakageMa: 30 })

const twoPanelsWithConsumers = () =>
  tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [
      {
        id: 'p1',
        kind: 'panel',
        name: 'Щиток',
        children: [
          {
            id: 'p2',
            kind: 'panel',
            name: 'Кухня',
            children: [consumer('c1'), consumer('c2')],
          },
          { id: 'p3', kind: 'panel', name: 'Спальня', children: [consumer('c3')] },
        ],
      },
    ],
  })

describe('treeOps.addNode (FR-006)', () => {
  it('appends the new node to the parent and returns its id', () => {
    const { nodes } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    const result = addNode(nodes, { parentId: 'root', kind: 'panel', name: 'Щиток' })
    expect(result.nodeId).toBeTypeOf('string')
    expect(result.nodes.root.childIds).toEqual([result.nodeId])
    expect(result.nodes[result.nodeId]).toMatchObject({
      kind: 'panel',
      name: 'Щиток',
      parentId: 'root',
      childIds: [],
      childrenKind: 'undecided',
    })
  })

  it('never mutates the map it was given', () => {
    const { nodes } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    addNode(nodes, { parentId: 'root', kind: 'panel', name: 'Щиток' })
    expect(nodes.root.childIds).toEqual([])
  })

  it('builds a consumer of exactly its field list, holding copies of both rows (002/FR-010, 002/FR-012)', () => {
    const { nodes } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    const { nodes: next, nodeId } = addNode(nodes, {
      parentId: 'root',
      kind: 'consumer',
      name: 'Холодильник',
      loadType: fridge,
      zone: kitchen,
    })
    expect(next[nodeId]).toEqual({
      id: nodeId,
      kind: 'consumer',
      name: 'Холодильник',
      parentId: 'root',
      childIds: [],
      loadType: fridge,
      zone: kitchen,
      cableSectionMm2: null,
    })
    expect(next[nodeId].loadType).not.toBe(fridge)
    expect(next[nodeId].zone).not.toBe(kitchen)
  })

  it('builds a consumer that satisfies ConsumerNodeSchema, not one the schema rejects', () => {
    const { nodes } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    const { nodes: next, nodeId } = addNode(nodes, {
      parentId: 'root',
      kind: 'consumer',
      name: 'Холодильник',
      loadType: fridge,
      zone: kitchen,
    })
    expect(v.safeParse(ConsumerNodeSchema, next[nodeId]).success).toBe(true)
  })

  it('refuses a consumer with no load type or no zone row, naming which (002/FR-010)', () => {
    const { nodes } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    const cases = [
      [{ zone: kitchen }, 'loadTypeRequired'],
      [{ loadType: fridge }, 'zoneRequired'],
      [{ loadType: loadTypeRow({ id: '  ' }), zone: kitchen }, 'loadTypeRequired'],
      [{ loadType: fridge, zone: null }, 'zoneRequired'],
    ]
    for (const [rows, code] of cases) {
      let thrown
      try {
        addNode(nodes, { parentId: 'root', kind: 'consumer', name: 'Лампа', ...rows })
      } catch (error) {
        thrown = error
      }
      expect(thrown, JSON.stringify(rows)).toBeInstanceOf(RuleError)
      expect(thrown.code).toBe(code)
    }
  })

  it('refuses a panel deeper than 6 levels below the entry, naming the limit (FR-007)', () => {
    const { nodes } = panelChain(MAX_PANEL_DEPTH)
    expect(depthOf(nodes, `p${MAX_PANEL_DEPTH}`)).toBe(MAX_PANEL_DEPTH)
    let thrown
    try {
      addNode(nodes, { parentId: `p${MAX_PANEL_DEPTH}`, kind: 'panel', name: 'Задовго' })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RuleError)
    expect(thrown.code).toBe('depthLimit')
    expect(thrown.message).toContain(String(MAX_PANEL_DEPTH))
  })

  it('still accepts a consumer under the deepest allowed panel', () => {
    const { nodes } = panelChain(MAX_PANEL_DEPTH)
    const { nodes: next, nodeId } = addNode(nodes, {
      parentId: `p${MAX_PANEL_DEPTH}`,
      kind: 'consumer',
      name: 'Світильник',
      loadType: lamp,
      zone: hall,
    })
    expect(depthOf(next, nodeId)).toBe(MAX_PANEL_DEPTH + 1)
  })
})

describe('treeOps.addNode guards the fields the schema requires', () => {
  it('refuses a blank name on any kind, which ProjectSchema would reject at save time', () => {
    const { nodes, rootId } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    expect(() => addNode(nodes, { parentId: rootId, kind: 'panel', name: '' })).toThrow(RuleError)
    expect(() => addNode(nodes, { parentId: rootId, kind: 'panel', name: '   ' })).toThrow(
      RuleError,
    )
  })
})

describe('treeOps survives a cyclic map instead of hanging', () => {
  // A hand-edited or truncated file can name two nodes as each other's parent. The schema checks
  // shape, not acyclicity, so the engine is the last line before the window locks up.
  const cyclic = () => ({
    a: { id: 'a', kind: 'panel', name: 'A', parentId: 'b', childIds: [] },
    b: { id: 'b', kind: 'panel', name: 'B', parentId: 'a', childIds: [] },
  })

  it('depthOf refuses a cycle rather than looping forever', () => {
    expect(() => depthOf(cyclic(), 'a')).toThrow(RuleError)
  })

  it('isDescendantOf refuses a cycle rather than looping forever', () => {
    expect(() => isDescendantOf(cyclic(), 'a', 'zzz')).toThrow(RuleError)
  })
})

describe('treeOps.removeNode (FR-010)', () => {
  it('reports every removed id, the node itself included', () => {
    const { nodes } = twoPanelsWithConsumers()
    const { nodes: next, removedIds } = removeNode(nodes, 'p2')
    expect(removedIds.sort()).toEqual(['c1', 'c2', 'p2'])
    expect(next.p2).toBeUndefined()
    expect(next.c1).toBeUndefined()
    expect(next.p1.childIds).toEqual(['p3'])
  })

  it('returns the parent to undecided when its last child leaves (FR-018)', () => {
    const { nodes } = twoPanelsWithConsumers()
    const { nodes: next } = removeNode(nodes, 'c3')
    expect(next.p3.childIds).toEqual([])
    expect(next.p3.childrenKind).toBe('undecided')
  })

  it('refuses to remove the service entry (FR-002)', () => {
    const { nodes } = twoPanelsWithConsumers()
    expect(() => removeNode(nodes, 'root')).toThrow(RuleError)
  })
})

describe('treeOps.moveNode (FR-008, FR-009)', () => {
  it('moves the whole sub-tree with the node', () => {
    const { nodes } = twoPanelsWithConsumers()
    const next = moveNode(nodes, 'p2', 'root', 0)
    expect(next.p2.parentId).toBe('root')
    expect(next.p2.childIds).toEqual(['c1', 'c2'])
    expect(next.c1.parentId).toBe('p2')
    expect(descendantIds(next, 'p2').sort()).toEqual(['c1', 'c2'])
  })

  it('inserts at the requested index among the new siblings', () => {
    const { nodes } = twoPanelsWithConsumers()
    const withThird = addNode(nodes, { parentId: 'p1', kind: 'panel', name: 'Коридор' })
    const next = moveNode(withThird.nodes, withThird.nodeId, 'p1', 1)
    expect(next.p1.childIds).toEqual(['p2', withThird.nodeId, 'p3'])
  })

  it('rejects a move into the node’s own sub-tree, leaving the tree unchanged (FR-008)', () => {
    const { nodes } = twoPanelsWithConsumers()
    const before = JSON.stringify(nodes)
    let thrown
    try {
      moveNode(nodes, 'p1', 'p2', 0)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RuleError)
    expect(thrown.code).toBe('cycle')
    expect(JSON.stringify(nodes)).toBe(before)
  })

  it('rejects a move onto the node itself', () => {
    const { nodes } = twoPanelsWithConsumers()
    expect(() => moveNode(nodes, 'p2', 'p2', 0)).toThrow(RuleError)
  })

  it('accepts a move that lands the sub-tree exactly on the depth limit (FR-007)', () => {
    const { nodes } = panelChain(MAX_PANEL_DEPTH)
    const spare = addNode(nodes, { parentId: 'root', kind: 'panel', name: 'Резерв' })
    const moved = moveNode(spare.nodes, spare.nodeId, `p${MAX_PANEL_DEPTH - 1}`, 0)
    expect(depthOf(moved, spare.nodeId)).toBe(MAX_PANEL_DEPTH)
  })

  it('rejects a move that would push the sub-tree’s own children past the limit (FR-007, FR-009)', () => {
    const { nodes } = panelChain(MAX_PANEL_DEPTH)
    const spare = addNode(nodes, { parentId: 'root', kind: 'panel', name: 'Резерв' })
    const spareChild = addNode(spare.nodes, {
      parentId: spare.nodeId,
      kind: 'panel',
      name: 'Резерв — підщиток',
    })
    // The spare itself would land on the limit, but it carries a panel one level below it.
    let thrown
    try {
      moveNode(spareChild.nodes, spare.nodeId, `p${MAX_PANEL_DEPTH - 1}`, 0)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RuleError)
    expect(thrown.code).toBe('depthLimit')

    // One level higher there is room for both.
    const ok = moveNode(spareChild.nodes, spare.nodeId, `p${MAX_PANEL_DEPTH - 2}`, 0)
    expect(depthOf(ok, spareChild.nodeId)).toBe(MAX_PANEL_DEPTH)
  })
})

describe('treeOps.reorderSibling (FR-006)', () => {
  it('moves a node among its siblings without changing its parent', () => {
    const { nodes } = twoPanelsWithConsumers()
    const next = reorderSibling(nodes, 'c2', 0)
    expect(next.p2.childIds).toEqual(['c2', 'c1'])
    expect(next.c2.parentId).toBe('p2')
  })

  it('leaves the siblings untouched when the parent no longer lists the node', () => {
    const { nodes } = twoPanelsWithConsumers()
    // A stale drop callback: the node is still in the map, but its parent has already stopped
    // listing it, so indexOf answers -1 and a bare splice(-1, 1) would drop the last sibling.
    nodes.p2.childIds = ['c1']
    const next = reorderSibling(nodes, 'c2', 0)
    expect(next.p2.childIds).toEqual(['c1'])
  })
})

describe('treeOps.renameNode', () => {
  it('changes the name of that node and of nothing else (FR-006, FR-024)', () => {
    const { nodes } = twoPanelsWithConsumers()
    const next = renameNode(nodes, 'p2', 'Кухня — розетки')
    expect(next.p2.name).toBe('Кухня — розетки')
    expect(next.p2.childIds).toEqual(nodes.p2.childIds)
    // immer keeps untouched nodes as the same object, which is the strongest form of "unaffected".
    expect(next.p1).toBe(nodes.p1)
    expect(next.root).toBe(nodes.root)
  })
})

describe('treeOps.setNote (FR-012)', () => {
  it('attaches a note to a panel and leaves everything else alone', () => {
    const { nodes } = twoPanelsWithConsumers()
    const next = setNote(nodes, 'p2', 'узгодити з замовником')
    expect(next.p2.note).toBe('узгодити з замовником')
    expect(next.p2.name).toBe('Кухня')
    expect(next.p2.childIds).toEqual(nodes.p2.childIds)
  })

  it('an empty note drops the field rather than storing an empty string', () => {
    const { nodes } = twoPanelsWithConsumers()
    const withNote = setNote(nodes, 'p2', 'тимчасово')
    const cleared = setNote(withNote, 'p2', '   ')
    expect('note' in cleared.p2).toBe(false)
  })

  it('refuses a note on a consumer, whose field list has none (002/FR-009)', () => {
    const { nodes } = twoPanelsWithConsumers()
    let thrown
    try {
      setNote(nodes, 'c1', 'узгодити з замовником')
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RuleError)
    expect(thrown.code).toBe('noteOnConsumer')
  })
})

describe('treeOps.wrapChildrenInPanel (FR-016)', () => {
  it('moves every existing child into a new panel, in one legal step', () => {
    const { nodes } = twoPanelsWithConsumers()
    const { nodes: next, nodeId } = wrapChildrenInPanel(nodes, 'p2', 'Освітлення')
    expect(next.p2.childIds).toEqual([nodeId])
    expect(next.p2.childrenKind).toBe('panels')
    expect(next[nodeId].childIds).toEqual(['c1', 'c2'])
    expect(next[nodeId].childrenKind).toBe('consumers')
    expect(next.c1.parentId).toBe(nodeId)
  })

  it('refuses to wrap when the panel already holds panels — there is nothing to fix', () => {
    const { nodes } = twoPanelsWithConsumers()
    expect(() => wrapChildrenInPanel(nodes, 'p1', 'Нова група')).toThrow(RuleError)
  })

  it('refuses to wrap an empty panel, which can take a panel child directly', () => {
    const { nodes } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    expect(() => wrapChildrenInPanel(nodes, 'root', 'Група')).toThrow(RuleError)
  })

  it('keeps the depth guard: wrapping adds a level (FR-007)', () => {
    const { nodes } = panelChain(MAX_PANEL_DEPTH)
    const withConsumer = addNode(nodes, {
      parentId: `p${MAX_PANEL_DEPTH}`,
      kind: 'consumer',
      name: 'Лампа',
      loadType: lamp,
      zone: hall,
    }).nodes
    expect(() => wrapChildrenInPanel(withConsumer, `p${MAX_PANEL_DEPTH}`, 'Група')).toThrow(
      RuleError,
    )
  })
})

// The eight keys a consumer carries, and no more (002/FR-009). The load type and the zone are copies
// of whole rows (002/FR-010).
const CONSUMER_KEYS = [
  'childIds',
  'cableSectionMm2',
  'id',
  'kind',
  'loadType',
  'name',
  'parentId',
  'zone',
]

const oven = loadTypeRow({ id: 'lt-oven', name: 'Духова шафа', ratedPowerKw: 3, demandFactor: 0.7 })
const microwave = loadTypeRow({
  id: 'lt-microwave',
  name: 'Мікрохвильова піч',
  ratedPowerKw: 1.2,
  demandFactor: 0.3,
})

/** Entry → panel → one consumer named after its load type, «Духова шафа». */
const kitchenWithOven = () =>
  tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [
      {
        id: 'p1',
        kind: 'panel',
        name: 'Кухня',
        children: [consumer('oven', { name: 'Духова шафа', loadType: oven, zone: kitchen })],
      },
    ],
  })

const refusal = (fn) => {
  try {
    fn()
  } catch (error) {
    if (error instanceof RuleError) return error
    throw error
  }
  return null
}
const refusalCode = (fn) => refusal(fn)?.code ?? null

describe('treeOps.setConsumerLoadType — a fresh copy of the chosen row (002/FR-010, 002/FR-014)', () => {
  it('copies the whole row and renames a consumer still named after its copied load type', () => {
    const { nodes } = kitchenWithOven()
    const next = setConsumerLoadType(nodes, 'oven', microwave)
    expect(next.oven.loadType).toEqual(microwave)
    expect(next.oven.loadType).not.toBe(microwave)
    expect(next.oven.name).toBe('Мікрохвильова піч')
  })

  it('keeps a name the user typed', () => {
    const { nodes } = kitchenWithOven()
    const renamed = renameNode(nodes, 'oven', 'Духовка під стільницею')
    const next = setConsumerLoadType(renamed, 'oven', microwave)
    expect(next.oven.loadType).toEqual(microwave)
    expect(next.oven.name).toBe('Духовка під стільницею')
  })

  it('compares the name with the copy, so the same row chosen after its rename in the table renames', () => {
    const { nodes } = kitchenWithOven()
    const rowNow = { ...oven, name: 'Духова шафа вбудована', demandFactor: 0.8 }
    const next = setConsumerLoadType(nodes, 'oven', rowNow)
    expect(next.oven.loadType).toEqual(rowNow)
    expect(next.oven.name).toBe('Духова шафа вбудована')
  })

  it('replaces a value changed by hand when the same row is chosen again', () => {
    const { nodes } = kitchenWithOven()
    const edited = setConsumerCopyValue(nodes, 'oven', 'loadType', 'demandFactor', 0.95)
    expect(edited.oven.loadType.demandFactor).toBe(0.95)
    const next = setConsumerLoadType(edited, 'oven', oven)
    expect(next.oven.loadType).toEqual(oven)
  })

  it('refuses no row, or a row without an id', () => {
    const { nodes } = kitchenWithOven()
    expect(refusalCode(() => setConsumerLoadType(nodes, 'oven', null))).toBe('loadTypeRequired')
    expect(refusalCode(() => setConsumerLoadType(nodes, 'oven', loadTypeRow({ id: '' })))).toBe(
      'loadTypeRequired',
    )
  })
})

describe('treeOps.setConsumerZone — a fresh copy of the chosen row (002/FR-010, 002/FR-014)', () => {
  it('copies the whole row and leaves the name alone', () => {
    const { nodes } = kitchenWithOven()
    const bathroom = zoneRow({ id: 'zn-bath', name: 'Ванна', leakageMa: 10, minIp: 'IP44' })
    const next = setConsumerZone(nodes, 'oven', bathroom)
    expect(next.oven.zone).toEqual(bathroom)
    expect(next.oven.zone).not.toBe(bathroom)
    expect(next.oven.name).toBe('Духова шафа')
  })

  it('refuses no row', () => {
    const { nodes } = kitchenWithOven()
    expect(refusalCode(() => setConsumerZone(nodes, 'oven', null))).toBe('zoneRequired')
  })
})

describe('treeOps.setConsumerCopyValue — one copied value, this consumer only (002/FR-021)', () => {
  const twoOvens = () =>
    tree({
      id: 'root',
      kind: 'entry',
      name: 'Ввід',
      children: [
        {
          id: 'p1',
          kind: 'panel',
          name: 'Кухня',
          children: [
            consumer('oven', { loadType: oven, zone: kitchen }),
            consumer('oven2', { loadType: oven, zone: kitchen }),
          ],
        },
      ],
    })

  it('sets one key of the copy and leaves every other key and the other consumer as they were', () => {
    const { nodes } = twoOvens()
    const next = setConsumerCopyValue(nodes, 'oven', 'loadType', 'demandFactor', 0.6)
    expect(next.oven.loadType).toEqual({ ...oven, demandFactor: 0.6 })
    expect(next.oven2.loadType).toEqual(oven)
    expect(next.oven.zone).toEqual(kitchen)
  })

  it('sets a zone value of each kind, an empty cell included', () => {
    const { nodes } = twoOvens()
    let next = setConsumerCopyValue(nodes, 'oven', 'zone', 'minIp', 'IP44')
    next = setConsumerCopyValue(next, 'oven', 'zone', 'rcdRequired', false)
    next = setConsumerCopyValue(next, 'oven', 'zone', 'leakageMa', null)
    expect(next.oven.zone).toEqual({
      ...kitchen,
      minIp: 'IP44',
      rcdRequired: false,
      leakageMa: null,
    })
  })

  it('refuses the id and the name, which only a new choice of row changes', () => {
    const { nodes } = twoOvens()
    for (const part of ['loadType', 'zone']) {
      for (const key of ['id', 'name']) {
        expect(
          refusalCode(() => setConsumerCopyValue(nodes, 'oven', part, key, 'інше')),
          `${part}.${key}`,
        ).toBe('copyKeyLocked')
      }
    }
  })

  it('refuses a key the row does not have', () => {
    const { nodes } = twoOvens()
    expect(refusalCode(() => setConsumerCopyValue(nodes, 'oven', 'loadType', 'quantity', 2))).toBe(
      'unknownColumn',
    )
    expect(refusalCode(() => setConsumerCopyValue(nodes, 'oven', 'zone', 'demandFactor', 1))).toBe(
      'unknownColumn',
    )
  })

  it('refuses a value its column refuses, naming the column by its header (002/FR-006)', () => {
    const { nodes } = twoOvens()
    const cases = [
      ['loadType', 'demandFactor', '0.6', 'Кп'],
      ['loadType', 'ratedPowerKw', Number.NaN, 'P, кВт'],
      ['zone', 'rcdRequired', 'так', 'ПЗВ обов'],
    ]
    for (const [part, key, value, header] of cases) {
      const error = refusal(() => setConsumerCopyValue(nodes, 'oven', part, key, value))
      expect(error?.code, `${part}.${key}`).toBe('badCopyValue')
      expect(error.message).toContain(header)
    }
  })
})

describe('treeOps.setCableSection (002/FR-011)', () => {
  it('stores a positive cross-section and clears it back to null', () => {
    const { nodes } = kitchenWithOven()
    const set = setCableSection(nodes, 'oven', 2.5)
    expect(set.oven.cableSectionMm2).toBe(2.5)
    const cleared = setCableSection(set, 'oven', null)
    expect(cleared.oven.cableSectionMm2).toBeNull()
    expect(cleared.oven).toHaveProperty('cableSectionMm2')
  })

  it('refuses 0, a negative number and a value that is not finite', () => {
    const { nodes } = kitchenWithOven()
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        refusalCode(() => setCableSection(nodes, 'oven', bad)),
        String(bad),
      ).toBe('badCableSection')
    }
  })
})

describe('the consumer setters refuse a panel and keep the consumer at its eight keys (002/FR-009)', () => {
  it('refuses a panel in all four', () => {
    const { nodes } = kitchenWithOven()
    expect(refusalCode(() => setConsumerLoadType(nodes, 'p1', microwave))).toBe('notAConsumer')
    expect(refusalCode(() => setConsumerZone(nodes, 'p1', kitchen))).toBe('notAConsumer')
    expect(refusalCode(() => setCableSection(nodes, 'p1', 2.5))).toBe('notAConsumer')
    expect(
      refusalCode(() => setConsumerCopyValue(nodes, 'p1', 'loadType', 'demandFactor', 0.5)),
    ).toBe('notAConsumer')
  })

  it('leaves the consumer at exactly its eight keys, and each copy at its row’s keys, so nothing computed is stored (002/FR-020)', () => {
    const { nodes } = kitchenWithOven()
    const results = [
      setConsumerLoadType(nodes, 'oven', microwave),
      setConsumerZone(nodes, 'oven', kitchen),
      setCableSection(nodes, 'oven', 4),
      setConsumerCopyValue(nodes, 'oven', 'zone', 'minIp', 'IP44'),
    ]
    for (const next of results) {
      expect(Object.keys(next.oven).sort()).toEqual([...CONSUMER_KEYS].sort())
      expect(Object.keys(next.oven.loadType).sort()).toEqual(Object.keys(loadTypeRow()).sort())
      expect(Object.keys(next.oven.zone).sort()).toEqual(Object.keys(zoneRow()).sort())
    }
  })
})

describe('treeOps queries', () => {
  it('descendantIds returns the whole sub-tree without the node itself (FR-010)', () => {
    const { nodes } = twoPanelsWithConsumers()
    expect(descendantIds(nodes, 'p1').sort()).toEqual(['c1', 'c2', 'c3', 'p2', 'p3'])
    expect(descendantIds(nodes, 'c1')).toEqual([])
  })

  it('depthOf counts the entry as zero', () => {
    const { nodes } = twoPanelsWithConsumers()
    expect(depthOf(nodes, 'root')).toBe(0)
    expect(depthOf(nodes, 'p1')).toBe(1)
    expect(depthOf(nodes, 'c1')).toBe(3)
  })

  it('isDescendantOf answers both directions (FR-008)', () => {
    const { nodes } = twoPanelsWithConsumers()
    expect(isDescendantOf(nodes, 'c1', 'p1')).toBe(true)
    expect(isDescendantOf(nodes, 'p1', 'c1')).toBe(false)
    expect(isDescendantOf(nodes, 'p2', 'p2')).toBe(false)
  })
})

describe('property: every returned map is frozen (FR-008, R5, R10)', () => {
  it('holds over arbitrary sequences of every mutating operation', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            op: fc.constantFrom('addPanel', 'addConsumer', 'move', 'remove', 'rename', 'reorder'),
            parentPick: fc.nat({ max: 20 }),
            nodePick: fc.nat({ max: 20 }),
            index: fc.nat({ max: 3 }),
          }),
          { maxLength: 25 },
        ),
        (script) => {
          // Frozen to start with, which is what the store holds (stores/tree.js freezes on load).
          let nodes = freeze(twoPanelsWithConsumers().nodes, true)
          for (const step of script) {
            const ids = Object.keys(nodes)
            const nodeId = ids[step.nodePick % ids.length]
            const parentId = ids[step.parentPick % ids.length]
            let next
            try {
              switch (step.op) {
                case 'addPanel':
                  next = addNode(nodes, { parentId, kind: 'panel', name: 'щиток' }).nodes
                  break
                case 'addConsumer':
                  next = addNode(nodes, {
                    parentId,
                    kind: 'consumer',
                    name: 'прилад',
                    loadType: lamp,
                    zone: hall,
                  }).nodes
                  break
                case 'move':
                  next = moveNode(nodes, nodeId, parentId, step.index)
                  break
                case 'remove':
                  next = removeNode(nodes, nodeId).nodes
                  break
                case 'rename':
                  next = renameNode(nodes, nodeId, 'нова назва')
                  break
                default:
                  next = reorderSibling(nodes, nodeId, step.index)
              }
            } catch (error) {
              if (!(error instanceof RuleError)) throw error
              continue
            }
            expect(Object.isFrozen(next)).toBe(true)
            for (const node of Object.values(next)) {
              expect(Object.isFrozen(node)).toBe(true)
              expect(Object.isFrozen(node.childIds)).toBe(true)
            }
            const someId = Object.keys(next)[0]
            expect(() => {
              next[someId].name = 'патч на місці'
            }).toThrow(TypeError)
            nodes = next
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('property: no sequence of moveNode calls produces a cycle (FR-008, R10)', () => {
  it('holds over arbitrary move sequences', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ nodePick: fc.nat({ max: 20 }), parentPick: fc.nat({ max: 20 }) }), {
          maxLength: 30,
        }),
        (script) => {
          let { nodes } = twoPanelsWithConsumers()
          for (const step of script) {
            const ids = Object.keys(nodes)
            try {
              nodes = moveNode(
                nodes,
                ids[step.nodePick % ids.length],
                ids[step.parentPick % ids.length],
                0,
              )
            } catch (error) {
              if (!(error instanceof RuleError)) throw error
            }
          }
          // Every node reaches the root by walking parentId, within the depth budget.
          for (const id of Object.keys(nodes)) {
            let steps = 0
            let cursor = nodes[id]
            while (cursor.parentId !== null) {
              cursor = nodes[cursor.parentId]
              steps += 1
              expect(steps).toBeLessThanOrEqual(MAX_PANEL_DEPTH + 1)
            }
            expect(cursor.id).toBe('root')
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
