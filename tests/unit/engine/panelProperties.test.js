// The project properties on the entry and the values a panel inherits from them (003/FR-001 …
// 003/FR-008). The engine takes a value already parsed from the editor's text and checks it against
// the property's schema; the inspector only shows what it refuses.
import { describe, it, expect } from 'vitest'
import { freeze } from 'immer'
import {
  effectiveProperty,
  isInherited,
  setBuySeparately,
  setIncomingDeviceMark,
  setPanelOverride,
  setProjectProperty,
} from '@/modules/tree/engine/panelProperties.js'
import { RuleError } from '@/modules/tree/engine/treeOps.js'
import { tree, consumer, incomingDeviceRow } from '../../fixtures/tree.js'

/** The labels of data-model.md *Project properties*, which a refusal names. */
const LABELS = {
  supplyPhases: 'Фазність вводу',
  moduleReservePct: 'Резерв модулів, %',
  separateRcdMode: 'Виконання окремого ПЗВ',
  maxLinesPerGroupRcd: 'Макс. ліній на групове ПЗВ',
  neutralBreak: 'Розрив нейтралі',
  selectiveFeederRcd: 'Селективне ПЗВ на лінії живлення підщитка',
}
const OVERRIDABLE = Object.keys(LABELS).filter((key) => key !== 'supplyPhases')

/** Entry → panel → consumer, frozen as the store holds it. */
const project = (projectProperties = {}) =>
  freeze(
    tree({
      id: 'root',
      kind: 'entry',
      name: 'Ввід',
      projectProperties,
      children: [{ id: 'p1', kind: 'panel', name: 'Щиток', children: [consumer('c1')] }],
    }).nodes,
    true,
  )

function refusal(fn) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(RuleError)
    return error
  }
  return null
}

describe('setProjectProperty (003/FR-002)', () => {
  const VALID = {
    supplyPhases: [1, 3],
    moduleReservePct: [0, 20, 12.5],
    separateRcdMode: ['rcbo', 'mcbRcd'],
    maxLinesPerGroupRcd: [1, 4],
    neutralBreak: [true, false],
    selectiveFeederRcd: [true, false],
  }

  for (const [key, values] of Object.entries(VALID)) {
    it(`stores ${key} = ${values.join(', ')}, and null to clear it`, () => {
      let nodes = project()
      for (const value of values) {
        nodes = setProjectProperty(nodes, 'root', key, value)
        expect(nodes.root.projectProperties[key]).toBe(value)
      }
      nodes = setProjectProperty(nodes, 'root', key, null)
      expect(nodes.root.projectProperties[key]).toBeNull()
    })
  }

  const INVALID = [
    ['supplyPhases', 2],
    ['moduleReservePct', -5],
    ['maxLinesPerGroupRcd', 0],
    ['maxLinesPerGroupRcd', 2.5],
    ['separateRcdMode', 'x'],
    ['neutralBreak', 'так'],
  ]

  for (const [key, value] of INVALID) {
    it(`refuses ${key} = ${JSON.stringify(value)} with badProjectProperty, naming «${LABELS[key]}»`, () => {
      const error = refusal(() => setProjectProperty(project(), 'root', key, value))
      expect(error?.code).toBe('badProjectProperty')
      expect(error.message).toContain(LABELS[key])
    })
  }

  it('names the rule of the two numbers in the refusal (research R10)', () => {
    expect(
      refusal(() => setProjectProperty(project(), 'root', 'moduleReservePct', -5))?.message,
    ).toBe('Резерв модулів, %: тут має бути число, не менше 0, або порожньо.')
    expect(
      refusal(() => setProjectProperty(project(), 'root', 'maxLinesPerGroupRcd', 0))?.message,
    ).toBe('Макс. ліній на групове ПЗВ: тут має бути ціле число, не менше 1, або порожньо.')
  })

  it('refuses a key outside the six with unknownProperty', () => {
    expect(refusal(() => setProjectProperty(project(), 'root', 'colour', 1))?.code).toBe(
      'unknownProperty',
    )
  })

  it('changes the root alone, returns a frozen map and leaves its argument as it was', () => {
    const nodes = project()
    const next = setProjectProperty(nodes, 'root', 'moduleReservePct', 20)

    expect(next.root.projectProperties).toEqual({
      supplyPhases: null,
      moduleReservePct: 20,
      separateRcdMode: null,
      maxLinesPerGroupRcd: null,
      neutralBreak: null,
      selectiveFeederRcd: null,
    })
    expect(next.p1).toBe(nodes.p1)
    expect(next.c1).toBe(nodes.c1)
    expect(Object.isFrozen(next.root.projectProperties)).toBe(true)
    expect(nodes.root.projectProperties.moduleReservePct).toBeNull()
  })
})

