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
    <div class="size-input my-auto">{{ title }}</div>
    <label class="form-label ms-3 me-1 my-auto">marge supérieure (pt)</label>
    <input
      ref="lineMarginTop"
      class="size-input form-control"
      :value="style.lineMarginTop"
      @input="emit"
      type="number"
    />
    <label class="form-label ms-3 me-1 my-auto">marge inférieure (pt)</label>
    <input
      ref="lineMarginTop"
      class="size-input form-control"
      :value="style.lineMarginBottom"
      @input="emit"
      type="number"
    />
    <label class="form-label ms-3 me-1 my-auto">épaisseur (pt)</label>
    <input
      ref="lineThickness"
      class="size-input form-control"
      :value="style.lineThickness"
      @input="emit"
      type="number"
    />
  </div>
</template>
