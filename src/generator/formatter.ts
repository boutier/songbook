import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib'
import { bin_packing } from './bin-packing'
import type { PrefixType, Song } from './parser'
import { mmFromPoints, mmToPoints } from './pdf-utils'

export type StyleDefinition = {
  font: StandardFonts
  size: number
  case: 'upper' | 'lower' | 'capitalized'
}

export type FormatDefinition = {
  default: StyleDefinition
  title: StyleDefinition
  refrain: StyleDefinition
  verse: StyleDefinition
  coda: StyleDefinition
  chunkGap: number // Space between paragraphs
}

export type Style = {
  font: PDFFont
  size: number
  case: 'upper' | 'lower' | 'capitalized'
  widthOf: (text: string) => number
  height: number
}

export type Format = {
  default: Style
  title: Style
  refrain: Style
  verse: Style
  coda: Style
  chunkGap: number // Space between paragraphs
}

export const DEFAULT_STYLES: FormatDefinition = {
  default: {
    font: StandardFonts.TimesRoman,
    size: 12,
    case: 'capitalized'
  },
  title: {
    font: StandardFonts.TimesRomanBold,
    size: 14,
    case: 'capitalized'
  },
  refrain: {
    font: StandardFonts.TimesRomanBold,
    size: 12,
    case: 'capitalized'
  },
  verse: {
    font: StandardFonts.TimesRoman,
    size: 12,
    case: 'capitalized'
  },
  coda: {
    font: StandardFonts.TimesRoman,
    size: 12,
    case: 'capitalized'
  },
  chunkGap: 10
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
type FormattedText = {
  x: number
  y: number
  text: string
  style: Style
}

type FormattedSong = {
  height: number
  elements: FormattedText[]
}

/** Format a chunk of text and wrap it if it is too long.
 *               x
 *             y +-------------+
 *               |text         |
 *    returned y +-------------+
 */
function format_element(
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
      y + style.height
    )
  } else {
    elements.push({ x, y, text, style })
    return y + style.height
  }
}

