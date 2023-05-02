<script setup lang="ts">
import { PageSizes } from 'pdf-lib'
import VueMultiselect from 'vue-multiselect'
import SeparatorStyleInput from './components/SeparatorStyleInput.vue'
</script>

<template>
  <div class="m-3 d-flex flex-column">
    <div>Format de document (unités en millimètres)</div>
    <div class="d-flex justify-content-start">
      <div class="fw-bold my-auto">Page</div>
      <label class="form-label mx-3 my-auto">Largeur</label>
      <input v-model="pageFormat.pageWidth" class="form-control size-input" type="number" />
      <div class="form-label mx-3 my-auto">Hauteur</div>
      <input v-model="pageFormat.pageHeight" class="form-control size-input" type="number" />

      <div class="form-label mx-3 my-auto">Prédéfini :</div>
      <VueMultiselect
        class="ms-3"
        style="width: 30em"
        v-model="pageSize"
        @update:model-value="selectPageSizes"
        :options="pageSizes"
        :close-on-select="true"
        :clear-on-select="false"
        placeholder="Taille de page"
        label="0"
        track-by="0"
      >
        <!-- <template v-slot:selection="{ value }">
          {{ value }}
        </template> -->
      </VueMultiselect>
      <div class="my-auto ms-2">
        <label>
          <input type="checkbox" v-bind="landskape" @click="switchLandskape" value="newsletter" />
          Paysage
        </label>
      </div>
    </div>

    <StyleInput :title="'default'" v-model:style="stylesheet.default" />
    <StyleInput :title="'title'" v-model:style="stylesheet.title" />
    <StyleInput :title="'refrain'" v-model:style="stylesheet.refrain" />
    <StyleInput :title="'verse'" v-model:style="stylesheet.verse" />
    <StyleInput :title="'coda'" v-model:style="stylesheet.coda" />

    <div class="d-flex justify-content-start">
      <label class="form-label me-3 my-auto">Marge lors d'un retour à la ligne</label>
      <input v-model="pageFormat.wrapAlineaWidth" class="form-control size-input" type="number" />
    </div>

    <SeparatorStyleInput v-model:style="separatorStyle" />

    <textarea v-model="rawsongs"></textarea>

    <!-- <button class="btn btn-primary" @click="plop()">SECLI</button> -->
    <button class="btn btn-primary" @click="gen_pdf()">Générer PDF</button>
    <button class="btn btn-primary" @click="gen_docx()">Générer DocX</button>
    <div>Nombre de chants: {{ songs.length }}</div>
    <div v-if="error" class="text-danger">{{ error }}</div>
  </div>
  <div class="border text-center m-3" v-if="pdfDataUri">
    <iframe id="pdf" style="width: 100%; height: 1000px" :src="pdfDataUri"></iframe>
  </div>
</template>

<script lang="ts">
import StyleInput from './components/StyleInput.vue'
import { parse_secli_xml } from './data/secli-parser'
import { RAW_DATA } from './generator/data-real'
import { exportDocx } from './generator/export-docx'
import {
  DEFAULT_SEPARATOR_STYLE,
  DEFAULT_STYLES,
  generate_bins,
  generate_pdf,
  PageFormat,
  renumber_songs,
  type FormatDefinition,
  type SeparatorStyle
} from './generator/formatter'
import { parse_file, type Song } from './generator/parser'
import { mmFromPoints } from './generator/pdf-utils'
import { append_table_of_content_to_pdf } from './generator/table-of-contents'
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

  wrapAlineaWidth: 5
}

const SAMPLE = `
1 - LA SAGESSE A DRESSÉ UNE TABLE 
# type : célébration
R.
La sagesse a dressé une table,
Elle invite les hommes au festin.
Venez au banquet du fils de l'homme,
Mangez et buvez la Pâque de Dieu.
`

export default {
  components: { VueMultiselect, StyleInput, SeparatorStyleInput },
  data(): {
    pageSizes: [string, [number, number]][]
    pageSize: keyof typeof PageSizes | 'custom'
    landskape: boolean
    pageFormat: PageFormat
    stylesheet: FormatDefinition
    separatorStyle: SeparatorStyle
    rawsongs: string
    songs: Song[]
    error?: string
    pdfDataUri?: string
  } {
    return {
      pageSizes: Object.entries(PageSizes),
      pageSize: 'A4' as keyof typeof PageSizes | 'custom',
      landskape: false,
      pageFormat: PageFormat.convertTo('mm', DEFAULT_PAGE_FORMAT),
      stylesheet: { ...DEFAULT_STYLES },
      separatorStyle: DEFAULT_SEPARATOR_STYLE,
      rawsongs: false ? SAMPLE : RAW_DATA,
      songs: [],
      error: undefined,
      pdfDataUri: undefined
    }
  },
  methods: {
    selectPageSizes(selection: { 0: string; 1: [number, number] }) {
      this.pageFormat.pageWidth = Math.round(mmFromPoints(selection[1][0]))
      this.pageFormat.pageHeight = Math.round(mmFromPoints(selection[1][1]))
      if (this.landskape) {
        const tmp = this.pageFormat.pageWidth
        this.pageFormat.pageWidth = this.pageFormat.pageHeight
        this.pageFormat.pageHeight = tmp
      }
    },
    switchLandskape() {
      const isLandskape = this.pageFormat.pageWidth > this.pageFormat.pageHeight
      this.landskape = !this.landskape
      if (this.landskape !== isLandskape) {
        const tmp = this.pageFormat.pageWidth
        this.pageFormat.pageWidth = this.pageFormat.pageHeight
        this.pageFormat.pageHeight = tmp
      }
    },
    plop() {
      parse_secli_xml()
    },
    async gen_pdf() {
      this.songs = parse_file(this.rawsongs)
      this.error = undefined

      try {
        const pageFormat = PageFormat.convertTo('pts', this.pageFormat)
        const errors: string[] = []
        const [pdfDoc, bins] = await generate_bins(
          pageFormat,
          this.stylesheet,
          this.separatorStyle,
          this.songs,
          errors
        )
        this.error = errors.length > 0 ? errors.join('\n') : undefined
        renumber_songs(bins)
        await generate_pdf(pdfDoc, pageFormat, this.separatorStyle, bins)
        await append_table_of_content_to_pdf(pdfDoc, pageFormat, this.stylesheet, bins)

        this.pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true })
      } catch (e) {
        this.error = fullErrorMessage(e)
      }
    },
    async gen_docx() {
      this.songs = parse_file(this.rawsongs)
      this.error = undefined

      try {
        const pageFormat = PageFormat.convertTo('pts', this.pageFormat)
        const errors: string[] = []
        const [_pdfDoc, bins] = await generate_bins(
          pageFormat,
          this.stylesheet,
          this.separatorStyle,
          this.songs,
          errors
        )
        this.error = errors.length > 0 ? errors.join('\n') : undefined
        exportDocx(pageFormat, this.stylesheet, bins)
      } catch (e) {
        this.error = fullErrorMessage(e)
      }
    }
  }
}
</script>
