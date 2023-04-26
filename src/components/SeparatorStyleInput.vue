<script lang="ts">
import type { SeparatorStyle } from '@/generator/formatter'
import type { PropType } from 'vue'

export default {
  props: {
    title: { type: String, required: false, default: 'Séparateur' },
    style: { type: Object as PropType<SeparatorStyle>, required: true, default: 0 }
  }
}
</script>

<template>
  <div class="d-flex">
    <div class="size-input">{{ title }}</div>
    <label class="ms-3 text-muted me-1 my-auto">marge verticale (pts)</label>
    <input class="size-input" v-model="style.lineMargin" type="number" />
    <label class="ms-3 text-muted me-1 my-auto">épaisseur (pts)</label>
    <input class="size-input" v-model="style.lineThickness" type="number" />
  </div>
</template>
