<script setup>
// The «Довідники» section: the two reference tables of the source document, one tab each
// (002/FR-003).
import { NTabPane, NTabs } from 'naive-ui'
import ReferenceTable from '../components/ReferenceTable.vue'
import { tableTitles } from '../config/columns.js'
</script>

<template>
  <section class="reference-view">
    <n-tabs type="line" default-value="loadTypes">
      <n-tab-pane
        v-for="table in Object.keys(tableTitles)"
        :key="table"
        :name="table"
        :tab="tableTitles[table]"
      >
        <ReferenceTable :table="table" />
      </n-tab-pane>
    </n-tabs>
  </section>
</template>

<style scoped>
.reference-view {
  padding: 12px 16px;
}
</style>
