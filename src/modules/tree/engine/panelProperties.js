// The project properties on the entry, and the value a panel shows for each of them. Plain data in,
// plain data out, as in treeOps: a change returns `produce(nodes, …)`, a refusal throws `RuleError`
// before anything changes.
//
// A panel inherits from the root whatever its depth (003/FR-008). The value it shows is derived on
// every read and never stored, so a change of a project property reaches every inheriting panel at
// once with no panel data touched (003/FR-007).
import { produce } from 'immer'
import * as v from 'valibot'
import { PROJECT_PROPERTY_SCHEMAS } from '@/schemas/index.js'
import { PROJECT_PROPERTIES } from '../config/properties.js'
import { RuleError } from './treeOps.js'

// What a number property must be, as a refusal names it (research R10).
const NUMBER_RULES = {
  moduleReservePct: 'число, не менше 0',
  maxLinesPerGroupRcd: 'ціле число, не менше 1',
}

function ruleOf(property) {
  if (property.kind === 'choice')
    return property.options.map((option) => option.label).join(' або ')
  if (property.kind === 'yesno') return 'так або ні'
  return NUMBER_RULES[property.key]
}

function requireProperty(key) {
  const property = PROJECT_PROPERTIES.find((p) => p.key === key)
  if (!property) {
    throw new RuleError({
      code: 'unknownProperty',
      message: `Властивості «${key}» у проекті немає.`,
    })
  }
  return property
}

/** @returns {unknown} `value`, once the property's schema accepts it */
function checkedValue(property, value) {
  const result = v.safeParse(PROJECT_PROPERTY_SCHEMAS[property.key], value)
  if (!result.success) {
    throw new RuleError({
      code: 'badProjectProperty',
      message: `${property.label}: тут має бути ${ruleOf(property)}, або порожньо.`,
    })
  }
  return result.output
}

/**
 * Sets or clears (`null`) one project property (003/FR-002). `value` is already parsed from the
 * editor's text.
 * @returns {object} nodes
 */
export function setProjectProperty(nodes, rootId, key, value) {
  const next = checkedValue(requireProperty(key), value)
  return produce(nodes, (draft) => {
    draft[rootId].projectProperties[key] = next
  })
}

/**
 * Gives a panel its own value of one property, or resets it with `null` so the panel inherits again
 * (003/FR-006). The value meets the project's rule; an own value equal to the project's stays own
 * (003/FR-007).
 * @returns {object} nodes
 */
export function setPanelOverride(nodes, panelId, key, value) {
  const next = checkedValue(requireProperty(key), value)
  return produce(nodes, (draft) => {
    draft[panelId].overrides[key] = next
  })
}

/** Marks one device of the panel's copy to install, or clears the mark (003/FR-010). */
export function setIncomingDeviceMark(nodes, panelId, deviceId, install) {
  return produce(nodes, (draft) => {
    draft[panelId].incomingDevices.find((device) => device.id === deviceId).install = install
  })
}

/** Marks one of the five accessories as bought separately for the panel, or clears it (003/FR-010). */
export function setBuySeparately(nodes, panelId, key, checked) {
  return produce(nodes, (draft) => {
    draft[panelId].buySeparately[key] = checked
  })
}

/** The panel's own value, or the root's while it has none (003/FR-005, 003/FR-008). */
export function effectiveProperty(nodes, rootId, panelId, key) {
  return nodes[panelId].overrides[key] ?? nodes[rootId].projectProperties[key]
}

/** True while the panel holds no value of its own for `key` (003/FR-004). */
export function isInherited(nodes, panelId, key) {
  return nodes[panelId].overrides[key] === null
}
