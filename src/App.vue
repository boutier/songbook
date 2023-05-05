<script setup lang="ts">
import { PageSizes } from 'pdf-lib'
import VueMultiselect from 'vue-multiselect'
import SeparatorStyleInput from './components/SeparatorStyleInput.vue'
</script>

<template>
  <div class="m-3 d-flex flex-column">
    <div class="h6">Format du document (unités en millimètres)</div>
    <div class="d-flex justify-content-start">
      <div class="fw-bold mx-3 my-auto">Papier</div>
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
    <div class="d-flex justify-content-start">
      <div class="fw-bold mx-3 my-auto">Marges</div>
      <label class="form-label mx-3 my-auto">Haut</label>
      <input v-model="pageFormat.marginTop" class="form-control size-input" type="number" />
      <label class="form-label mx-3 my-auto">Bas</label>
      <input v-model="pageFormat.marginBottom" class="form-control size-input" type="number" />
      <div class="form-label mx-3 my-auto">Gauche</div>
      <input v-model="pageFormat.marginLeft" class="form-control size-input" type="number" />
      <div class="form-label mx-3 my-auto">Droite</div>
      <input v-model="pageFormat.marginRight" class="form-control size-input" type="number" />
    </div>

    <div class="h6">Styles des chants</div>
    <div class="ms-2">
      <StyleInput :title="'default'" v-model:style="stylesheet.default" />
      <StyleInput :title="'Titre'" v-model:style="stylesheet.title" />
      <StyleInput :title="'Refrain'" v-model:style="stylesheet.refrain" />
      <StyleInput :title="'Couplet'" v-model:style="stylesheet.verse" />
      <StyleInput :title="'Coda'" v-model:style="stylesheet.coda" />
      <StyleInput :title="'Pont'" v-model:style="stylesheet.bridge" />

      <div class="d-flex justify-content-start">
        <label class="form-label me-3 my-auto">Marge lors d'un retour à la ligne</label>
        <input v-model="pageFormat.wrapAlineaWidth" class="form-control size-input" type="number" />
      </div>

      <SeparatorStyleInput v-model:style="separatorStyle" />
    </div>

    <div class="h6">Styles de l'index</div>
    <div class="ms-2">
      <StyleInput :title="'En-tête'" v-model:style="tableOfContentStylesheet.header" />
      <StyleInput
        :title="'Titres de groupe impair'"
        v-model:style="tableOfContentStylesheet.oddTitle"
      />
      <StyleInput
        :title="'Titres du groupe pair'"
        v-model:style="tableOfContentStylesheet.evenTitle"
      />
      <StyleInput :title="'Champs'" v-model:style="tableOfContentStylesheet.otherFields" />
    </div>

    <div class="h6">Contenu du livret</div>

    <textarea v-model="rawsongs" rows="20"></textarea>

    <!-- <button class="btn btn-primary" @click="plop()">SECLI</button> -->
    <div class="d-flex my-2">
      <button class="btn btn-outline-primary" @click="reset()">Reset</button>
      <button class="ms-2 btn btn-primary" @click="gen_pdf()">Générer PDF</button>
      <button class="ms-2 btn btn-primary" @click="gen_docx()">Générer DocX</button>
    </div>

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
  PageFormat,
  generate_bins,
  generate_pdf,
  renumber_songs,
  type FormatDefinition,
  type SeparatorStyle
} from './generator/formatter'
import { parse_file, type Song } from './generator/parser'
import { mmFromPoints } from './generator/pdf-utils'
import {
  DEFAULT_TABLE_OF_CONTENT_STYLES,
  append_table_of_content_to_pdf,
  type TableOfContentFormatDefinition
} from './generator/table-of-contents'
import { fullErrorMessage } from './generator/utils'

const DEFAULT_PAGE_FORMAT: PageFormat = {
  unit: 'mm',

  pageWidth: Math.round(mmFromPoints(PageSizes.A4[0] / 2)),
  pageHeight: Math.round(mmFromPoints(PageSizes.A4[1])),

  marginTop: 10,
  marginRight: 5,
  marginBottom: 10,
  marginLeft: 5,

  displayWidth: 0,
  displayHeight: 0,

  wrapAlineaWidth: 5
}

