<script lang="ts">
import type { SeparatorStyle } from '@/generator/formatter'
import type { PropType } from 'vue'

export default {
  props: {
    title: { type: String, required: false, default: 'Séparateur' },
    style: { type: Object as PropType<SeparatorStyle>, required: true, default: 0 }
  },
  emits: ['update:style'],
  methods: {
    emit() {
      const style: SeparatorStyle = {
        lineMarginTop: (this.$refs.lineMarginTop as HTMLInputElement).valueAsNumber,
        lineMarginBottom: (this.$refs.lineMarginBottom as HTMLInputElement).valueAsNumber,
        lineThickness: (this.$refs.lineThickness as HTMLInputElement).valueAsNumber
      }
      this.$emit('update:style', style)
    }
  }
}
</script>

<template>
  <div class="d-flex">
    <div class="size-input">{{ title }}</div>
    <label class="ms-3 text-muted me-1 my-auto">marge supérieure (pts)</label>
    <input
      ref="lineMarginTop"
      class="size-input"
      :value="style.lineMarginTop"
      @input="emit"
      type="number"
    />
    <label class="ms-3 text-muted me-1 my-auto">marge inférieure (pts)</label>
    <input
      ref="lineMarginTop"
      class="size-input"
      :value="style.lineMarginBottom"
      @input="emit"
      type="number"
    />
    <label class="ms-3 text-muted me-1 my-auto">épaisseur (pts)</label>
    <input
      ref="lineThickness"
      class="size-input"
      :value="style.lineThickness"
      @input="emit"
      type="number"
    />
  </div>
</template>
