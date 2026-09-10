import { init } from '@neutralinojs/lib'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import { TreeModule } from './modules/tree/index.js'
import './assets/main.css'

// `NL_PORT` is injected by the Neutralino window. Without it the app is running in a plain
// browser through `npm run dev`, where there is no native API to initialise and the filesystem
// adapter falls back to MemoryFs.
if (typeof window !== 'undefined' && window.NL_PORT) {
  init()
}

const app = createApp(App)
app.use(createPinia())

// The module route has to exist before the router is installed: `app.use(router)` starts the
// initial navigation on the spot, and `/` redirects to `/tree`. Installing the router first left
// that redirect with nothing to match.
app.use(TreeModule, { router })
app.use(router)

app.mount('#app')