describe('effectiveProperty / isInherited (003/FR-005, 003/FR-008)', () => {
  const PROJECT = {
    moduleReservePct: 20,
    separateRcdMode: 'rcbo',
    maxLinesPerGroupRcd: null,
    neutralBreak: true,
    selectiveFeederRcd: false,
  }

  it('gives a panel with no own values the root’s value for each overridable key, empty included', () => {
    const nodes = project(PROJECT)
    for (const key of OVERRIDABLE) {
      expect(effectiveProperty(nodes, 'root', 'p1', key), key).toBe(PROJECT[key])
      expect(isInherited(nodes, 'p1', key), key).toBe(true)
    }
  })

  it('gives a sub-panel three levels deep the root’s value', () => {
    const { nodes } = tree({
      id: 'root',
      kind: 'entry',
      name: 'Ввід',
      projectProperties: PROJECT,
      children: [
        {
          id: 'p1',
          kind: 'panel',
          name: 'Поверх',
          children: [
            {
              id: 'p2',
              kind: 'panel',
              name: 'Кімната',
              children: [{ id: 'p3', kind: 'panel', name: 'Шафа', children: [] }],
            },
          ],
        },
      ],
    })
    for (const key of OVERRIDABLE) {
      expect(effectiveProperty(nodes, 'root', 'p3', key), key).toBe(PROJECT[key])
      expect(isInherited(nodes, 'p3', key), key).toBe(true)
    }
  })
})

describe('setPanelOverride (003/FR-004, 003/FR-006, 003/FR-007, 003/FR-008)', () => {
  const PROJECT = {
    moduleReservePct: 20,
    separateRcdMode: 'rcbo',
    maxLinesPerGroupRcd: 4,
    neutralBreak: true,
    selectiveFeederRcd: true,
  }
  /** An own value of each overridable key, none of them the project's. The yes/no ones are an own
   * `false` against the project's `true`. */
  const OWN = {
    moduleReservePct: 40,
    separateRcdMode: 'mcbRcd',
    maxLinesPerGroupRcd: 2,
    neutralBreak: false,
    selectiveFeederRcd: false,
  }

  for (const key of OVERRIDABLE) {
    it(`gives the panel its own ${key}: effectiveProperty returns it and isInherited is false`, () => {
      const nodes = setPanelOverride(project(PROJECT), 'p1', key, OWN[key])

      expect(nodes.p1.overrides[key]).toBe(OWN[key])
      expect(effectiveProperty(nodes, 'root', 'p1', key)).toBe(OWN[key])
      expect(isInherited(nodes, 'p1', key)).toBe(false)
    })
  }

  const INVALID = [
    ['moduleReservePct', -5],
    ['maxLinesPerGroupRcd', 0],
    ['maxLinesPerGroupRcd', 2.5],
  ]

  for (const [key, value] of INVALID) {
    it(`refuses ${key} = ${JSON.stringify(value)} with the project’s badProjectProperty refusal`, () => {
      const error = refusal(() => setPanelOverride(project(), 'p1', key, value))
      expect(error?.code).toBe('badProjectProperty')
      expect(error.message).toBe(
        refusal(() => setProjectProperty(project(), 'root', key, value)).message,
      )
    })
  }

  it('resets with null: the panel inherits the root’s value again', () => {
    let nodes = setPanelOverride(project(PROJECT), 'p1', 'moduleReservePct', 40)
    nodes = setPanelOverride(nodes, 'p1', 'moduleReservePct', null)

    expect(nodes.p1.overrides.moduleReservePct).toBeNull()
    expect(effectiveProperty(nodes, 'root', 'p1', 'moduleReservePct')).toBe(20)
    expect(isInherited(nodes, 'p1', 'moduleReservePct')).toBe(true)
  })

  it('keeps an own value equal to the project’s after the project’s value changes (US2 scenario 4)', () => {
    let nodes = setPanelOverride(project(PROJECT), 'p1', 'moduleReservePct', 20)
    nodes = setProjectProperty(nodes, 'root', 'moduleReservePct', 25)

    expect(effectiveProperty(nodes, 'root', 'p1', 'moduleReservePct')).toBe(20)
    expect(isInherited(nodes, 'p1', 'moduleReservePct')).toBe(false)
  })

  it('gives a sub-panel under a parent with own values the root’s value (US2 scenario 5)', () => {
    let nodes = freeze(
      tree({
        id: 'root',
        kind: 'entry',
        name: 'Ввід',
        projectProperties: PROJECT,
        children: [
          {
            id: 'p1',
            kind: 'panel',
            name: 'Поверх',
            children: [{ id: 'p2', kind: 'panel', name: 'Кімната', children: [] }],
          },
        ],
      }).nodes,
      true,
    )
    for (const key of OVERRIDABLE) nodes = setPanelOverride(nodes, 'p1', key, OWN[key])

    for (const key of OVERRIDABLE) {
      expect(effectiveProperty(nodes, 'root', 'p2', key), key).toBe(PROJECT[key])
      expect(isInherited(nodes, 'p2', key), key).toBe(true)
    }
  })
})

