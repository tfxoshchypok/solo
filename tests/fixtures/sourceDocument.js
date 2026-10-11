// The source document of feature 002 — `specs/docs/002-spozhyvachi-dovidnyk-tz.md` — read as the
// oracle for the shipped reference tables. Cells come back as the raw text the document shows, so a
// test decides for itself how «так», «—» or «0.95» should look once stored.
import { readFileSync } from 'node:fs'

const SOURCE = 'specs/docs/002-spozhyvachi-dovidnyk-tz.md'

/** The one header the document writes as LaTeX; the application titles that column `cos φ`. */
const HEADER_ALIASES = { '$\\cos\\varphi$': 'cos φ' }

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim().replace(/^`|`$/g, ''))
}

/**
 * The first markdown table after the heading that starts with `heading`. A row such as
 * `` | `INVERTER_CHARGER`| Інвертор … `` has no space before its pipe, which `split('|')` does not mind.
 */
function tableAfter(heading) {
  const lines = readFileSync(SOURCE, 'utf8').split('\n')
  const start = lines.findIndex((line) => line.startsWith(heading))
  if (start === -1) throw new Error(`${SOURCE}: no heading "${heading}"`)

  const table = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim().startsWith('|')) table.push(line)
    else if (table.length > 0) break
  }

  const [header, , ...rows] = table
  return {
    headers: splitRow(header).map((h) => HEADER_ALIASES[h] ?? h),
    rows: rows.map(splitRow),
  }
}

/** §1 — `load_types`: 33 rows, `Код` first. */
export function loadTypesTable() {
  return tableAfter('## 1.')
}

/** §2 — `zones`: 8 rows, `Код` first. */
export function zonesTable() {
  return tableAfter('## 2.')
}
