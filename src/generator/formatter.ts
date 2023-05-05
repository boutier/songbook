import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib'
import { bin_packing } from './bin-packing'
import type { PrefixType, Song } from './parser'
import { mmFromPoints, mmToPoints } from './pdf-utils'

export type StyleDefinition = {
  font: StandardFonts
  size: number
  toUpper: boolean
  interLine: number
  afterParagraph: number
}

export type FormatDefinition = {
  default: StyleDefinition
  title: StyleDefinition
  refrain: StyleDefinition
  verse: StyleDefinition
  coda: StyleDefinition
  bridge: StyleDefinition
}

export type Style = {
  font: PDFFont
  size: number
  toUpper: boolean
  interLine: number
  afterParagraph: number

  widthOf: (text: string) => number
  /** Height of the text, excluding interLine */
  height: number
}

export type Format = {
  default: Style
  title: Style
  refrain: Style
  verse: Style
  coda: Style
  bridge: Style
}

export const DEFAULT_STYLES: FormatDefinition = {
  default: {
    font: StandardFonts.TimesRoman,
    size: 12,
    toUpper: false,
    interLine: 2,
    afterParagraph: 10
  },
  title: {
    font: StandardFonts.TimesRomanBold,
    size: 11,
    toUpper: true,
    interLine: 2,
    afterParagraph: 10
  },
  refrain: {
    font: StandardFonts.TimesRomanBold,
    size: 12,
    toUpper: false,
    interLine: 2,
    afterParagraph: 10
  },
  verse: {
    font: StandardFonts.TimesRoman,
    size: 12,
    toUpper: false,
    interLine: 2,
    afterParagraph: 10
  },
  coda: {
    font: StandardFonts.TimesRomanBold,
    size: 12,
    toUpper: false,
    interLine: 2,
    afterParagraph: 10
  },
  bridge: {
    font: StandardFonts.TimesRomanBold,
    size: 12,
    toUpper: false,
    interLine: 2,
    afterParagraph: 10
  }
}

export type SeparatorStyle = {
  lineMarginTop: number
  lineMarginBottom: number
  lineThickness: number
}

export const DEFAULT_SEPARATOR_STYLE: SeparatorStyle = {
  lineMarginTop: 6,
  lineMarginBottom: 3,
  lineThickness: 1
}

export type PageFormat = {
  unit: 'mm' | 'pts'

  pageWidth: number
  pageHeight: number

  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number

  displayWidth: number
  displayHeight: number

  wrapAlineaWidth: number
}

export namespace PageFormat {
  export function convertTo(unit: 'mm' | 'pts', page: PageFormat): PageFormat {
    const f = unit === page.unit ? (x: number) => x : unit === 'mm' ? mmFromPoints : mmToPoints
    const pageWidth = f(page.pageWidth)
    const pageHeight = f(page.pageHeight)
    const marginTop = f(page.marginTop)
    const marginRight = f(page.marginRight)
    const marginBottom = f(page.marginBottom)
    const marginLeft = f(page.marginLeft)
    const displayWidth = pageWidth - marginLeft - marginRight
    const displayHeight = pageHeight - marginTop - marginBottom

    return {
      unit,
      pageWidth,
      pageHeight,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      displayWidth,
      displayHeight,
      wrapAlineaWidth: f(page.wrapAlineaWidth)
    }
  }
}

/**
  In PDF, coordinates are expressed as in mathematics:
     y^            y grows to the top
      |            x grows to the right
      +———> x      this is the case when we write some text (e.g.)

  But we are writing from top to bottom, so, in FormattedText, y is from the
  top of the text, and we should consider the text height before rendering.
*/
export type FormattedText = {
  x: number
  y: number
  text: string
  style: Style
}

