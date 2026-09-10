// Hash history, because a desktop window has no web server to rewrite paths for it.
// The two feature routes are not listed here: each module registers its own through
// `router.addRoute` when its plugin installs (see modules/*/index.js).
import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', redirect: '/tree' }],
})

export default router
