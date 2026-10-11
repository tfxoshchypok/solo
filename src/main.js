import { init } from '@neutralinojs/lib'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import { TreeModule } from './modules/tree/index.js'
import { ReferenceModule } from './modules/reference/index.js'
import { installCloseGuard } from './services/closeGuard.js'
import './assets/main.css'

// `NL_PORT` is injected by the Neutralino window. Without it the app is running in a plain
// browser through `npm run dev`, where there is no native API to initialise and the filesystem
// adapter falls back to MemoryFs.
if (typeof window !== 'undefined' && window.NL_PORT) {
  init()
  // `exitProcessOnClose` is off in neutralino.config.json so that this handler gets to write the
  // pending autosave before the process goes away (FR-031).
  installCloseGuard()
}

// `neu run` loads the page, injects the native globals and then reloads it. A dynamic import that
// was in flight at that moment is aborted, and the initial navigation dies with "Importing a module
// script failed" — an empty window with the error only in the CLI log. One reload recovers it.
//
// The guard lives in sessionStorage because a module-level flag would not survive the reload it
// triggers, and the retry must not be able to loop.
const RETRY_KEY = 'eltree:navigation-retry'

function retriedAlready() {
  try {
    return globalThis.sessionStorage?.getItem(RETRY_KEY) === '1'
  } catch {
    // Storage can be unavailable; treating that as "already retried" only skips the recovery.
    return true
  }
}

router.onError((error) => {
  const importFailed = /module script|dynamically imported module/i.test(error?.message ?? '')
  if (!importFailed || retriedAlready()) return
  try {
    globalThis.sessionStorage.setItem(RETRY_KEY, '1')
  } catch {
    return
  }
  globalThis.location.reload()
})

router.isReady().then(() => {
  try {
    globalThis.sessionStorage?.removeItem(RETRY_KEY)
  } catch {
    // Nothing to clear.
  }
})

const app = createApp(App)
app.use(createPinia())

// The module routes have to exist before the router is installed: `app.use(router)` starts the
// initial navigation on the spot, and `/` redirects to `/tree`. Installing the router first left
// that redirect with nothing to match.
app.use(TreeModule, { router })
app.use(ReferenceModule, { router })
app.use(router)

app.mount('#app')
