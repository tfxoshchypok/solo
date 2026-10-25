// The columns of every reference table. The load types and the zones follow the source document's
// order and headers (`specs/docs/002-spozhyvachi-dovidnyk-tz.md` §1, §2). The document's code
// column is not here: a row's generated id replaces it and is never shown (002/FR-005).
//
// `kind` decides how a cell is edited and parsed: `name` and `text` are text, `number` accepts a
// decimal with a dot or a comma, `yesno` is «так» / «ні» / empty (data-model.md). `count` is a whole
// number ≥ 1 and `positive` a number > 0, both read like `number` (003 research R7).

/**
 * @typedef {{
 *   key: string,
 *   header: string,
 *   kind: 'name'|'text'|'number'|'yesno'|'count'|'positive',
 * }} Column
 */

/** @type {Record<string, Column[]>} keyed by the names of `REFERENCE_TABLES`, in its order */
export const columns = {
  loadTypes: [
    { key: 'name', header: 'Назва типу', kind: 'name' },
    { key: 'ratedPowerKw', header: 'P, кВт', kind: 'number' },
    { key: 'phases', header: 'Фазність', kind: 'text' },
    { key: 'breakerCurve', header: 'Хар-ка АВ', kind: 'text' },
    { key: 'continuous', header: 'Тривалий', kind: 'yesno' },
    { key: 'powerFactor', header: 'cos φ', kind: 'number' },
    { key: 'demandFactor', header: 'Кп', kind: 'number' },
    { key: 'rcdType', header: 'Тип ПЗВ', kind: 'text' },
  ],
  zones: [
    { key: 'name', header: 'Назва зони', kind: 'name' },
    { key: 'rcdRequired', header: "ПЗВ обов'язкове", kind: 'yesno' },
    { key: 'leakageMa', header: 'Уставка витоку, мА', kind: 'number' },
    { key: 'minIp', header: 'Мін. IP', kind: 'text' },
    { key: 'separateRcd', header: 'Окреме ПЗВ', kind: 'yesno' },
    { key: 'purpose', header: 'Призначення та нормативні межі', kind: 'text' },
  ],
  // The three tables of feature 003 (003/FR-013), under the headers of the spec's *Reference Table
  // Columns*. An enclosure size has no name column (003/FR-015).
  enclosureSizes: [
    { key: 'rowModularity', header: 'Модульність ряду', kind: 'count' },
    { key: 'rowCount', header: 'Кількість рядів', kind: 'count' },
  ],
  deviceWidths: [
    { key: 'name', header: 'Полюсність', kind: 'name' },
    { key: 'widthModules', header: 'Модулів', kind: 'positive' },
  ],
  incomingDevices: [
    { key: 'name', header: 'Апарат', kind: 'name' },
    { key: 'width1ph', header: '1ф', kind: 'positive' },
    { key: 'width3ph', header: '3ф', kind: 'positive' },
  ],
}

/** The tab titles of the «Довідники» section. */
export const tableTitles = {
  loadTypes: 'Типи навантажень',
  zones: 'Зони',
  enclosureSizes: 'Типорозміри корпусів',
  deviceWidths: 'Ширина за полюсністю',
  incomingDevices: 'Ввідні апарати',
}

/** @returns {Column|undefined} */
export function columnOf(table, key) {
  return columns[table]?.find((column) => column.key === key)
}
