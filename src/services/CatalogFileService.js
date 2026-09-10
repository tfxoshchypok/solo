// The built-in catalog: bundled and imported at build time, so it cannot fail at runtime and needs
// no network (FR-022). There is no second catalog file — custom types are not part of this feature.
//
// What it hands out is deeply frozen with immer's `freeze`, the same way the tree store freezes its
// node map: a plain `Object.freeze` only locks the outer object, and every field of a catalog is an
// array, so the shallow version would protect nothing.
import { freeze } from 'immer'
import builtinCatalog from '@/data/catalog.builtin.json'

export const CatalogFileService = {
  /** @returns {object} the bundled, read-only catalog */
  loadBuiltin() {
    return freeze(builtinCatalog, true)
  },
}
