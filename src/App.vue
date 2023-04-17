<script setup lang="ts">
import { PageSizes } from 'pdf-lib'
import VueMultiselect from 'vue-multiselect'
</script>

<template>
  <div class="m-3 d-flex flex-column">
    <div>Format de document (unités en millimètres)</div>
    <div class="d-flex justify-content-start">
      <div class="fw-bold">Page</div>
      <label class="form-label mx-3 my-auto">Largeur</label>
      <input v-model="pageFormat.pageWidth" class="form-control size-input" type="number" />
      <div class="form-label mx-3 my-auto">Hauteur</div>
      <input v-model="pageFormat.pageHeight" class="form-control size-input" type="number" />

      <div class="form-label mx-3 my-auto">Prédéfini :</div>
      <VueMultiselect
        class="ml-3"
        style="width: 30em"
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

    <StyleInput :title="'default'" :style="stylesheet.default" />
    <StyleInput :title="'title'" :style="stylesheet.title" />
    <StyleInput :title="'refrain'" :style="stylesheet.refrain" />
    <StyleInput :title="'verse'" :style="stylesheet.verse" />
    <StyleInput :title="'coda'" :style="stylesheet.coda" />

    <textarea v-model="rawsongs"></textarea>

    <button class="btn btn-primary" @click="gen()">Générer</button>
    <div>Nombre de chants: {{ songs.length }}</div>
    <div v-if="error" class="text-danger">{{ error }}</div>
  </div>
  <div class="border text-center m-3" v-if="pdfDataUri">
    <iframe id="pdf" style="width: 100%; height: 1000px" :src="pdfDataUri"></iframe>
  </div>
</template>

<script lang="ts">
import StyleInput from './components/StyleInput.vue'
import { RAW_DATA } from './generator/data-real'
import type { FormatDefinition } from './generator/formatter'
import { DEFAULT_STYLES, generate, PageFormat } from './generator/formatter'
import { parse_file, type Song } from './generator/parser'
import { mmFromPoints } from './generator/pdf-utils'
import { fullErrorMessage } from './generator/utils'

const DEFAULT_PAGE_FORMAT: PageFormat = {
  unit: 'mm',

  pageWidth: Math.round(mmFromPoints(PageSizes.A4[0] / 2)),
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
  components: { VueMultiselect, StyleInput },
  data(): {
    pageSizes: [string, [number, number]][]
    pageSize: keyof typeof PageSizes | 'custom'
    pageFormat: PageFormat
    stylesheet: FormatDefinition
    rawsongs: string
    songs: Song[]
    error?: string
    pdfDataUri?: string
  } {
    return {
      pageSizes: Object.entries(PageSizes),
      pageSize: 'A4' as keyof typeof PageSizes | 'custom',
      pageFormat: PageFormat.convertTo('mm', DEFAULT_PAGE_FORMAT),
      stylesheet: DEFAULT_STYLES,
      rawsongs: RAW_DATA,
      songs: [],
      error: undefined,
      pdfDataUri: undefined
    }
  },
  methods: {
    selectPageSizes(selection: { 0: string; 1: [number, number] }) {
      this.pageFormat.pageWidth = Math.round(mmFromPoints(selection[1][0]))
      this.pageFormat.pageHeight = Math.round(mmFromPoints(selection[1][1]))
    },
    async gen() {
      this.songs = parse_file(this.rawsongs)
      this.error = undefined

      try {
        const pageFormat = PageFormat.convertTo('pts', this.pageFormat)
        this.pdfDataUri = await generate(pageFormat, this.stylesheet, this.songs)
      } catch (e) {
        this.error = fullErrorMessage(e)
      }
    }
  }
}
</script>
