// The dark and light pass (T058). Two things are worth holding in place mechanically: the
// `[data-theme]` hook the stylesheet keys off actually follows the store, and no component paints
// a colour of its own — a literal hex survives a theme switch and is the way a dark pass rots.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { NEmpty } from 'naive-ui'
import TreeCanvas from '@/modules/tree/components/TreeCanvas.vue'
import { useTreeStore } from '@/modules/tree/stores/tree.js'
import { useUiStore } from '@/stores/ui.js'

const MAIN_CSS = readFileSync('src/assets/main.css', 'utf8')

/** Every `.vue` under src/, with its `<style>` blocks pulled out. */
function componentStyles() {
  return readdirSync('src', { recursive: true })
    .filter((name) => String(name).endsWith('.vue'))
    .map((name) => {
      const file = `src/${name}`
      const source = readFileSync(file, 'utf8')
      const blocks = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])
      return { file, css: blocks.join('\n') }
    })
    .filter((entry) => entry.css.trim() !== '')
}

/** Custom properties declared by the blocks whose selector matches, as token → value. */
function tokensDeclaredIn(selectorPattern) {
  const withoutComments = MAIN_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  const found = new Map()
  for (const [, selector, body] of withoutComments.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!selectorPattern.test(selector.trim())) continue
    for (const [, token, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      found.set(token, value.trim())
    }
  }
  return found
}

function isColour(value) {
  return /^(#|rgba?\(|hsla?\()/.test(String(value))
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('the [data-theme] hook (T058)', () => {
  // The watcher is pre-flush, so it runs before the next render rather than immediately — which
  // is why the assertions wait a tick and why a theme switch never shows a half-applied frame.
  it('follows the store in both directions, which is what main.css keys off', async () => {
    const ui = useUiStore()
    expect(document.documentElement.dataset.theme).toBe('light')

    ui.toggleTheme()
    await nextTick()
    expect(ui.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    ui.toggleTheme()
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('defines every surface colour in both themes, so nothing falls back to nothing', () => {
    // Parsed per block rather than by slicing the file: token blocks move around as the stylesheet
    // grows, and a position-based check silently starts measuring the wrong half.
    const light = tokensDeclaredIn(/^:root$/)
    const dark = tokensDeclaredIn(/^:root\[data-theme='dark'\]$/)

    for (const token of ['--app-bg', '--app-bg-subtle', '--app-border']) {
      expect(light.has(token)).toBe(true)
      expect(dark.has(token)).toBe(true)
    }

    // Any colour the light theme names has to be answered by the dark one, and vice versa.
    const lightColours = [...light].filter((token) => isColour(light.get(token)))
    expect(lightColours.filter((token) => !dark.has(token))).toEqual([])
    expect([...dark.keys()].filter((token) => !light.has(token))).toEqual([])
  })
})

describe('no component paints its own colour', () => {
  it('uses tokens and Naive UI’s theme instead of literal values', () => {
    const offenders = componentStyles()
      .filter(({ css }) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(css))
      .map(({ file }) => file)

    expect(offenders).toEqual([])
  })

  it('only reads custom properties that main.css actually declares', () => {
    const unknown = []
    for (const { file, css } of componentStyles()) {
      for (const [, token] of css.matchAll(/var\((--[a-z0-9-]+)/g)) {
        if (!MAIN_CSS.includes(`${token}:`)) unknown.push(`${file}: ${token}`)
      }
    }

    expect(unknown).toEqual([])
  })
})

describe('empty states (T059)', () => {
  it('a fresh project says what to do instead of showing a bare root', () => {
    const tree = useTreeStore()
    expect(tree.nodeCount).toBe(1)

    const wrapper = mount(TreeCanvas)
    expect(wrapper.findComponent(NEmpty).exists()).toBe(true)
    expect(wrapper.text()).toContain('Insert')
    wrapper.unmount()
  })

  it('the hint disappears as soon as the tree has something in it', async () => {
    const tree = useTreeStore()
    const wrapper = mount(TreeCanvas)

    tree.add({ parentId: tree.rootId, kind: 'panel', name: 'Кухня' })
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(NEmpty).exists()).toBe(false)
    wrapper.unmount()
  })
})
