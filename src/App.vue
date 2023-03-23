<script setup lang="ts">
import { PageSizes } from 'pdf-lib'
import PdfSizeInput from './components/PdfSizeInput.vue'
import VueMultiselect from 'vue-multiselect'
import styles from './assets/vue3-multiselect.css'
</script>

<template>
  <div class="m-3 d-flex flex-column">
    <div>Format de document (unités en millimètres)</div>
    <div class="d-flex justify-content-start">
      <div class="fw-bold">Page</div>
      <label class="form-label mx-3 my-auto">Largeur</label>
      <input v-model="pageFormat.pageWidth" class="form-control size-input" />
      <div class="form-label mx-3 my-auto">Hauteur</div>
      <input v-model="pageFormat.pageHeight" class="form-control size-input" />

      <div class="form-label mx-3 my-auto">Prédéfini :</div>
      <VueMultiselect
        class="ml-3"
        style="width: 30em;"
        v-model="pageSize"
        @update:model-value="selectPageSizes"
        :options="pageSizes"
        :close-on-select="true"
        :clear-on-select="false"
        placeholder="Taille de page"
        label="0"
        track-by="0"
      />
    </div>

    <textarea v-model="rawsongs"></textarea>
    <button class="btn btn-primary" @click="generate()">Générer</button>
  </div>
  <div class="border text-center m-3">
    <iframe id="pdf" style="width: 100%; height: 1000px"></iframe>
  </div>
</template>

<script lang="ts">
import { PageFormat, generate, mmFromPoints } from './generator'

const DEFAULT_PAGE_FORMAT: PageFormat = {
  unit: 'mm',

  pageWidth: Math.round(mmFromPoints(PageSizes.A4[0])),
  pageHeight: Math.round(mmFromPoints(PageSizes.A4[1])),

  marginTop: 10,
  marginRight: 10,
  marginBottom: 10,
  marginLeft: 10,

  displayWidth: 0,
  displayHeight: 0,

  wrapAlineaWidth: 0
}

export default {
  components: { PdfSizeInput, VueMultiselect },
  data() {
    return {
      pageSizes: Object.entries(PageSizes),
      pageSize: 'A4' as keyof typeof PageSizes | 'custom',
      pageFormat: PageFormat.convertTo('mm', DEFAULT_PAGE_FORMAT),
      rawsongs: ''
    }
  },
  methods: {
    selectPageSizes(selection: { 0: string; 1: [number, number] }) {
      this.pageFormat.pageWidth = Math.round(mmFromPoints(selection[1][0]))
      this.pageFormat.pageHeight = Math.round(mmFromPoints(selection[1][1]))
    },
    generate() {
      generate()
    }
  }
}
</script>
