// A project that never had a file, lost to a crash: on the next launch the shell offers its copy
// once, and the question can only be answered, not dismissed (RECOVERY-01).
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
import { ProjectFileService } from '@/services/ProjectFileService.js'
import { ReferenceTablesFileService } from '@/services/ReferenceTablesFileService.js'
import { setFs, MemoryFs } from '@/services/fs/index.js'
import { CRASHED_NAME, leaveCrashCopy } from '../fixtures/crashCopy.js'

const QUESTION = 'Відновити незбережений проект?'

let wrapper = null
let router = null
let fs = null

beforeEach(() => {
  setActivePinia(createPinia())
  fs = new MemoryFs({ dataDir: '/memfs/data' })
  setFs(fs)
})

afterEach(async () => {
  vi.restoreAllMocks()
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  ProjectFileService.cancelAutosave()
  await ProjectFileService.autosaveSettled()
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
const timesAsked = () => bodyText().split(QUESTION).length - 1
const button = (label) =>
  [...document.body.querySelectorAll('.n-dialog button')].find((b) => b.textContent.includes(label))

async function answer(label) {
  button(label).click()
  await flushPromises()
  await ProjectFileService.autosaveSettled()
}

describe('the startup offer (RECOVERY-01)', () => {
  it('asks once about a valid copy, with its two buttons and no close icon', async () => {
    await leaveCrashCopy()
    await mountShell()

    expect(timesAsked()).toBe(1)
    expect(bodyText()).toContain(CRASHED_NAME)
    expect(button('Відновити')).toBeDefined()
    expect(button('Відкинути копію')).toBeDefined()
    expect(document.body.querySelector('.n-dialog .n-base-close')).toBeNull()
  })

  it('stays quiet when there is no copy', async () => {
    await mountShell()

    expect(timesAsked()).toBe(0)
    expect(document.body.querySelector('.n-dialog')).toBeNull()
  })

  it('«Відновити» opens the copy as a project without a file, with unsaved changes', async () => {
    await leaveCrashCopy()
    await mountShell()

    await answer('Відновити')

    const project = useProjectStore()
    expect(project.path).toBe(null)
    expect(project.isDirty).toBe(true)
    expect(Object.values(useTreeStore().nodes).map((node) => node.name)).toContain('Верстати')
    expect(wrapper.find('.app-title').text()).toBe(`${CRASHED_NAME} •`)
  })

  it('«Відкинути копію» removes the copy and leaves the new empty project', async () => {
    const { sidecarPath } = await leaveCrashCopy()
    await mountShell()

    await answer('Відкинути копію')

    expect(await fs.exists(sidecarPath)).toBe(false)
    expect(useTreeStore().nodeCount).toBe(1)
  })

  it('does not ask again on «Дерево» → «Довідники» → «Дерево»', async () => {
    await leaveCrashCopy()
    await mountShell()
    await answer('Відновити')

    await go('/reference')
    await go('/tree')

    // happy-dom never finishes the dialog's leave transition, so the answered one is still in the
    // DOM; a second question would add another.
    expect(timesAsked()).toBe(1)
  })
})

describe('a copy the startup check cannot use (RECOVERY-01)', () => {
  it('reports a broken copy and the name it was kept under, without asking', async () => {
    await leaveCrashCopy('{ зламано')
    await mountShell()

    expect(timesAsked()).toBe(0)
    const kept = [...fs.files.keys()].find((path) => path.includes('unsaved.refused-'))
    expect(kept).toBeDefined()
    expect(bodyText()).toContain(kept.split('/').pop())
    expect(await fs.readText(kept)).toBe('{ зламано')
  })

  it('reports a copy it cannot read, and leaves it where it was', async () => {
    const { sidecarPath } = await leaveCrashCopy()
    const before = await fs.readText(sidecarPath)
    const read = fs.readText.bind(fs)
    vi.spyOn(fs, 'readText').mockImplementation(async (path) => {
      if (path === sidecarPath) throw new Error('диск не відповідає')
      return read(path)
    })
    await mountShell()

    expect(timesAsked()).toBe(0)
    expect(bodyText()).toContain('диск не відповідає')

    const tree = useTreeStore()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Нова' })
    await ProjectFileService.flushAutosave()
    expect(await read(sidecarPath)).toBe(before)
  })

  it('reports a copy «Відкинути копію» could not delete, and the editor carries on', async () => {
    await leaveCrashCopy()
    vi.spyOn(fs, 'remove').mockRejectedValue(new Error('файл зайнятий'))
    await mountShell()

    await answer('Відкинути копію')

    expect(bodyText()).toContain('файл зайнятий')
    const tree = useTreeStore()
    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Нова' })
    expect(useProjectStore().isDirty).toBe(true)
  })
})