const SAMPLE = `
24 - À l’Agneau de Dieu pif paf pouf tra la la
# type : louange, intercession, esprit-saint, célébration
1.
Élevé à la droite de Dieu,
Couronné de mille couronnes,
Tu resplendis comme un soleil radieux ;
Les êtres crient autour de ton trône :
R.
À l’Agneau de Dieu soit la gloire,
À l’Agneau de Dieu, la victoire,
À l’Agneau de Dieu soit le règne
Pour tous les siècles, amen.
2.
L’Esprit Saint et l’Épouse fidèle
Disent « Viens ! », c’est leur cœur qui appelle.
Viens, ô Jésus, toi l’Époux bien-aimé ;
Tous les élus ne cessent de chanter :
3
Tous les peuples et toutes les nations,
D’un seul cœur avec les milliers d’anges,
Entonneront en l’honneur de ton Nom
Ce chant de gloire, avec force et louange :
`

type DataContent = {
  pageSizes: [string, [number, number]][]
  pageSize: keyof typeof PageSizes | 'custom'
  landskape: boolean
  pageFormat: PageFormat
  stylesheet: FormatDefinition
  tableOfContentStylesheet: TableOfContentFormatDefinition
  separatorStyle: SeparatorStyle
  rawsongs: string
  songs: Song[]
  error?: string
  pdfDataUri?: string
}

export default {
  components: { VueMultiselect, StyleInput, SeparatorStyleInput },
  data(): DataContent {
    return this.load()
  },
  methods: {
    defaults(): DataContent {
      return {
        pageSizes: Object.entries(PageSizes),
        pageSize: 'A4' as keyof typeof PageSizes | 'custom',
        landskape: false,
        pageFormat: PageFormat.convertTo('mm', DEFAULT_PAGE_FORMAT),
        stylesheet: { ...DEFAULT_STYLES },
        tableOfContentStylesheet: { ...DEFAULT_TABLE_OF_CONTENT_STYLES },
        separatorStyle: DEFAULT_SEPARATOR_STYLE,
        rawsongs: false ? SAMPLE : RAW_DATA,
        songs: [],
        error: undefined,
        pdfDataUri: undefined
      }
    },
    resetData(from: DataContent) {
      this.pageSizes = from?.pageSizes
      this.pageSize = from?.pageSize
      this.landskape = from?.landskape
      this.pageFormat = from?.pageFormat
      this.stylesheet = from?.stylesheet
      this.tableOfContentStylesheet = from?.tableOfContentStylesheet
      this.separatorStyle = from?.separatorStyle
      this.rawsongs = from?.rawsongs

      this.songs = []
      this.error = undefined
      this.pdfDataUri = undefined
    },
    save() {
      const toSave: DataContent = {
        pageSizes: this.pageSizes,
        pageSize: this.pageSize,
        landskape: this.landskape,
        pageFormat: this.pageFormat,
        stylesheet: this.stylesheet,
        tableOfContentStylesheet: this.tableOfContentStylesheet,
        separatorStyle: this.separatorStyle,
        rawsongs: this.rawsongs,

        songs: [],
        error: undefined,
        pdfDataUri: ''
      }
      window.localStorage.setItem('options', JSON.stringify(toSave))
    },
    load(): DataContent | undefined {
      const tmp = window.localStorage.getItem('options')
      return (tmp && JSON.parse(tmp)) ?? this.defaults()
    },
    reset() {
      window.localStorage.removeItem('options')
      this.resetData(this.defaults())
    },
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
      this.save()

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
        await append_table_of_content_to_pdf(
          pdfDoc,
          pageFormat,
          this.tableOfContentStylesheet,
          bins
        )

        this.pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true })
      } catch (e) {
        this.error = fullErrorMessage(e)
      }
    },
    async gen_docx() {
      this.save()

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
