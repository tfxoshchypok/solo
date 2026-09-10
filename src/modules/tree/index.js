/** Registers the tree editor route. Installed in main.js after the router. */
export const TreeModule = {
  install(app, { router }) {
    router.addRoute({
      path: '/tree',
      name: 'tree',
      component: () => import('./views/TreeEditorView.vue'),
    })
  },
}

export default TreeModule
