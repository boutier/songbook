import { PageSizes, PDFDocument, PDFFont, StandardFonts } from 'pdf-lib'
import { bin_packing } from './bin-packing'
import { RAW_DATA } from './data-real'

const POINTS_PER_INCH = 72 // 1 inch = 72 pts
const MM_PER_INCH = 25.4 // 1 inch = 25.4 mm

export function mmToPoints(mm: number) {
  return (mm * POINTS_PER_INCH) / MM_PER_INCH
}

export function mmFromPoints(pts: number) {
  return (pts * MM_PER_INCH) / POINTS_PER_INCH
}

function err(e: string): any {
  throw Error(e)
}

type Song = {
  title: string
  stanzas: Stanza[]
  tags: string[]
}

type PrefixType = 'R' | '#' | 'Coda' | ''

type Stanza = {
  prefixType: PrefixType
  prefix: string
  lines: string[]
}

/** Lines should have been reversed. */
function next_non_empty(lines: string[]): string | undefined {
  let line: string | undefined
  do {
    line = lines.pop()
  } while (line?.length === 0)
  return line
}

function parse_next_stanza(lines: string[]): Stanza | undefined {
  const stanza: Stanza = {
    prefix: '',
    prefixType: '',
    lines: []
  }

  let line = next_non_empty(lines)
  if (!line) {
    return undefined
  }

  for (; line && line.length > 0; line = lines.pop()) {
    // First line determine paragraph type.
    const m = line.match(
      /^((?<num>[0-9]+)|(?<r>[r])|(?<coda>coda)|(?<other>[^a-z]+))\s*[.:/]\s*(?<text>.*)/i
    ) as null | {
      groups: { num?: string; r?: string; coda?: string; other?: string; text: string }
    }
    if (m) {
      if (stanza.lines.length > 0) {
        // paragraph change
        lines.push(line)
        break
      }

      const { num, r, coda, other, text } = m.groups
      if (r) {
        stanza.prefixType = 'R'
        stanza.prefix = 'R.'
      } else if (num) {
        stanza.prefixType = '#'
        stanza.prefix = num // Rewritten afterwards
      } else if (coda) {
        stanza.prefixType = 'Coda'
        stanza.prefix = 'Coda'
      } else if (other) {
        stanza.prefixType = ''
        stanza.prefix = other
      }
      const trimmed_text = text.trim()
      if (trimmed_text) stanza.lines.push(trimmed_text)
    } else {
      stanza.lines.push(line)
    }
  }
  return stanza
}

function parse_comment(tags: string[], line: string) {
  line
    .split(/type\s+:/, 1)[1]
    ?.split(/[\s,;]+/)
    ?.forEach((tag) => tags.push(tag))
}

function parse_song(text: string): Song {
  const tags: string[] = []
  const lines = text
    .trim()
    .split(/\s*[\n\u2028\u2029]\s*/)
    .filter((line) => {
      if (line.match(/\s*#/)) {
        parse_comment(tags, line)
        return false
      }
      return true
    })
    .reverse() // To use pop()

  const song: Song = {
    title: next_non_empty(lines) ?? err('Empty song'),
    stanzas: [],
    tags: tags
  }

  let stanza: Stanza | undefined
  while ((stanza = parse_next_stanza(lines))) {
    song.stanzas.push(stanza)
  }

  let stanzaNum = 1
  song.stanzas.forEach((it) => {
    if (it.prefixType === '#') it.prefix = `${stanzaNum++}.`
  })
  return song
}

function parse_file(file: string): Song[] {
  const songs = file
    .replace(/[’´\t]/g, (c) => (c === '\t' ? '' : "'"))
    .replace(/\s+([!?;:])/g, ' $1')
    .split(/[0-9]+\s*[-—–]/)
    .map((it) => it.trim())
    .filter((it) => !!it)
  return songs.map((it) => parse_song(it))
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
    return {
      unit: unit,
      pageWidth: f(page.pageWidth),
      pageHeight: f(page.pageHeight),
      marginTop: f(page.marginTop),
      marginRight: f(page.marginRight),
      marginBottom: f(page.marginBottom),
      marginLeft: f(page.marginLeft),
      displayWidth: f(page.displayWidth),
      displayHeight: f(page.displayHeight),
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
      if (i <= 0) throw Error(`cannot split ${text}`)
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
  let y = format_element(
    elements,
    '000 — ' + song.title,
    page.displayWidth,
    styles.title,
    0,
    page.wrapAlineaWidth,
    0
  )

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
        console.error(`${song.title} at stanza ${index}:`, line)
        throw e
      }
    }

    if (index != lastIndex) y += styles.chunkGap
  })

  return { height: y, elements }
}