function format_song(page: PageFormat, styles: Format, song: Song): FormattedSong {
  const elements: FormattedText[] = []
  // const songNumberMaxWidth = styles.title.widthOf('000 —')
  // const spaceWidth = songNumberMaxWidth - styles.title.widthOf('000—')
  let y: number
  try {
    y = format_element(
      elements,
      '000 — ' + song.title,
      page.displayWidth,
      styles.title,
      0,
      page.wrapAlineaWidth,
      0
    )
  } catch (e) {
    throw Error(`cannot format "${song.title}"`, { cause: e })
  }

  const styleByPrefixType: { [t in PrefixType]: Style } = {
    '': styles.default,
    R: styles.refrain,
    '#': styles.verse,
    Coda: styles.coda
  }

  const lastIndex = song.stanzas.length - 1
  song.stanzas.forEach((stanza, index) => {
    const style = styleByPrefixType[stanza.prefixType]
    const contentX = style.widthOf(`${stanza.prefix} A`) - style.widthOf('A')
    const width = page.displayWidth - contentX
    elements.push({ x: 0, y: y, text: stanza.prefix, style })

    for (const line of stanza.lines) {
      const transformedLine =
        style.case === 'capitalized'
          ? line.toLocaleLowerCase().replace(/^./, (x) => x.toLocaleUpperCase())
          : style.case === 'upper'
          ? line.toLocaleUpperCase()
          : style.case === 'lower'
          ? line.toLocaleLowerCase()
          : line
      try {
        y = format_element(
          elements,
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
    }

    if (index != lastIndex) y += styles.chunkGap
  })

  return { height: y, elements }
}

function toStyle(definition: StyleDefinition, font: PDFFont): Style {
  return {
    font: font,
    size: 12,
    case: 'capitalized',
    widthOf: (text) => font.widthOfTextAtSize(text, 12),
    height: font.heightAtSize(12)
  }
}

async function toFormat(pdfDoc: PDFDocument, formatDefinition: FormatDefinition): Promise<Format> {
  const fonts: { [k: string]: PDFFont } = {}

  fonts[formatDefinition.default.font] ??= await pdfDoc.embedFont(formatDefinition.default.font)
  fonts[formatDefinition.title.font] ??= await pdfDoc.embedFont(formatDefinition.title.font)
  fonts[formatDefinition.refrain.font] ??= await pdfDoc.embedFont(formatDefinition.refrain.font)
  fonts[formatDefinition.verse.font] ??= await pdfDoc.embedFont(formatDefinition.verse.font)
  fonts[formatDefinition.coda.font] ??= await pdfDoc.embedFont(formatDefinition.coda.font)

  return {
    default: toStyle(formatDefinition.default, fonts[formatDefinition.default.font]),
    title: toStyle(formatDefinition.title, fonts[formatDefinition.title.font]),
    refrain: toStyle(formatDefinition.refrain, fonts[formatDefinition.refrain.font]),
    verse: toStyle(formatDefinition.verse, fonts[formatDefinition.verse.font]),
    coda: toStyle(formatDefinition.coda, fonts[formatDefinition.coda.font]),
    chunkGap: formatDefinition.chunkGap
  }
}

/** Return base64 encoded pdf */
export async function generate(
  pageFormat: PageFormat,
  formatDefinition: FormatDefinition,
  parsed_songs: Song[]
): Promise<string> {
  pageFormat = {
    ...pageFormat,
    displayWidth: pageFormat.pageWidth - pageFormat.marginLeft - pageFormat.marginRight,
    displayHeight: pageFormat.pageHeight - pageFormat.marginTop - pageFormat.marginBottom
  }

  // PDF Creation
  const pdfDoc = await PDFDocument.create()
  const format: Format = await toFormat(pdfDoc, formatDefinition)
  const formatted_songs = parsed_songs.map((it) => format_song(pageFormat, format, it))

  const lineMargin = 3
  const lineThickness = 1
  const separator_height = 2 * lineMargin + lineThickness

  // Do some bin-packing (songs may be reordered)
  const errors: string[] = []
  const bins = bin_packing(
    formatted_songs.map((it) => ({ size: it.height + separator_height, song: it })),
    pageFormat.displayHeight + separator_height,
    2,
    errors
  )

  // Renumber each songs.
  let song_num = 0
  bins.forEach((bin) =>
    bin.objs.forEach((song) => {
      const title = song.song.elements[0]
      title.text = title.text.replace(/^000/, (++song_num).toString())
    })
  )

  console.log(formatted_songs)
  console.log(bins)
  for (const bin of bins) {
    const page = pdfDoc.addPage([pageFormat.pageWidth, pageFormat.pageHeight])
    const songs = bin.objs.map((it) => it.song)

    let cursorY = pageFormat.pageHeight - pageFormat.marginTop
    for (const [i, song] of songs.entries()) {
      for (const element of song.elements) {
        page.drawText(element.text, {
          x: pageFormat.marginLeft + element.x,
          y: cursorY - element.y - element.style.height,
          size: element.style.size,
          font: element.style.font
        })
      }

      if (i !== songs.length - 1) {
        cursorY -= song.height

        cursorY -= lineMargin + lineThickness
        page.drawLine({
          start: { x: pageFormat.marginLeft, y: cursorY },
          end: { x: pageFormat.marginLeft + pageFormat.displayWidth, y: cursorY },
          thickness: lineThickness,
          opacity: 0.3
        })
        cursorY -= lineMargin
      }
    }
  }
  console.log('terminated')

  const pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true })
  return pdfDataUri
  // const element = document.getElementById('pdf')
  // if (element instanceof HTMLIFrameElement) {
  //   element.src = pdfDataUri
  // }
  // const pdfBytes = await pdfDoc.save();
}