describe('marks (003/FR-009, 003/FR-010)', () => {
  const RELAY = incomingDeviceRow({ id: 'iw-relay', name: 'Реле напруги' })
  const METER = incomingDeviceRow({ id: 'iw-meter', name: 'Лічильник', width1ph: 6, width3ph: 7 })
  const copies = () => [RELAY, METER].map((row) => ({ ...row, install: false }))
  const NOTHING_BOUGHT = {
    neutralBars: false,
    peBar: false,
    combBusbars: false,
    cableGlands: false,
    blankingPlates: false,
  }

  /** Entry → «Поверх 1» and «Поверх 2», each with its own copy of the same two device rows. On
   * «Поверх 1» «Реле напруги» is already to install and `bought` already bought separately, so a
   * change of another mark has a set neighbour to keep. */
  const floors = (bought = { peBar: true }) =>
    freeze(
      tree({
        id: 'root',
        kind: 'entry',
        name: 'Ввід',
        children: [
          {
            id: 'p1',
            kind: 'panel',
            name: 'Поверх 1',
            incomingDevices: [
              { ...RELAY, install: true },
              { ...METER, install: false },
            ],
            buySeparately: bought,
            children: [],
          },
          { id: 'p2', kind: 'panel', name: 'Поверх 2', incomingDevices: copies(), children: [] },
        ],
      }).nodes,
      true,
    )

  it('setIncomingDeviceMark sets and clears install of the one device with that id, keeping the other’s', () => {
    let nodes = setIncomingDeviceMark(floors(), 'p1', 'iw-meter', true)
    expect(nodes.p1.incomingDevices).toEqual([
      { ...RELAY, install: true },
      { ...METER, install: true },
    ])

    nodes = setIncomingDeviceMark(nodes, 'p1', 'iw-meter', false)
    expect(nodes.p1.incomingDevices).toEqual([
      { ...RELAY, install: true },
      { ...METER, install: false },
    ])
  })

  it('setBuySeparately sets and clears each of the five keys, keeping a key already bought', () => {
    for (const key of Object.keys(NOTHING_BOUGHT)) {
      const neighbour = key === 'peBar' ? 'neutralBars' : 'peBar'
      const start = { ...NOTHING_BOUGHT, [neighbour]: true }

      let nodes = setBuySeparately(floors({ [neighbour]: true }), 'p1', key, true)
      expect(nodes.p1.buySeparately, key).toEqual({ ...start, [key]: true })

      nodes = setBuySeparately(nodes, 'p1', key, false)
      expect(nodes.p1.buySeparately, key).toEqual(start)
    }
  })

  it('leaves every other panel unchanged', () => {
    const before = floors()
    let nodes = setIncomingDeviceMark(before, 'p1', 'iw-meter', true)
    nodes = setBuySeparately(nodes, 'p1', 'combBusbars', true)

    expect(nodes.p2).toBe(before.p2)
  })
})
