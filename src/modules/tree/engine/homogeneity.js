// The homogeneity rule (FR-013 … FR-018). One predicate, three call sites: the add path,
// `allowDrop` at phase 'drag' and `allowDrop` at phase 'drop'. Never fork it — that is what
// keeps the drag preview and the drop from disagreeing (FR-027).

/**
 * The children kind a parent has, derived from its current children rather than read from the
 * stored field. A parent that lost its last child is back to `undecided` (FR-018).
 * @returns {'undecided'|'panels'|'consumers'}
 */
export function childrenKindAfter(nodes, parentId) {
  const parent = nodes[parentId]
  if (!parent || !parent.childIds || parent.childIds.length === 0) return 'undecided'
  const firstChild = nodes[parent.childIds[0]]
  return firstChild?.kind === 'consumer' ? 'consumers' : 'panels'
}

/**
 * @param {'panel'|'consumer'|'entry'} childKind
 * @returns {{ ok: true } | { ok: false, code: string, message: string, fix?: object }}
 */
export function canAccept(nodes, parentId, childKind) {
  const parent = nodes[parentId]
  if (!parent) {
    return { ok: false, code: 'noSuchParent', message: `Вузла ${parentId} немає в проекті.` }
  }
  if (childKind === 'entry') {
    return {
      ok: false,
      code: 'rootProtected',
      message: 'Ввід у проекті лише один — його не можна ні додати, ні продублювати.',
    }
  }
  if (parent.kind === 'consumer') {
    return {
      ok: false,
      code: 'consumerIsLeaf',
      message: `«${parent.name}» — кінцевий споживач. Під ним не може бути ні щитка, ні іншого споживача.`,
    }
  }

  const current = childrenKindAfter(nodes, parentId)
  if (current === 'undecided') return { ok: true }

  const wanted = childKind === 'consumer' ? 'consumers' : 'panels'
  if (wanted === current) return { ok: true }

  if (current === 'panels') {
    return {
      ok: false,
      code: 'parentHoldsPanels',
      message:
        `«${parent.name}» уже містить щитки, а щиток не може одночасно тримати щитки й споживачів. ` +
        'Споживача можна покласти під один із цих щитків.',
      fix: {
        kind: 'placeUnderChildPanel',
        parentId,
        candidatePanelIds: [...parent.childIds],
      },
    }
  }

  return {
    ok: false,
    code: 'parentHoldsConsumers',
    message:
      `«${parent.name}» уже містить споживачів, а щиток не може одночасно тримати щитки й споживачів. ` +
      'Наявних споживачів можна перенести в новий підщиток.',
    fix: {
      kind: 'wrapConsumersInNewPanel',
      parentId,
      consumerIds: [...parent.childIds],
    },
  }
}