/**
 *
 *             0 +-------------------------------+
 *         ╭     | +---------------------------+ |
 *   height│     | |                           | |
 *         │     | |                           | |
 *         ╰  ╭  | +---------------------------+ |
 *      margin│  |                               |
 *            ╰  | +---------------------------+ |
 *               | |                           | |
 *               | |                           | |
 *               | +---------------------------+ |
 */
export type FormattedSong = {
  height: number
  /** Doing this that complex to allow splitting a song on multiple columns. */
  elements: {
    height: number
    marginBottom: number
    elements: FormattedText[]
  }[]
  song: Song
}

/** Format a chunk of text and wrap it if it is too long.
 *               x
 *             y +-------------+
 *               |text         |
 *    returned y +-------------+
 */
export function format_element(
  elements: FormattedText[],
  text: string,
  maxWidth: number,
  style: Style,
  x: number,
  alineaX: number,
  y: number
): number {
  const textWidth = style.widthOf(text)
  if (textWidth > maxWidth) {
    let i = Math.ceil((text.length * maxWidth) / textWidth)
    let t1: string | undefined
    do {
      i = text.lastIndexOf(' ', i - 1)
      if (i <= 0) throw Error(`cannot split "${text}" (width=${textWidth}, max=${maxWidth})`)
      t1 = text.substring(0, i)
    } while (style.widthOf(t1) > maxWidth)
    const t2 = text.substring(i + 1)
    elements.push({ x, y, text: t1, style })
    return format_element(
      elements,
      t2,
      maxWidth - (alineaX - x),
      style,
      alineaX,
      alineaX,
      y + style.height // We may add interline here.
    )
  } else {
    elements.push({ x, y, text, style })
    return y + style.height
  }
}

function format_song(page: PageFormat, styles: Format, song: Song): FormattedSong {
  const elements: { height: number; marginBottom: number; elements: FormattedText[] }[] = []
  let subElements: FormattedText[] = []
  let y: number = 0
  try {
    const transformedLine = styles.title.toUpper ? song.title.toLocaleUpperCase() : song.title
    y = format_element(
      subElements,
      '000 ' + transformedLine,
      page.displayWidth,
      styles.title,
      0,
      page.wrapAlineaWidth,
      y
    )
    y += styles.title.afterParagraph
  } catch (e) {
    throw Error(`cannot format "${song.title}"`, { cause: e })
  }

  const styleByPrefixType: { [t in PrefixType]: Style } = {
    none: styles.default,
    refrain: styles.refrain,
    'numbered-verse': styles.verse,
    coda: styles.coda,
    bridge: styles.bridge
  }

  song.stanzas.forEach((stanza, index) => {
    const style = styleByPrefixType[stanza.prefixType]
    const contentX = style.widthOf(`${stanza.prefix} A`) - style.widthOf('A')
    const width = page.displayWidth - contentX
    subElements.push({ x: 0, y: y, text: stanza.prefix, style })

    for (const [lineIndex, line] of stanza.lines.entries()) {
      const transformedLine = style.toUpper ? line.toLocaleUpperCase() : line
      try {
        y = format_element(
          subElements,
          transformedLine,
          width,
          style,
          contentX,
          contentX + page.wrapAlineaWidth,
          y
        )
      } catch (e) {
        const msg = `cannot format song "${song.title}" at stanza "${index}": ${line}`
        throw Error(msg, { cause: e })
      }

      if (lineIndex != stanza.lines.length - 1) y += style.interLine
    }

    elements.push({
      height: y,
      marginBottom: style.afterParagraph,
      elements: subElements
    })
    y = 0
    subElements = []
  })

  const totalHeight = elements.reduce(
    (acc, it, index) => acc + it.height + (index === elements.length - 1 ? 0 : it.marginBottom),
    0
  )
  return { height: totalHeight, elements, song }
}

function toStyle(definition: StyleDefinition, font: PDFFont): Style {
  return {
    font: font,
    size: definition.size,
    toUpper: definition.toUpper,
    interLine: definition.interLine,
    afterParagraph: definition.afterParagraph,
    widthOf: (text) => font.widthOfTextAtSize(text, definition.size),
    height: font.heightAtSize(definition.size)
  }
}

