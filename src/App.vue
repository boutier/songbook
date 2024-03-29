<script setup lang="ts">
import { PDFDocument, PageSizes } from 'pdf-lib'
import VueMultiselect from 'vue-multiselect'
import SeparatorStyleInput from './components/SeparatorStyleInput.vue'
</script>

<template>
  <div class="d-flex m-2 justify-content-between">
    <div class="btn-group" role="group" aria-label="Basic example">
      <button
        :class="[tab === 'format' ? 'btn btn-primary' : 'btn btn-outline-primary']"
        @click="tab = 'format'"
      >
        Format
      </button>
      <button
        class="btn"
        :class="[tab === 'content' ? 'btn-primary' : 'btn-outline-primary']"
        @click="tab = 'content'"
      >
        Contenu
      </button>
      <button
        class="btn"
        :class="[tab === 'pdf-options' ? 'btn-primary' : 'btn-outline-primary']"
        @click="tab = 'pdf-options'"
      >
        PDF
      </button>
      <button
        v-if="pdfDataUri"
        class="btn"
        :class="[tab === 'preview' ? 'btn-primary' : 'btn-outline-primary']"
        @click="tab = 'preview'"
      >
        Aperçu
      </button>
    </div>

    <div class="d-flex">
      <div class="d-flex flex-column">
        <label class="my-auto mx-2">
          <input
            type="checkbox"
            :checked="packingMethod === 'auto'"
            @change="packingMethod = packingMethod === 'auto' ? 'linear-split' : 'auto'"
            value="newsletter"
          />
          Réordonner
        </label>
        <label class="my-auto mx-2" v-if="packingMethod !== 'auto'">
          <input
            type="checkbox"
            :checked="packingMethod === 'linear-split'"
            @change="
              packingMethod =
                packingMethod === 'linear-no-split' ? 'linear-split' : 'linear-no-split'
            "
            value="newsletter"
          />
          Couper les chants
        </label>
      </div>
      <button class="btn btn-outline-primary" @click="reset()">Reset</button>
      <button class="ms-2 btn btn-primary" @click="gen_pdf()">Générer PDF</button>
      <button class="ms-2 btn btn-primary" @click="gen_docx()">Générer DocX</button>
      <button class="ms-2 btn btn-primary" @click="gen_indexes_csv()">
        Générer les index (csv)
      </button>
      <button class="ms-2 btn btn-primary" @click="gen_indexes_docx()">
        Générer les index (docx)
      </button>
    </div>
  </div>

  <div v-if="songs.length > 0" class="mx-3 d-flex justify-content-end">
    {{ songs.length }} chants, {{ out?.bins.length }} pages
  </div>

  <div v-if="tab === 'format'" class="m-3 d-flex flex-column">
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
      <label class="my-auto ms-2">
        <input type="checkbox" :checked="landskape" @change="switchLandskape" value="newsletter" />
        Paysage
      </label>
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
    <div class="d-flex justify-content-start">
      <div class="fw-bold mx-3 my-auto">Colonnes (par pages)</div>
      <input v-model="pageFormat.columns" class="form-control size-input" type="number" />
      <div class="fw-bold mx-3 my-auto">Gouttière (séparateur)</div>
      <label class="form-label mx-3 my-auto">Marge gauche</label>
      <input v-model="pageFormat.gutterLeftMargin" class="form-control size-input" type="number" />
      <div class="form-label mx-3 my-auto">Épaisseur du trait (pt)</div>
      <input
        v-model="pageFormat.gutterSeparatorThickness"
        class="form-control size-input"
        type="number"
      />
      <div class="form-label mx-3 my-auto">Marge droite</div>
      <input v-model="pageFormat.gutterRightMargin" class="form-control size-input" type="number" />
    </div>
    <div class="d-flex justify-content-start">
      <div class="fw-bold mx-3 my-auto">Présentation</div>
      <label class="my-auto ms-2">
        <input
          type="checkbox"
          :checked="oddFirstPage"
          @change="oddFirstPage = !oddFirstPage"
          value="newsletter"
        />
        Première page impaire (les chants de la première page ne doivent pas être coupés sur la 2e)
      </label>
    </div>

    <div class="h6">Styles des chants</div>
    <div class="ms-2">
      <StyleInput :title="'default'" v-model:style="stylesheet.default" />
      <StyleInput :title="'Titre'" v-model:style="stylesheet.title" />
      <div class="d-flex">
        <div class="my-auto" style="width: 12em"></div>
        <label class="form-label my-auto me-1">Séparateur de numérotation</label>
        <input v-model="pageFormat.titleSeparator" class="form-control size-input" type="text" />
      </div>
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
      <StyleInput :title="'Autre (n°, +)'" v-model:style="tableOfContentStylesheet.otherFields" />
    </div>
  </div>

  <div v-if="tab === 'content'" class="m-3 d-flex flex-column">
    <div class="h6">Contenu du livret</div>

    <textarea v-model="rawsongs" rows="20"></textarea>
  </div>

  <div v-if="tab === 'pdf-options'" class="m-3 d-flex flex-column">
    <div class="h6">Spécifique pdf:</div>
    <div class="d-flex justify-content-start">
      <div class="fw-bold mx-3 my-auto">Insérer ce pdf avant</div>
      <input type="file" @change="uploadFile($event, 'before')" />
    </div>
    <!-- <div class="d-flex justify-content-start">
      <div class="fw-bold mx-3 my-auto">Insérer ce pdf au début</div>
      <input type="file" @change="uploadFile($event, 'inside')" />
    </div> -->
    <div class="d-flex justify-content-start">
      <div class="fw-bold mx-3 my-auto">Insérer ce pdf après</div>
      <input type="file" @change="uploadFile($event, 'after')" />
    </div>
  </div>
  <!-- <button class="btn btn-primary" @click="plop()">SECLI</button> -->

  <div v-if="tab === 'preview'" class="m-3 d-flex flex-column">
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
import { exportIndexesCsv, exportIndexesDocx } from './generator/export-indexes'
import type { Format } from './generator/formatter'
import {
  DEFAULT_SEPARATOR_STYLE,
  DEFAULT_STYLES,
  PageFormat,
  generate_bins,
  generate_pdf,
  renumber_songs,
  type FormatDefinition,
  type PackedPage,
  type PackingMethod,
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

  pageWidth: Math.round(mmFromPoints(PageSizes.A5[0])),
  pageHeight: Math.round(mmFromPoints(PageSizes.A5[1])),

  marginTop: 5,
  marginRight: 5,
  marginBottom: 5,
  marginLeft: 5,

  displayWidth: 0,
  displayHeight: 0,
  columnWidth: 0,

  columns: 2,
  gutterLeftMargin: 2,
  gutterRightMargin: 2,
  gutterSeparatorThickness: 1,

  wrapAlineaWidth: 5,
  titleSeparator: '-'
}

