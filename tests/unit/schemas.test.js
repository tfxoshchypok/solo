import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import {
  ProjectSchema,
  NodeSchema,
  LoadTypeSchema,
  ZoneSchema,
  ReferenceTablesSchema,
  SCHEMA_VERSION,
  formatIssuePath,
} from '@/schemas/index.js'

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
// Feature 002 — the rows of the two reference tables (data-model.md). An empty cell is `null`, never
// absent and never '', so every row carries every key.
const loadTypeRow = (over = {}) => ({
  id: 'lt-6d0f8a52-1c3e-4b7a-9f21-0e5b7c4d2a19',
  name: 'Варильна поверхня',
  ratedPowerKw: null,
  phases: null,
  breakerCurve: null,
  continuous: null,
  powerFactor: null,
  demandFactor: null,
  rcdType: null,
  ...over,
})
const zoneRow = (over = {}) => ({
  id: 'zn-2b91c7e4-5a60-4f3d-8e12-7c9a0b6d4f38',
  name: 'Критична безперервна лінія',
  rcdRequired: null,
  leakageMa: null,
  minIp: null,
  separateRcd: null,
  purpose: null,
  ...over,
})
// A consumer holds whole copies of the rows it was given (002/FR-010).
const consumerNode = (over = {}) => ({
  id: 'n-1',
  kind: 'consumer',
  name: 'Холодильник',
  parentId: 'n-root',
  childIds: [],
  loadType: loadTypeRow(),
  zone: zoneRow(),
  cableSectionMm2: null,
  ...over,
})

const project = (over = {}) => ({
  schemaVersion: SCHEMA_VERSION,
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

  it('accepts an optional note on the entry and on a panel (FR-012)', () => {
    expect(v.safeParse(NodeSchema, { ...entry, note: 'лічильник у під’їзді' }).output.note).toBe(
      'лічильник у під’їзді',
    )
    expect(v.safeParse(NodeSchema, { ...panel, note: 'другий поверх' }).output.note).toBe(
      'другий поверх',
    )
  })
})

