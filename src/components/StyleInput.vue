<script lang="ts">
import type { StyleDefinition } from '@/generator/formatter'
import type { PropType } from 'vue'

export default {
  props: {
    title: { type: String, required: true },
    style: { type: Object as PropType<StyleDefinition>, required: true, default: 0 }
  }
}
</script>

<template>
  <div class="d-flex">
    <div class="size-input">{{ title }}</div>
    <input class="size-input" v-model="style.size" type="number" />
    <select v-model="style.case">
      <option value="capitalized">Capitalize</option>
      <option value="upper">Upper</option>
      <option value="lower">Lower</option>
    </select>
  </div>
</template>