const SAMPLE = `
68 - CE QUE DIEU A CHOISI
# type : intercession+

A. Ce qu’il y a de fou dans le monde, voilà ce que Dieu a choisi ;
Ce qu’il y a de faible dans le monde, voilà ce que Dieu a choisi.

B. Viens, Esprit de feu, viens, Esprit d’amour,
Viens, Esprit de Dieu, viens, nous t’attendons !

70 – Manifeste-toi
# type : intercession+

Manifeste-toi, donne-nous de l’assurance ;
révèle-toi, remplis-nous de ta présence.
Étends ta main,
qu’il se produise des prodiges,
par le nom de Jésus Christ,
des guérisons et des signes.

1 – Ta grâce
# type : méditation
A. Je suis sauvé, aimé
Pardonné par ta grâce. (bis)
B. Ta grâce vient me libérer
Ta grâce vient me racheter
C’est par la foi que je suis sauvé. (bis)


1 - Ne crains pas
#context : (je suis ton Dieu)
# type : méditation
Ne crains pas, je suis ton Dieu,
C’est moi qui t’ai choisi, appelé par ton nom.
Tu as du prix à mes yeux et je t’aime.
Ne crains pas car je suis avec toi.

1 - Mon âme se repose
#context : (Taizé)
# type : méditation
Mon âme se repose en paix sur Dieu seul :
de lui vient mon salut.
Oui, sur Dieu seul mon âme se repose,
se repose en paix.

1 - Jésus le Christ
#context : (Taizé)
# type : intercession+
Jésus le Christ, lumière intérieure,
ne laisse pas mes ténèbres me parler.
Jésus le Christ, lumière intérieure,
donne-moi d’accueillir ton amour.

1 - Cœur de Jésus brûlant d'amour
# type : intercession+
Cœur de Jésus brûlant d’amour,
Embrase-nous par ton Esprit.
Que nos cœurs soient semblables au tien,
Que nous brûlions de charité !

113 - Je laisse à tes pieds
# type : intercession+
Je laisse à tes pieds mes fardeaux
Devant toi , je dépose tous mes soucis
Et chaque fois que je ne sais pas me diriger,
J’abandonne à tes pieds mes fardeaux.

3 - Mon bien-aimé
# type : louange

Mon bien-aimé, mon bien-aimé,
Mon bien-aimé, le voici, il vient. (bis)
Il saute sur les montagnes et bondit sur les collines. (x2)


`

