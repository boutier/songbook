<script lang="ts">
import type { StyleDefinition } from '@/generator/formatter'
import type { PropType } from 'vue'

export default {
  props: {
    title: { type: String, required: true },
    style: { type: Object as PropType<StyleDefinition>, required: true, default: 0 }
  },
  emits: ['update:style'],
  methods: {
    emit() {
      const size = (this.$refs.fontSize as HTMLInputElement).valueAsNumber
      const style: StyleDefinition = {
        font: this.style.font,
        size: size || this.style.size,
        case: (this.$refs.caseStyle as HTMLSelectElement).value as any
      }
      this.$emit('update:style', style)
    }
  }
}
</script>

<template>
  <div class="d-flex">
    <div class="size-input">{{ title }}</div>
    <input ref="fontSize" class="size-input" :value="style.size" type="number" @input="emit" />
    <select ref="caseStyle" :value="style.case" @input="emit">
      <option value="capitalized">Capitalize</option>
      <option value="upper">Upper</option>
      <option value="lower">Lower</option>
    </select>
  </div>
</template>
