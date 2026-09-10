import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  ProjectSchema,
  NodeSchema,
  ConsumerTypeSchema,
  SCHEMA_VERSION,
  formatIssuePath,
} from '@/schemas/index.js'
import builtinCatalog from '@/data/catalog.builtin.json'

const entry = {
  id: 'n-root',
  kind: 'entry',
  name: 'Ввід',
  parentId: null,
  childIds: ['n-1'],
  childrenKind: 'consumers',
}
const panel = {
  id: 'n-9',
  kind: 'panel',
  name: 'Освітлення',
  parentId: 'n-root',
  childIds: [],
  childrenKind: 'undecided',
}
const consumerNode = (over = {}) => ({
  id: 'n-1',
  kind: 'consumer',
  name: 'Холодильник',
  parentId: 'n-root',
  childIds: [],
  typeId: 'fridge-16-20',
  typeName: 'Холодильник',
  quantity: 1,
  ...over,
})

const project = (over = {}) => ({
  schemaVersion: SCHEMA_VERSION,
  catalogVersion: '2026.09.1',
  name: 'Квартира на Лесі Українки',
  createdAt: '2026-09-07T10:14:02.000Z',
  modifiedAt: '2026-09-07T11:02:41.000Z',
  rootId: 'n-root',
  nodes: [entry, consumerNode()],
  ...over,
})

describe('NodeSchema — the three kinds and their per-kind fields (FR-003)', () => {
  it('accepts each kind in its own shape', () => {
    for (const node of [entry, panel, consumerNode()]) {
      expect(v.safeParse(NodeSchema, node).success).toBe(true)
    }
  })

  it('refuses a fourth kind', () => {
    expect(v.safeParse(NodeSchema, { ...panel, kind: 'busbar' }).success).toBe(false)
  })

  it('refuses children on a consumer (FR-004)', () => {
    expect(v.safeParse(NodeSchema, consumerNode({ childIds: ['n-2'] })).success).toBe(false)
  })

  it('refuses a consumer without typeName, which keeps the file readable (FR-034)', () => {
    const { typeName, ...withoutTypeName } = consumerNode()
    expect(typeName).toBe('Холодильник')
    expect(v.safeParse(NodeSchema, withoutTypeName).success).toBe(false)
    expect(v.safeParse(NodeSchema, consumerNode({ typeName: '' })).success).toBe(false)
  })

  it('refuses a quantity below 1 (FR-025)', () => {
    expect(v.safeParse(NodeSchema, consumerNode({ quantity: 0 })).success).toBe(false)
  })

  it('accepts an optional note on any kind (FR-012)', () => {
    expect(v.safeParse(NodeSchema, { ...panel, note: 'другий поверх' }).success).toBe(true)
    expect(v.safeParse(NodeSchema, consumerNode({ note: 'узгодити з замовником' })).success).toBe(
      true,
    )
  })
})

describe('ProjectSchema', () => {
  it('accepts the shape from contracts/project-file.md', () => {
    const result = v.safeParse(ProjectSchema, project())
    expect(result.success).toBe(true)
  })

  it('refuses a project with no name', () => {
    expect(v.safeParse(ProjectSchema, project({ name: '' })).success).toBe(false)
  })

  it('refuses a project without a catalogVersion (contracts/project-file.md)', () => {
    const { catalogVersion, ...withoutCatalogVersion } = project()
    expect(catalogVersion).toBe('2026.09.1')
    expect(v.safeParse(ProjectSchema, withoutCatalogVersion).success).toBe(false)
  })
})

describe('formatIssuePath names the failing element (FR-036)', () => {
  it('renders an array step as [n] and an object step as .key', () => {
    const nodes = [entry]
    for (let i = 1; i <= 42; i += 1) {
      nodes.push(consumerNode({ id: `n-${i}`, quantity: i === 42 ? '3' : 1 }))
    }
    const result = v.safeParse(ProjectSchema, project({ nodes }))
    expect(result.success).toBe(false)
    const paths = result.issues.map(formatIssuePath)
    expect(paths).toContain('nodes[42].quantity')
  })

  it('renders a top-level field as its bare name', () => {
    const result = v.safeParse(ProjectSchema, project({ name: '' }))
    expect(result.issues.map(formatIssuePath)).toContain('name')
  })
})

describe('ConsumerTypeSchema', () => {
  it('accepts every type in the shipped built-in catalog', () => {
    for (const type of builtinCatalog.types) {
      const result = v.safeParse(ConsumerTypeSchema, type)
      if (!result.success) {
        throw new Error(
          `${type.id}: ${result.issues.map((i) => `${formatIssuePath(i)} ${i.message}`).join('; ')}`,
        )
      }
      expect(result.success).toBe(true)
    }
  })

  it('refuses a type whose category does not resolve in the same file (contracts/catalog.md)', () => {
    const ids = new Set(builtinCatalog.categories.map((c) => c.id))
    for (const type of builtinCatalog.types) expect(ids.has(type.categoryId)).toBe(true)
  })

  it('refuses a blank English name, which the search index needs (FR-021)', () => {
    const type = builtinCatalog.types[0]
    expect(v.safeParse(ConsumerTypeSchema, { ...type, nameEn: '' }).success).toBe(false)
  })
})