export async function toFormat<T extends { [k: string]: StyleDefinition }>(
  pdfDoc: PDFDocument,
  formatDefinition: T
): Promise<{ [k in keyof T]: Style }> {
  const fonts: { [k: string]: PDFFont } = {}

  for (const def of Object.values(formatDefinition)) {
    fonts[def.font] ??= await pdfDoc.embedFont(def.font)
  }

  return Object.fromEntries(
    Object.entries(formatDefinition).map(([k, def]) => [k, toStyle(def, fonts[def.font])])
  ) as any
}

export type Bin = {
  capacity: number
  size: number
  objs: {
    size: number
    song: FormattedSong
  }[]
}

export async function generate_bins(
  pageFormat: PageFormat,
  formatDefinition: FormatDefinition,
  separatorStyle: SeparatorStyle,
  parsed_songs: Song[],

  errorsOut: string[]
): Promise<[PDFDocument, Bin[]]> {
  pageFormat = {
    ...pageFormat,
    displayWidth: pageFormat.pageWidth - pageFormat.marginLeft - pageFormat.marginRight,
    displayHeight: pageFormat.pageHeight - pageFormat.marginTop - pageFormat.marginBottom
  }

  // PDF Creation
  const pdfDoc = await PDFDocument.create()
  const format: Format = await toFormat(pdfDoc, formatDefinition)
  const formatted_songs = parsed_songs.map((it) => format_song(pageFormat, format, it))

  const { lineMarginTop, lineMarginBottom, lineThickness } = separatorStyle
  const separator_height = lineMarginTop + lineMarginBottom + lineThickness

  // Do some bin-packing (songs may be reordered)
  const bins: Bin[] = bin_packing(
    formatted_songs
      .map((it) => ({ size: it.height + separator_height, song: it }))
      .sort((a, b) => b.size - a.size),
    pageFormat.displayHeight + separator_height,
    5,
    errorsOut
  )
  return [pdfDoc, bins]
}

export function renumber_songs(bins: Bin[]) {
  let song_num = 0
  bins.forEach((bin) =>
    bin.objs.forEach((song) => {
      const title = song.song.elements[0].elements[0]
      title.text = title.text.replace(/^000/, (++song_num).toString())
      song.song.song.number = song_num
    })
  )
}

/** Append bin contents to pdfDoc with the given format. */
export async function generate_pdf(
  pdfDoc: PDFDocument,
  pageFormat: PageFormat,
  separatorStyle: SeparatorStyle,
  bins: Bin[]
) {
  // PDF Creation
  const { lineMarginTop, lineMarginBottom, lineThickness } = separatorStyle

  for (const bin of bins) {
    const page = pdfDoc.addPage([pageFormat.pageWidth, pageFormat.pageHeight])
    const songs = bin.objs.map((it) => it.song)

    let cursorY = pageFormat.pageHeight - pageFormat.marginTop
    for (const [i, song] of songs.entries()) {
      let lastMargin = 0
      for (const chunk of song.elements) {
        for (const element of chunk.elements) {
          page.drawText(element.text, {
            x: pageFormat.marginLeft + element.x,
            y: cursorY - element.y - element.style.height,
            font: element.style.font,
            size: element.style.size
          })
        }
        cursorY -= chunk.height + chunk.marginBottom
        lastMargin = chunk.marginBottom
      }

      if (i !== songs.length - 1) {
        cursorY += lastMargin
        cursorY -= lineMarginTop + lineThickness / 2
        page.drawLine({
          start: { x: pageFormat.marginLeft, y: cursorY },
          end: { x: pageFormat.marginLeft + pageFormat.displayWidth, y: cursorY },
          thickness: lineThickness,
          opacity: 0.3
        })
        cursorY -= lineMarginBottom + lineThickness / 2
      }
    }
  }
}
