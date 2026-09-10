<script setup>
// Placeholder assembly. T057 replaces this with the canvas, the inspector and the drawer;
// what it carries now is what the Phase 2 checkpoint needs — the route opens on an empty tree.
import { NEmpty, NText } from 'naive-ui'
import { useTreeStore } from '../stores/tree.js'

const tree = useTreeStore()
</script>

<template>
  <div class="tree-view">
    <n-empty description="Дерево ще порожнє">
      <template #extra>
        <n-text depth="3">
          Ввід: «{{ tree.root?.name }}» — вузлів у проекті: {{ tree.nodeCount }}
        </n-text>
      </template>
    </n-empty>
  </div>
</template>

<style scoped>
.tree-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--app-gutter);
}
</style>
