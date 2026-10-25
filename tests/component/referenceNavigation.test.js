// The shell with both sections: the menu offers «Дерево» and «Довідники», switching between them
// keeps the open project, the unsaved-changes prompt answers from either one, and a stored tables
// file that cannot be used is reported once at startup (002/FR-003, 002/FR-007, 002/FR-008; User
// Story 1, scenarios 7–8).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { NConfigProvider, NDialogProvider, NMessageProvider } from 'naive-ui'
import AppLayout from '@/components/AppLayout.vue'
import { TreeModule } from '@/modules/tree/index.js'
import { ReferenceModule } from '@/modules/reference/index.js'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useProjectStore } from '@/stores/project.js'
import { useReferenceTablesStore } from '@/modules/reference/stores/referenceTables.js'
import { ProjectFileService } from '@/services/ProjectFileService.js'
import {
  REFERENCE_TABLES_FILE,
  ReferenceTablesFileService,
} from '@/services/ReferenceTablesFileService.js'
import { appDataDir, join } from '@/services/PathService.js'
import { setFs, MemoryFs } from '@/services/fs/index.js'

/**
 * The window-close registry, mirrored so the test can call whatever decision is registered right
 * now — exactly what the real `windowClose` handler would call.
 */
const exit = vi.hoisted(() => ({ decision: null }))
vi.mock('@/services/closeGuard.js', async (importOriginal) => ({
  ...(await importOriginal()),
  setExitDecision(decide) {
    exit.decision = decide
    return () => {
      if (exit.decision === decide) exit.decision = null
    }
  },
}))

let wrapper = null
let router = null
let fs = null

beforeEach(() => {
  setActivePinia(createPinia())
  fs = new MemoryFs({ dataDir: '/memfs/data' })
  setFs(fs)
  exit.decision = null
})

afterEach(async () => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  ProjectFileService.cancelAutosave()
  await ReferenceTablesFileService.flush().catch(() => {})
  setFs(null)
})

async function mountShell() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', redirect: '/tree' }],
  })
  TreeModule.install(null, { router })
  ReferenceModule.install(null, { router })

  const Harness = defineComponent({
    setup() {
      return () =>
        h(NConfigProvider, null, {
          default: () =>
            h(NDialogProvider, null, {
              default: () =>
                h(NMessageProvider, null, {
                  default: () => h(AppLayout, null, { default: () => h(RouterView) }),
                }),
            }),
        })
    },
  })
  wrapper = mount(Harness, { attachTo: document.body, global: { plugins: [router] } })
  await router.push('/tree')
  await router.isReady()
  await flushPromises()
}

async function go(path) {
  await router.push(path)
  await flushPromises()
}

const bodyText = () => document.body.textContent

describe('the menu offers both sections (002/FR-003)', () => {
  it('shows «Дерево» and «Довідники»', async () => {
    await mountShell()
    const menu = wrapper.find('.n-menu').text()
    expect(menu).toContain('Дерево')
    expect(menu).toContain('Довідники')
  })

  it('opens the reference tables at /reference', async () => {
    await mountShell()
    await go('/reference')
    expect(router.currentRoute.value.name).toBe('reference')
    expect(bodyText()).toContain('Типи навантажень')
    expect(bodyText()).toContain('Зони')
  })
})

describe('switching sections keeps the open project (002/FR-008; scenario 7)', () => {
  it('keeps an unsaved change through «Дерево» → «Довідники» → «Дерево»', async () => {
    await mountShell()
    const tree = useTreeStore()
    const project = useProjectStore()
    const kitchen = tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    expect(project.isDirty).toBe(true)

    await go('/reference')
    await go('/tree')

    expect(project.isDirty).toBe(true)
    expect(tree.nodes[kitchen].name).toBe('Кухня')
  })

  it('asks about unsaved changes when the window closes from «Довідники»', async () => {
    await mountShell()
    const tree = useTreeStore()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    await go('/reference')

    expect(exit.decision).toBeTypeOf('function')
    const verdict = exit.decision()
    await flushPromises()
    expect(bodyText()).toContain('Зберегти зміни перед закриттям?')

    const cancel = [...document.body.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Скасувати'),
    )
    cancel.click()
    await expect(verdict).resolves.toBe(false)
  })
})

describe('a stored tables file that cannot be used, at startup (002/FR-007; scenario 8)', () => {
  it('reports it once, names the element and the kept copy, and shows the shipped rows', async () => {
    const broken = structuredClone(ReferenceTablesFileService.loadBuiltin())
    broken.zones[5].name = broken.zones[1].name
    const dir = await appDataDir()
    await fs.ensureDir(dir)
    await fs.writeText(
      join(dir, REFERENCE_TABLES_FILE),
      JSON.stringify({ schemaVersion: 1, ...broken }),
    )

    await mountShell()
    await flushPromises()

    const text = bodyText()
    expect(text.split('Довідники не прочитались').length - 1).toBe(1)
    expect(text).toContain('zones[5].name')
    expect(text).toContain('reference-tables.refused-')
    expect(useReferenceTablesStore().tables).toEqual(ReferenceTablesFileService.loadBuiltin())

    await go('/reference')
    const zonesTab = [...document.body.querySelectorAll('.n-tabs-tab')].find((tab) =>
      tab.textContent.includes('Зони'),
    )
    zonesTab.click()
    await flushPromises()
    const names = [...document.body.querySelectorAll('input[data-cell="name"]')].map((i) => i.value)
    expect(names).toEqual(ReferenceTablesFileService.loadBuiltin().zones.map((zone) => zone.name))
  })
})

describe('the section shows the five tables (003/FR-013)', () => {
  /** Each tab's title, and the header of its table's first column. */
  const TABS = [
    ['Типи навантажень', 'Назва типу'],
    ['Зони', 'Назва зони'],
    ['Типорозміри корпусів', 'Модульність ряду'],
    ['Ширина за полюсністю', 'Полюсність'],
    ['Ввідні апарати', 'Апарат'],
  ]
  const tab = (title) => wrapper.findAll('.n-tabs-tab').find((t) => t.text().trim() === title)
  const firstHeader = () =>
    wrapper
      .findAll('.n-tab-pane thead th')
      .map((th) => th.text().trim())
      .find(Boolean)

  it('offers five tabs, and each shows its table', async () => {
    await mountShell()
    await go('/reference')

    expect(wrapper.findAll('.n-tabs-tab').map((t) => t.text().trim())).toEqual(
      TABS.map(([title]) => title),
    )
    for (const [title, header] of TABS) {
      await tab(title).trigger('click')
      await flushPromises()
      expect(firstHeader(), title).toBe(header)
    }
  })
})
