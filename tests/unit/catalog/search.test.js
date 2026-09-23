import { describe, it, expect } from 'vitest'
import { buildIndex, search } from '@/modules/tree/stores/catalog.js'
import catalog from '@/data/catalog.builtin.json'

const index = buildIndex(catalog.types, catalog.categories)
const ids = (query, categoryId) => search(index, query, categoryId).map((t) => t.id)

describe('catalog search finds a type in either language (FR-021, SC-004)', () => {
  it('answers the same row for the Ukrainian and the English name', () => {
    expect(ids('холод')[0]).toBe('fridge')
    expect(ids('fridge')[0]).toBe('fridge')
  })

  it('tolerates a typo, which a substring match cannot', () => {
    expect(ids('телевізр')).toContain('television')
  })

  it('matches on a fragment rather than requiring the whole word', () => {
    expect(ids('пилос')).toContain('vacuum-cleaner')
  })

  it('filters by category, so browsing narrows instead of searching again', () => {
    const kitchenOnly = search(index, '', 'kitchen')
    expect(kitchenOnly.length).toBeGreaterThan(0)
    expect(kitchenOnly.every((t) => t.categoryId === 'kitchen')).toBe(true)
  })

  it('an empty query with no category lists everything, so the dialog opens full', () => {
    expect(search(index, '').length).toBe(catalog.types.length)
  })

  it('combines a query with a category filter', () => {
    const found = search(index, 'насос', 'pumps')
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((t) => t.categoryId === 'pumps')).toBe(true)
  })

  it('answers nothing for a query that matches nothing, rather than everything', () => {
    expect(search(index, 'zzzqqq')).toEqual([])
  })
})
