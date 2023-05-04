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
        toUpper: (this.$refs.toUpper as HTMLInputElement).checked,
        interLine: (this.$refs.interLine as HTMLInputElement).valueAsNumber,
        afterParagraph: (this.$refs.afterParagraph as HTMLInputElement).valueAsNumber
      }
      this.$emit('update:style', style)
    }
  }
}
</script>

<template>
  <div class="d-flex">
    <div class="size-input my-auto">{{ title }}</div>
    <div class="form-label my-auto">Taille (pt)</div>
    <input
      ref="fontSize"
      class="form-control size-input me-3"
      :value="style.size"
      type="number"
      @input="emit"
    />
    <div class="me-3 my-auto">
      <label>
        <input ref="toUpper" type="checkbox" @click="emit" :checked="style.toUpper" />
        majuscule
      </label>
    </div>
    <div class="form-label my-auto">inter-ligne</div>
    <input
      ref="interLine"
      class="form-control size-input me-3"
      :value="style.interLine"
      type="number"
      @input="emit"
    />
    <div class="form-label my-auto">inter-paragraphe</div>
    <input
      ref="afterParagraph"
      class="form-control size-input me-3"
      :value="style.afterParagraph"
      type="number"
      @input="emit"
    />
  </div>
</template>
