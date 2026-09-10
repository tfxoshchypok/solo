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
  descendantIds,
  depthOf,
  isDescendantOf,
  MAX_PANEL_DEPTH,
  RuleError,
} from '@/modules/tree/engine/treeOps.js'
import { tree, consumer, panelChain } from '../../fixtures/tree.js'

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
            children: [consumer('c1', 'lamp'), consumer('c2', 'socket')],
          },
          { id: 'p3', kind: 'panel', name: 'Спальня', children: [consumer('c3', 'lamp')] },
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

  it('carries typeId onto a consumer and gives it a quantity of 1 (FR-025)', () => {
    const { nodes } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    const { nodes: next, nodeId } = addNode(nodes, {
      parentId: 'root',
      kind: 'consumer',
      name: 'Холодильник',
      typeId: 'fridge-16-20',
      typeName: 'Холодильник',
    })
    expect(next[nodeId]).toMatchObject({ typeId: 'fridge-16-20', quantity: 1, childIds: [] })
  })

  it('builds a consumer that satisfies ConsumerNodeSchema, not one the schema rejects', () => {
    const { nodes } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    const { nodes: next, nodeId } = addNode(nodes, {
      parentId: 'root',
      kind: 'consumer',
      name: 'Холодильник',
      typeId: 'fridge-16-20',
      typeName: 'Холодильник',
    })
    expect(v.safeParse(ConsumerNodeSchema, next[nodeId]).success).toBe(true)
  })

  it('refuses a consumer with no catalog type, naming the fix (FR-023)', () => {
    const { nodes } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    let thrown
    try {
      addNode(nodes, { parentId: 'root', kind: 'consumer', name: 'Лампа' })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RuleError)
    expect(thrown.code).toBe('typeRequired')
    expect(thrown.fix).toBeTypeOf('string')
  })

  it('refuses an empty or blank typeId the same way', () => {
    const { nodes } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    for (const typeId of ['', '   ', null]) {
      expect(() =>
        addNode(nodes, { parentId: 'root', kind: 'consumer', name: 'Лампа', typeId }),
      ).toThrow(RuleError)
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
      typeId: 'lamp',
      typeName: 'Світильник',
    })
    expect(depthOf(next, nodeId)).toBe(MAX_PANEL_DEPTH + 1)
  })
})

describe('treeOps.addNode guards the fields the schema requires', () => {
  it('refuses a consumer without a typeName (FR-034)', () => {
    const { nodes, rootId } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    expect(() =>
      addNode(nodes, { parentId: rootId, kind: 'consumer', name: 'Лампа', typeId: 'lamp' }),
    ).toThrow(RuleError)
  })

  it('records typeName on the node it creates (FR-034)', () => {
    const { nodes, rootId } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    const { nodes: next, nodeId } = addNode(nodes, {
      parentId: rootId,
      kind: 'consumer',
      name: 'Холодильник',
      typeId: 'fridge-16-20',
      typeName: 'Холодильник',
    })
    expect(next[nodeId].typeName).toBe('Холодильник')
  })

  it('refuses a blank name on any kind, which ProjectSchema would reject at save time', () => {
    const { nodes, rootId } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
    expect(() => addNode(nodes, { parentId: rootId, kind: 'panel', name: '' })).toThrow(RuleError)
    expect(() => addNode(nodes, { parentId: rootId, kind: 'panel', name: '   ' })).toThrow(RuleError)
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
  it('changes only the name', () => {
    const { nodes } = twoPanelsWithConsumers()
    const next = renameNode(nodes, 'p2', 'Кухня — розетки')
    expect(next.p2.name).toBe('Кухня — розетки')
    expect(next.p2.childIds).toEqual(nodes.p2.childIds)
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
                    typeId: 'lamp',
                    typeName: 'Світильник',
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
