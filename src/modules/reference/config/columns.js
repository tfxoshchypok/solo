// The columns of both reference tables, in the source document's order and under its headers
// (`specs/docs/002-spozhyvachi-dovidnyk-tz.md` §1, §2). The document's code column is not here: a
// row's generated id replaces it and is never shown (002/FR-005).
//
// `kind` decides how a cell is edited and parsed: `name` and `text` are text, `number` accepts a
// decimal with a dot or a comma, `yesno` is «так» / «ні» / empty (data-model.md).

/** @typedef {{ key: string, header: string, kind: 'name'|'text'|'number'|'yesno' }} Column */

/** @type {{ loadTypes: Column[], zones: Column[] }} */
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
}

/** The tab titles of the «Довідники» section. */
export const tableTitles = {
  loadTypes: 'Типи навантажень',
  zones: 'Зони',
}

/** @returns {Column|undefined} */
export function columnOf(table, key) {
  return columns[table]?.find((column) => column.key === key)
}
