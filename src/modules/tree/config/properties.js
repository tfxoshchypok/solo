// The six project properties, in the order of data-model.md *Project properties*: how the inspector
// labels each, how it is edited, and whether a panel may hold its own value (003/FR-001, 003/FR-004).
// The rules a value must meet are the schemas in `src/schemas/index.js`.

/**
 * @typedef {{
 *   key: string,
 *   label: string,
 *   kind: 'choice'|'number'|'yesno',
 *   options?: { label: string, value: number|string }[],
 *   overridable: boolean,
 * }} ProjectProperty
 */

/** @type {ProjectProperty[]} */
export const PROJECT_PROPERTIES = [
  {
    key: 'supplyPhases',
    label: 'Фазність вводу',
    kind: 'choice',
    options: [
      { label: '1ф', value: 1 },
      { label: '3ф', value: 3 },
    ],
    overridable: false,
  },
  { key: 'moduleReservePct', label: 'Резерв модулів, %', kind: 'number', overridable: true },
  {
    key: 'separateRcdMode',
    label: 'Виконання окремого ПЗВ',
    kind: 'choice',
    options: [
      { label: 'диф', value: 'rcbo' },
      { label: 'автомат + ПЗВ', value: 'mcbRcd' },
    ],
    overridable: true,
  },
  {
    key: 'maxLinesPerGroupRcd',
    label: 'Макс. ліній на групове ПЗВ',
    kind: 'number',
    overridable: true,
  },
  { key: 'neutralBreak', label: 'Розрив нейтралі', kind: 'yesno', overridable: true },
  {
    key: 'selectiveFeederRcd',
    label: 'Селективне ПЗВ на лінії живлення підщитка',
    kind: 'yesno',
    overridable: true,
  },
]

/** The five accessories a panel may mark «купувати окремо», in data-model.md order (003/FR-010). */
export const ACCESSORIES = [
  { key: 'neutralBars', label: 'N-шини' },
  { key: 'peBar', label: 'PE-шина' },
  { key: 'combBusbars', label: 'Гребінчасті шини' },
  { key: 'cableGlands', label: 'Кабельні вводи' },
  { key: 'blankingPlates', label: 'Заглушки' },
]

/** The labels of the «Розрахунок» fields, which stay empty until a calculation fills them (003/FR-011,
 * 003/FR-012). */
export const CALCULATED_LABELS = {
  enclosure: 'Корпус',
  deviceComposition: 'Склад апаратів',
  accessoryQuantities: 'Кількість комплектуючих',
  groupRcd: 'Групове ПЗВ',
  phase: 'Фаза',
}
