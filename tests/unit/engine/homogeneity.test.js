import { describe, it, expect } from 'vitest'
import { canAccept, childrenKindAfter } from '@/modules/tree/engine/homogeneity.js'
import { addNode, moveNode, RuleError } from '@/modules/tree/engine/treeOps.js'
import { tree, consumer, loadTypeRow, zoneRow } from '../../fixtures/tree.js'
import fc from 'fast-check'

const emptyPanel = () =>
  tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [{ id: 'p1', kind: 'panel', name: 'Щиток', children: [] }],
  })

const panelHoldingPanels = () =>
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
          { id: 'p2', kind: 'panel', name: 'Кухня', children: [] },
          { id: 'p3', kind: 'panel', name: 'Спальня', children: [] },
        ],
      },
    ],
  })

const panelHoldingConsumers = () =>
  tree({
    id: 'root',
    kind: 'entry',
    name: 'Ввід',
    children: [
      {
        id: 'p1',
        kind: 'panel',
        name: 'Щиток',
        children: [consumer('c1'), consumer('c2'), consumer('c3')],
      },
    ],
  })

describe('homogeneity.childrenKindAfter', () => {
  it('reports undecided for a childless panel, which is a legal state (FR-005, FR-018)', () => {
    const { nodes } = emptyPanel()
    expect(childrenKindAfter(nodes, 'p1')).toBe('undecided')
  })

  it('reports panels once the panel holds panels (FR-013)', () => {
    const { nodes } = panelHoldingPanels()
    expect(childrenKindAfter(nodes, 'p1')).toBe('panels')
  })

  it('reports consumers once the panel holds consumers (FR-013)', () => {
    const { nodes } = panelHoldingConsumers()
    expect(childrenKindAfter(nodes, 'p1')).toBe('consumers')
  })

  it('returns to undecided when the last child leaves (FR-018)', () => {
    const { nodes } = panelHoldingConsumers()
    const emptied = { ...nodes, p1: { ...nodes.p1, childIds: [] } }
    expect(childrenKindAfter(emptied, 'p1')).toBe('undecided')
  })
})

describe('homogeneity.canAccept', () => {
  it('accepts either kind under an undecided panel (FR-005)', () => {
    const { nodes } = emptyPanel()
    expect(canAccept(nodes, 'p1', 'panel').ok).toBe(true)
    expect(canAccept(nodes, 'p1', 'consumer').ok).toBe(true)
  })

  it('applies the rule to the service entry exactly as to a panel (FR-014)', () => {
    const { nodes } = panelHoldingPanels()
    expect(canAccept(nodes, 'root', 'panel').ok).toBe(true)
    expect(canAccept(nodes, 'root', 'consumer').ok).toBe(false)
  })

  it('refuses a consumer under a panel that holds panels, and offers the child panels (FR-015, FR-017)', () => {
    const { nodes } = panelHoldingPanels()
    const verdict = canAccept(nodes, 'p1', 'consumer')
    expect(verdict.ok).toBe(false)
    expect(verdict.code).toBe('parentHoldsPanels')
    expect(verdict.message).toMatch(/щиток|панел/i)
    expect(verdict.fix).toEqual({
      kind: 'placeUnderChildPanel',
      parentId: 'p1',
      candidatePanelIds: ['p2', 'p3'],
    })
  })

  it('refuses a panel under a panel that holds consumers, and offers the wrap (FR-015, FR-016)', () => {
    const { nodes } = panelHoldingConsumers()
    const verdict = canAccept(nodes, 'p1', 'panel')
    expect(verdict.ok).toBe(false)
    expect(verdict.code).toBe('parentHoldsConsumers')
    expect(verdict.fix).toEqual({
      kind: 'wrapConsumersInNewPanel',
      parentId: 'p1',
      consumerIds: ['c1', 'c2', 'c3'],
    })
  })

  it('refuses any child under a consumer node (FR-004)', () => {
    const { nodes } = panelHoldingConsumers()
    for (const kind of ['panel', 'consumer']) {
      const verdict = canAccept(nodes, 'c1', kind)
      expect(verdict.ok).toBe(false)
      expect(verdict.code).toBe('consumerIsLeaf')
      expect(verdict.fix).toBeUndefined()
    }
  })
})

describe('homogeneity is the single predicate behind the add path', () => {
  it('addNode refuses the same case canAccept refuses, carrying the same fix', () => {
    const { nodes } = panelHoldingConsumers()
    const verdict = canAccept(nodes, 'p1', 'panel')
    let thrown
    try {
      addNode(nodes, { parentId: 'p1', kind: 'panel', name: 'Підщиток' })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RuleError)
    expect(thrown.code).toBe(verdict.code)
    expect(thrown.fix).toEqual(verdict.fix)
  })

  it('leaves the tree unchanged when it refuses', () => {
    const { nodes } = panelHoldingConsumers()
    const before = JSON.stringify(nodes)
    expect(() => addNode(nodes, { parentId: 'p1', kind: 'panel', name: 'Підщиток' })).toThrow(
      RuleError,
    )
    expect(JSON.stringify(nodes)).toBe(before)
  })
})

describe('property: no panel ever holds both child kinds (R10)', () => {
  it('holds over arbitrary sequences of addNode and moveNode', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            op: fc.constantFrom('addPanel', 'addConsumer', 'move'),
            parentPick: fc.nat({ max: 20 }),
            nodePick: fc.nat({ max: 20 }),
          }),
          { maxLength: 25 },
        ),
        (script) => {
          let { nodes } = tree({ id: 'root', kind: 'entry', name: 'Ввід', children: [] })
          for (const step of script) {
            const ids = Object.keys(nodes)
            const parentId = ids[step.parentPick % ids.length]
            const nodeId = ids[step.nodePick % ids.length]
            try {
              if (step.op === 'move') {
                nodes = moveNode(nodes, nodeId, parentId, 0)
              } else {
                nodes = addNode(nodes, {
                  parentId,
                  kind: step.op === 'addPanel' ? 'panel' : 'consumer',
                  name: 'x',
                  loadType: step.op === 'addConsumer' ? loadTypeRow() : undefined,
                  zone: step.op === 'addConsumer' ? zoneRow() : undefined,
                }).nodes
              }
            } catch (error) {
              if (!(error instanceof RuleError)) throw error
            }
          }
          for (const node of Object.values(nodes)) {
            const kinds = new Set(node.childIds.map((id) => nodes[id].kind))
            expect(kinds.size).toBeLessThanOrEqual(1)
            if (node.kind !== 'consumer') {
              expect(node.childrenKind).toBe(childrenKindAfter(nodes, node.id))
            }
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
