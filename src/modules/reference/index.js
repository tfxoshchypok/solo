/** Registers the «Довідники» route (002/FR-003). Installed in main.js after TreeModule, before the router. */
export const ReferenceModule = {
  install(app, { router }) {
    router.addRoute({
      path: '/reference',
      name: 'reference',
      component: () => import('./views/ReferenceTablesView.vue'),
    })
  },
}

export default ReferenceModule
