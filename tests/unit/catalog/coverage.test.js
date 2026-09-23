import { describe, it, expect } from 'vitest'
import * as v from 'valibot'
import { CatalogSchema } from '@/schemas/index.js'
import catalog from '@/data/catalog.builtin.json'

/**
 * The representative types the spec's *Catalog Scope* table names, keyed by the English word that
 * has to appear in some type's `nameEn`. A consumer cannot be created without a type, so a gap
 * here is not an inconvenience — it is an appliance the user simply cannot enter (SC-003).
 */
const REPRESENTATIVE = [
  'refrigerator',
  'freezer',
  'induction hob',
  'oven',
  'microwave',
  'dishwasher',
  'kettle',
  'coffee',
  'extractor hood',
  'food waste',
  'washing machine',
  'tumble dryer',
  'washer-dryer',
  'iron',
  'storage water heater',
  'instantaneous water heater',
  'heat-pump water heater',
  'convector',
  'underfloor',
  'heat pump',
  'air conditioner',
  'towel rail',
  'fan',
  'downlight',
  'strip',
  'incandescent',
  'halogen',
  'outdoor',
  'television',
  'set-top box',
  'game console',
  'receiver',
  'projector',
  'desktop',
  'gaming computer',
  'laptop',
  'monitor',
  'printer',
  'router',
  'network',
  'well pump',
  'circulation pump',
  'booster pump',
  'sump pump',
  'ventilation',
  'drill',
  'circular saw',
  'grinder',
  'compressor',
  'lawn mower',
  'hedge trimmer',
  'charger',
  'socket group',
  'vacuum',
  'hair dryer',
  'dehumidifier',
  'humidifier',
]

const names = catalog.types.map((t) => t.nameEn.toLowerCase())
const covered = (word) => names.some((n) => n.includes(word))

describe('the shipped catalog covers the residential case (FR-019, SC-003)', () => {
  it('ships at least 80 types', () => {
    expect(catalog.types.length).toBeGreaterThanOrEqual(80)
  })

  it('leaves no category empty — an empty one is a browse path that dead-ends (FR-021)', () => {
    for (const category of catalog.categories) {
      const count = catalog.types.filter((t) => t.categoryId === category.id).length
      expect(count, `категорія «${category.name}» порожня`).toBeGreaterThan(0)
    }
  })

  it('resolves at least 90% of the representative types from the spec', () => {
    const missing = REPRESENTATIVE.filter((word) => !covered(word))
    const rate = 1 - missing.length / REPRESENTATIVE.length
    expect(rate, `не покрито: ${missing.join(', ')}`).toBeGreaterThanOrEqual(0.9)
  })

  it('validates against its own schema, so a broken bundle fails the build not the user', () => {
    const result = v.safeParse(CatalogSchema, catalog)
    expect(result.success, JSON.stringify(result.issues?.slice(0, 3))).toBe(true)
  })

  it('has unique ids and resolvable categories', () => {
    const ids = catalog.types.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    const categoryIds = new Set(catalog.categories.map((c) => c.id))
    for (const type of catalog.types) expect(categoryIds.has(type.categoryId)).toBe(true)
  })
})