describe('NodeSchema — the consumer is exactly its field list (002/FR-009, 002/FR-010, 002/FR-011)', () => {
  it('accepts a consumer with an empty or a positive cable section', () => {
    for (const cableSectionMm2 of [null, 2.5]) {
      const result = v.safeParse(NodeSchema, consumerNode({ cableSectionMm2 }))
      expect(result.success).toBe(true)
      expect(result.output.cableSectionMm2).toBe(cableSectionMm2)
    }
  })

  it('keeps the load type and the zone as whole copies of their rows', () => {
    const result = v.safeParse(NodeSchema, consumerNode())
    expect(result.success).toBe(true)
    expect(result.output.loadType).toEqual(loadTypeRow())
    expect(result.output.zone).toEqual(zoneRow())
  })

  it('refuses a consumer whose load type or zone is missing, or a copy without its id', () => {
    for (const key of ['loadType', 'zone']) {
      const without = consumerNode()
      delete without[key]
      expect(v.safeParse(NodeSchema, without).success, `${key} missing`).toBe(false)
    }
    expect(
      v.safeParse(NodeSchema, consumerNode({ loadType: loadTypeRow({ id: '' }) })).success,
    ).toBe(false)
    expect(v.safeParse(NodeSchema, consumerNode({ zone: zoneRow({ id: '' }) })).success).toBe(false)
  })

  it('refuses a copied value its row’s column would refuse', () => {
    for (const over of [
      { loadType: loadTypeRow({ powerFactor: '0.95' }) },
      { loadType: loadTypeRow({ name: '' }) },
      { zone: zoneRow({ separateRcd: 'ні' }) },
      { zone: zoneRow({ leakageMa: 'abc' }) },
    ]) {
      expect(v.safeParse(NodeSchema, consumerNode(over)).success, JSON.stringify(over)).toBe(false)
    }
  })

  it('refuses a consumer without the cableSectionMm2 key, because empty is null and never absent', () => {
    const { cableSectionMm2, ...without } = consumerNode()
    expect(cableSectionMm2).toBeNull()
    expect(v.safeParse(NodeSchema, without).success).toBe(false)
  })

  it('refuses a cable section of 0, below 0, or written as text', () => {
    for (const cableSectionMm2 of [0, -1, '2.5']) {
      expect(v.safeParse(NodeSchema, consumerNode({ cableSectionMm2 })).success).toBe(false)
    }
  })

  it('drops note, typeId, typeName, quantity and bare ids from a consumer (SC-006)', () => {
    const result = v.safeParse(
      NodeSchema,
      consumerNode({
        note: 'узгодити',
        typeId: 'fridge',
        typeName: 'Холодильник',
        quantity: 1,
        loadTypeId: 'lt-test',
        zoneId: 'zn-test',
      }),
    )
    expect(result.success).toBe(true)
    expect(Object.keys(result.output).sort()).toEqual(
      ['childIds', 'id', 'kind', 'name', 'parentId', 'loadType', 'zone', 'cableSectionMm2'].sort(),
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

  it('accepts a project with no catalogVersion and drops one that is there (002/FR-016)', () => {
    expect(v.safeParse(ProjectSchema, project()).success).toBe(true)
    const result = v.safeParse(ProjectSchema, project({ catalogVersion: '2026.09.1' }))
    expect(result.success).toBe(true)
    expect(result.output).not.toHaveProperty('catalogVersion')
  })
})

describe('formatIssuePath names the failing element (FR-036)', () => {
  it('renders an array step as [n] and an object step as .key', () => {
    const nodes = [entry]
    for (let i = 1; i <= 42; i += 1) {
      const zone = i === 42 ? zoneRow({ leakageMa: 'abc' }) : zoneRow()
      nodes.push(consumerNode({ id: `n-${i}`, zone }))
    }
    const result = v.safeParse(ProjectSchema, project({ nodes }))
    expect(result.success).toBe(false)
    const paths = result.issues.map(formatIssuePath)
    expect(paths).toEqual(['nodes[42].zone.leakageMa'])
  })

  it('renders a top-level field as its bare name', () => {
    const result = v.safeParse(ProjectSchema, project({ name: '' }))
    expect(result.issues.map(formatIssuePath)).toContain('name')
  })
})

const referenceTables = (over = {}) => ({
  schemaVersion: 1,
  loadTypes: [loadTypeRow()],
  zones: [zoneRow()],
  ...over,
})

describe('ReferenceTablesSchema — the rows of both tables (002/FR-005, 002/FR-006)', () => {
  it('accepts rows whose every cell but id and name is empty', () => {
    expect(v.safeParse(LoadTypeSchema, loadTypeRow()).success).toBe(true)
    expect(v.safeParse(ZoneSchema, zoneRow()).success).toBe(true)
    expect(v.safeParse(ReferenceTablesSchema, referenceTables()).success).toBe(true)
  })

  it('accepts filled rows in the source document’s value kinds', () => {
    const hob = loadTypeRow({
      ratedPowerKw: 7.4,
      phases: '1ф або 2ф',
      breakerCurve: 'C/D',
      continuous: false,
      powerFactor: 0.98,
      demandFactor: 0.65,
      rcdType: 'A',
    })
    const kitchen = zoneRow({
      rcdRequired: true,
      leakageMa: 30,
      minIp: 'IP20 / IP44',
      separateRcd: false,
      purpose: 'Робочі поверхні кухонь, зона біля кухонної мийки',
    })
    expect(v.safeParse(LoadTypeSchema, hob).success).toBe(true)
    expect(v.safeParse(ZoneSchema, kitchen).success).toBe(true)
  })

  it('refuses a row with a key missing, because empty is null and never absent', () => {
    const { phases, ...withoutPhases } = loadTypeRow()
    expect(phases).toBeNull()
    expect(v.safeParse(LoadTypeSchema, withoutPhases).success).toBe(false)
  })

  it('refuses an empty name and a name longer than 120 characters', () => {
    expect(v.safeParse(LoadTypeSchema, loadTypeRow({ name: '' })).success).toBe(false)
    expect(v.safeParse(ZoneSchema, zoneRow({ name: 'я'.repeat(121) })).success).toBe(false)
  })

  it('refuses text in a number column and «так» in a yes/no column', () => {
    expect(v.safeParse(LoadTypeSchema, loadTypeRow({ powerFactor: '0.95' })).success).toBe(false)
    expect(v.safeParse(LoadTypeSchema, loadTypeRow({ continuous: 'так' })).success).toBe(false)
    expect(v.safeParse(ZoneSchema, zoneRow({ leakageMa: '30' })).success).toBe(false)
  })

  it('refuses a text cell longer than 2000 characters', () => {
    expect(v.safeParse(ZoneSchema, zoneRow({ purpose: 'а'.repeat(2001) })).success).toBe(false)
  })

  it('refuses a file of another schemaVersion', () => {
    expect(v.safeParse(ReferenceTablesSchema, referenceTables({ schemaVersion: 2 })).success).toBe(
      false,
    )
  })

  it('drops a key the schema does not name, such as the source document’s code', () => {
    const result = v.safeParse(LoadTypeSchema, loadTypeRow({ code: 'HOB' }))
    expect(result.success).toBe(true)
    expect(result.output).not.toHaveProperty('code')
  })
})