type DataContent = {
  tab: 'format' | 'content' | 'pdf-options' | 'preview'
  pageSizes: [string, [number, number]][]
  pageSize: keyof typeof PageSizes | 'custom'
  landskape: boolean
  pageFormat: PageFormat
  oddFirstPage: boolean
  stylesheet: FormatDefinition
  tableOfContentStylesheet: TableOfContentFormatDefinition
  separatorStyle: SeparatorStyle
  packingMethod: PackingMethod
  rawsongs: string
  toInsert: PdfToInsert

  songs: Song[]
  out?: { pdfDoc: PDFDocument; pageFormatPts: PageFormat; format: Format; bins: PackedPage[] }
  error?: string
  pdfDataUri?: string
}

type PdfToInsert = {
  before?: File
  inside?: File
  after?: File
}

export default {
  components: { VueMultiselect, StyleInput, SeparatorStyleInput },
  data(): DataContent {
    return this.load()
  },
  methods: {
    defaults(): DataContent {
      return {
        tab: 'format',

        pageSizes: Object.entries(PageSizes),
        pageSize: 'A4' as keyof typeof PageSizes | 'custom',
        landskape: false,
        oddFirstPage: true,
        pageFormat: PageFormat.convertTo('mm', DEFAULT_PAGE_FORMAT),
        stylesheet: { ...DEFAULT_STYLES },
        tableOfContentStylesheet: { ...DEFAULT_TABLE_OF_CONTENT_STYLES },
        separatorStyle: DEFAULT_SEPARATOR_STYLE,
        packingMethod: 'auto',
        rawsongs: false ? SAMPLE : RAW_DATA,
        toInsert: {},

        songs: [],
        out: undefined,

        error: undefined,
        pdfDataUri: undefined
      }
    },
    resetData(from: DataContent) {
      this.pageSizes = from.pageSizes
      this.pageSize = from.pageSize
      this.landskape = from.landskape
      this.pageFormat = from.pageFormat
      this.oddFirstPage = from.oddFirstPage
      this.stylesheet = from.stylesheet
      this.tableOfContentStylesheet = from.tableOfContentStylesheet
      this.separatorStyle = from.separatorStyle
      this.packingMethod = from.packingMethod
      this.rawsongs = from.rawsongs

      if ((this.tab = 'preview')) {
        this.tab = 'content'
      }
      this.toInsert = {}
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
        oddFirstPage: this.oddFirstPage,
        stylesheet: this.stylesheet,
        tableOfContentStylesheet: this.tableOfContentStylesheet,
        separatorStyle: this.separatorStyle,
        packingMethod: this.packingMethod,
        rawsongs: this.rawsongs,

        tab: 'format',
        toInsert: {},
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
    uploadFile(f: Event, where: keyof PdfToInsert) {
      if (f.target instanceof HTMLInputElement) {
        this.toInsert[where] = f.target.files?.[0] ?? undefined
      }
    },
    async analyze(): Promise<
      | {
          pdfDoc: PDFDocument
          pageFormatPts: PageFormat
          format: Format
          bins: PackedPage[]
        }
      | undefined
    > {
      this.save()

      this.songs = parse_file(this.rawsongs)
      this.out = undefined
      this.error = undefined

      try {
        const pageFormatPts = PageFormat.convertTo('pts', this.pageFormat)
        const errors: string[] = []
        const [pdfDoc, format, bins] = await generate_bins(
          pageFormatPts,
          this.oddFirstPage,
          this.stylesheet,
          this.separatorStyle,
          this.songs,
          this.packingMethod,
          errors
        )
        this.out = { pdfDoc, pageFormatPts, format, bins }
        this.error = errors.length > 0 ? errors.join('\n') : undefined
        renumber_songs(bins)
        this.rewrite_input(bins)
        return { pdfDoc, pageFormatPts, format, bins }
      } catch (e) {
        this.error = fullErrorMessage(e)
        console.error(e)
      }
    },
    async gen_pdf() {
      const res = this.$data.out || (await this.analyze())
      if (!res) return
      const { pdfDoc, pageFormatPts, format, bins } = res
      try {
        if (this.toInsert.before) {
          const doc = await PDFDocument.load(await this.toInsert.before.arrayBuffer())
          const pages = await pdfDoc.copyPages(doc, doc.getPageIndices())
          pages.forEach((page) => pdfDoc.addPage(page))
        }

        await generate_pdf(pdfDoc, pageFormatPts, format, this.separatorStyle, bins)
        await append_table_of_content_to_pdf(
          pdfDoc,
          pageFormatPts,
          this.tableOfContentStylesheet,
          bins.flatMap((bin) => bin.objectsByColumn.flatMap((it) => it).map((it) => it.obj.song))
        )

        if (this.toInsert.after) {
          const doc = await PDFDocument.load(await this.toInsert.after.arrayBuffer())
          const pages = await pdfDoc.copyPages(doc, doc.getPageIndices())
          pages.forEach((page) => pdfDoc.addPage(page))
        }

        this.pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true })
        this.tab = 'preview'
      } catch (e) {
        this.error = fullErrorMessage(e)
        console.error(e)
      }
    },
    async gen_docx() {
      const res = this.$data.out || (await this.analyze())
      if (!res) return
      const { pageFormatPts, bins } = res
      try {
        exportDocx(pageFormatPts, this.stylesheet, bins)
      } catch (e) {
        this.error = fullErrorMessage(e)
      }
    },
    async gen_indexes_csv() {
      const res = this.$data.out || (await this.analyze())
      if (!res) return
      const { bins } = res
      try {
        exportIndexesCsv(bins)
      } catch (e) {
        this.error = fullErrorMessage(e)
      }
    },
    async gen_indexes_docx() {
      const res = this.$data.out || (await this.analyze())
      if (!res) return
      const { bins } = res
      try {
        exportIndexesDocx(bins)
      } catch (e) {
        this.error = fullErrorMessage(e)
      }
    },
    rewrite_input(bins: PackedPage[]) {
      const text = bins
        .flatMap((bin) =>
          bin.objectsByColumn
            .flatMap((it) => it)
            .map((obj) => {
              const song = obj.obj.song
              return [
                `${song.number || 0} - ` + song.title,
                song.context ? `# context: ${song.context}` : '',
                song.tags.length > 0 ? `# type: ${song.tags.join(', ')}` : '',
                ...song.stanzas.map((stanza) =>
                  [
                    stanza.prefix + (stanza.prefix ? ' ' : '') + stanza.lines[0],
                    ...stanza.lines.slice(1)
                  ].join('\n')
                )
              ]
                .filter((it) => !!it)
                .join('\n\n')
            })
        )
        .join('\n\n')

      this.rawsongs = text
    }
  }
}
</script>