export async function generate() {
  // PDF Creation
  const pdfDoc = await PDFDocument.create()
  const pageWidth = PageSizes.A4[0] / 2
  const pageHeight = PageSizes.A4[1]
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

  const margin = mmToPoints(5)
  const pageFormat: PageFormat = {
    unit: 'pts',

    pageWidth: pageWidth,
    pageHeight: pageHeight,

    marginTop: margin,
    marginRight: margin,
    marginBottom: margin,
    marginLeft: margin,

    displayWidth: pageWidth - 2 * margin,
    displayHeight: pageHeight - 2 * margin,

    wrapAlineaWidth: mmToPoints(10)
  }

  const format: Format = {
    default: {
      font: font,
      size: 12,
      case: 'capitalized',
      widthOf: (text) => font.widthOfTextAtSize(text, 12),
      height: font.heightAtSize(12)
    },
    title: {
      font: fontBold,
      size: 14,
      case: 'capitalized',
      widthOf: (text) => font.widthOfTextAtSize(text, 16),
      height: font.heightAtSize(16)
    },
    refrain: {
      font: fontBold,
      size: 12,
      case: 'capitalized',
      widthOf: (text) => font.widthOfTextAtSize(text, 12),
      height: font.heightAtSize(12)
    },
    verse: {
      font: font,
      size: 12,
      case: 'capitalized',
      widthOf: (text) => font.widthOfTextAtSize(text, 12),
      height: font.heightAtSize(12)
    },
    coda: {
      font: font,
      size: 12,
      case: 'capitalized',
      widthOf: (text) => font.widthOfTextAtSize(text, 12),
      height: font.heightAtSize(12)
    },
    chunkGap: 10
  }

  const parsed_songs = parse_file(RAW_DATA)
  const formatted_songs = parsed_songs.map((it) => format_song(pageFormat, format, it))

  const lineMargin = 3
  const lineThickness = 1
  const separator_height = 2 * lineMargin + lineThickness

  // Here, do some bin-packing
  // const bins = naive_packing(
  //   formatted_songs.map((it) => ({ size: it.height + separator_height, song: it })),
  //   pageFormat.displayHeight + separator_height
  // )

  const errors: string[] = []
  const bins = bin_packing(
    formatted_songs.map((it) => ({ size: it.height + separator_height, song: it })),
    pageFormat.displayHeight + separator_height,
    2,
    errors
  )

  // Renumber songs
  // formatted_songs.forEach((song, index) => {
  //   const title = song.elements[0]
  //   title.text = title.text.replace(/^000/, index.toString())
  // })

  console.log('chants:', formatted_songs.length)

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
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    const songs = bin.objs.map((it) => it.song)

    let cursorY = pageFormat.pageHeight - margin
    for (const [i, song] of songs.entries()) {
      for (const element of song.elements) {
        page.drawText(element.text, {
          x: margin + element.x,
          y: cursorY - element.y - element.style.height,
          size: element.style.size,
          font: element.style.font
        })
      }

      if (i !== songs.length - 1) {
        cursorY -= song.height

        cursorY -= lineMargin + lineThickness
        page.drawLine({
          start: { x: margin, y: cursorY },
          end: { x: margin + pageFormat.displayWidth, y: cursorY },
          thickness: lineThickness,
          opacity: 0.3
        })
        cursorY -= lineMargin
      }
    }
  }
  console.log('terminated')

  const pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true })
  const element = document.getElementById('pdf')
  if (element instanceof HTMLIFrameElement) {
    element.src = pdfDataUri
  }
  // const pdfBytes = await pdfDoc.save();
}
