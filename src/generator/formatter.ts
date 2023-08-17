import { PDFDocument, PDFFont, PDFPage, StandardFonts } from 'pdf-lib'
import type { Bin, ObjectToPack } from './bin-packing-2'
import * as Packing from './bin-packing-2'
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
    size: 11,
    toUpper: false,
    interLine: 2,
    afterParagraph: 6
  },
  title: {
    font: StandardFonts.TimesRomanBold,
    size: 10,
    toUpper: true,
    interLine: 2,
    afterParagraph: 6
  },
  refrain: {
    font: StandardFonts.TimesRomanBold,
    size: 11,
    toUpper: false,
    interLine: 2,
    afterParagraph: 6
  },
  verse: {
    font: StandardFonts.TimesRoman,
    size: 11,
    toUpper: false,
    interLine: 2,
    afterParagraph: 6
  },
  coda: {
    font: StandardFonts.TimesRomanBold,
    size: 11,
    toUpper: false,
    interLine: 2,
    afterParagraph: 6
  },
  bridge: {
    font: StandardFonts.TimesRomanBold,
    size: 11,
    toUpper: false,
    interLine: 2,
    afterParagraph: 6
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

  /** In unity */
  columns: number
  gutterLeftMargin: number
  gutterRightMargin: number
  /** Always in points */
  gutterSeparatorThickness: number

  displayWidth: number
  displayHeight: number
  columnWidth: number

  wrapAlineaWidth: number
  titleSeparator: string
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
    const gutterLeftMargin = f(page.gutterLeftMargin)
    const gutterRightMargin = f(page.gutterRightMargin)

    const gutterSeparatorThickness = page.gutterSeparatorThickness

    const displayWidth = pageWidth - marginLeft - marginRight
    const displayHeight = pageHeight - marginTop - marginBottom
    const gutterWidth = gutterLeftMargin + gutterRightMargin + gutterSeparatorThickness
    const columnWidth = (displayWidth - (page.columns - 1) * gutterWidth) / page.columns

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
      columnWidth,
      columns: page.columns,
      gutterLeftMargin,
      gutterRightMargin,
      gutterSeparatorThickness,

      wrapAlineaWidth: f(page.wrapAlineaWidth),
      titleSeparator: page.titleSeparator
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

export type FormattedChunk = {
  type: 'chunk'
  height: number
  marginBottom: number
  elements: FormattedText[]
}

export type FormattedSeparator = {
  type: 'separator'
  height: number
  separatorStyle: SeparatorStyle
}

export type FormattedBlank = {
  type: 'blank'
  height: number
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
  elements: FormattedChunk[]
  song: Song
}

function splitOn(
  regex: RegExp,
  text: string,
  fits: (s: string) => boolean,
  limit_1: boolean
): undefined | string[] {
  if (fits(text)) {
    return [text]
  }
  text.search(regex)
  const res: string[] = []
  const splitIndexes = [...text.matchAll(regex)].map((it) => it.index! + it[0].length)
  splitIndexes.push(text.length)
  let curr
  let fromTextIndex = 0
  let toSplitIndex = 0
  while (toSplitIndex < splitIndexes.length) {
    const t1 = text.substring(fromTextIndex, splitIndexes[toSplitIndex]).trim()
    if (fits(t1)) {
      curr = t1
      toSplitIndex++
    } else if (curr) {
      res.push(curr)
      fromTextIndex = splitIndexes[toSplitIndex - 1]
      const rest = text.substring(fromTextIndex).trim()
      if (fits(rest) || limit_1) {
        res.push(rest)
        return res
      }
    } else {
      return undefined // cannot split the text
    }
  }

  return undefined
}

function splitSimple(
  text: string,
  fitsFirstLine: (s: string) => boolean,
  fitsOtherLines: (s: string) => boolean
): string[] {
  const firstSplit = splitOn(/ /g, text, fitsFirstLine, true)
  if (!firstSplit) {
    throw Error(`Cannot split ${text}`)
  }
  if (firstSplit.length === 1) return firstSplit
  const [line1, rest] = firstSplit

  const otherSplit = splitOn(/ /g, rest, fitsOtherLines, false)
  if (!otherSplit) {
    throw Error(`Cannot split ${text}`)
  }
  return [line1, ...otherSplit]
}

function splitOnPonctuationIfPossible(
  text: string,
  fitsFirstLine: (s: string) => boolean,
  fitsOtherLines: (s: string) => boolean
): string[] {
  const firstSplit =
    splitOn(/[,?;.:!"»]+ +/g, text, fitsFirstLine, true) || splitOn(/ /g, text, fitsFirstLine, true)
  if (!firstSplit) {
    throw Error(`Cannot split ${text}`)
  }
  if (firstSplit.length === 1) return firstSplit

  const [line1, rest] = firstSplit
  const res = [line1]
  text = rest
  while (true) {
    const split =
      splitOn(/[,?;.:!"»]+ +/g, text, fitsOtherLines, true) ||
      splitOn(/ /g, text, fitsOtherLines, true)
    if (!split) {
      throw Error(`Cannot split ${text}`)
    }
    res.push(split[0])
    if (split.length <= 1) return res
    text = split[1]
  }
}

function split_text(
  text: string,
  style: Style,
  maxWidth: number,
  alineaMaxWidth: number
): string[] {
  const fitsFirstLine = (s: string) => style.widthOf(s) <= maxWidth
  const fitsOtherLines = (s: string) => style.widthOf(s) <= alineaMaxWidth

  const res1 = splitSimple(text, fitsFirstLine, fitsOtherLines)
  const res2 = splitOnPonctuationIfPossible(text, fitsFirstLine, fitsOtherLines)
  return res1.length < res2.length ? res1 : res2
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
  y: number,
  alignWrappedToRight: boolean = false
): number {
  const alineaMaxWidth = maxWidth - (alineaX - x)
  const lines = split_text(text, style, maxWidth, alineaMaxWidth)
  elements.push({ x, y, text: lines[0], style })
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    y += style.height + style.interLine
    if (alignWrappedToRight) {
      elements.push({ x: x + maxWidth - style.widthOf(line), y, text: line, style })
    } else {
      elements.push({ x: alineaX, y, text: line, style })
    }
  }
  y += style.height
  return y
}

function format_song(
  page: PageFormat,
  styles: Format,
  titlePrefixFormat: string,
  song: Song
): FormattedSong {
  const elements: FormattedChunk[] = []
  let subElements: FormattedText[] = []
  let y: number = 0
  try {
    const transformedLine = styles.title.toUpper ? song.title.toLocaleUpperCase() : song.title
    y = format_element(
      subElements,
      titlePrefixFormat + transformedLine,
      page.columnWidth,
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
    const width = page.columnWidth - contentX
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
      type: 'chunk',
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

export type PackedElement = FormattedChunk | FormattedSeparator | FormattedBlank
export type PackedPage = Bin<FormattedSong, PackedElement>

export type PackingMethod = 'linear-no-split' | 'linear-split' | 'auto'

export async function generate_bins(
  pageFormat: PageFormat,
  oddFirstPage: boolean,
  formatDefinition: FormatDefinition,
  separatorStyle: SeparatorStyle,
  parsed_songs: Song[],
  packingMethod: PackingMethod,

  errorsOut: string[]
): Promise<[PDFDocument, Format, PackedPage[]]> {
  // PDF Creation
  const pdfDoc = await PDFDocument.create()
  const format: Format = await toFormat(pdfDoc, formatDefinition)
  const titlePrefixFormat = // something like '000 - ' to guess the numerotation length.
    new Array(Math.floor(Math.log10(parsed_songs.length)) + 1).fill('0').join('') +
    (pageFormat.titleSeparator ? ' - ' : ' ')
  const formatted_songs: FormattedSong[] = parsed_songs.map((it) =>
    format_song(pageFormat, format, titlePrefixFormat, it)
  )

  const { lineMarginTop, lineMarginBottom, lineThickness } = separatorStyle
  const separator: FormattedSeparator = {
    type: 'separator',
    height: lineMarginTop + lineMarginBottom + lineThickness,
    separatorStyle: separatorStyle
  }

  // Do some bin-packing (songs may be reordered)
  const packingFunction =
    packingMethod === 'linear-split'
      ? Packing.force_push_packing
      : packingMethod === 'linear-no-split'
      ? Packing.naive_packing
      : Packing.packing1

  // Double the number of columns (this simulate having pages side to side)
  const initialBins = new Packing.BinSet<FormattedSong, PackedElement>({
    binCapacities: new Array(pageFormat.columns * 2).fill(pageFormat.displayHeight),
    separator: { size: separator.height, objChunk: separator }
  })
  if (oddFirstPage) {
    // Remove the first "left" page... that does not exists.
    const blankPage: FormattedBlank[] = [{ type: 'blank', height: pageFormat.displayHeight }]
    const bin = initialBins.bins[0] ?? initialBins.newBin()
    for (let i = 0; i < pageFormat.columns; i++) {
      bin.columns[i] = 0
      bin.elementsByColumn[i] = blankPage
    }
    bin.currentColumn = pageFormat.columns
    bin.totalRemaining = pageFormat.displayHeight * pageFormat.columns
  }

  const bins: PackedPage[] = packingFunction<FormattedSong, PackedElement>(
    formatted_songs.map(
      (song): ObjectToPack<FormattedSong, FormattedChunk> => ({
        size: song.height,
        elements: song.elements.map((it) => ({
          size: it.height + it.marginBottom,
          objChunk: it
        })),
        obj: song
      })
    ),
    initialBins
  )

  return [pdfDoc, format, bins]
}

export function renumber_songs(bins: PackedPage[]) {
  let song_num = 0
  bins.forEach((bin) =>
    bin.objectsByColumn.forEach((column) =>
      column.forEach((song) => {
        const title = song.obj.elements[0].elements[0]
        title.text = title.text.replace(/^0+/, (++song_num).toString())
        song.obj.song.number = song_num
      })
    )
  )
}

/** Append bin contents to pdfDoc with the given format. */
export async function generate_pdf(
  pdfDoc: PDFDocument,
  pageFormat: PageFormat,
  format: Format,
  separatorStyle: SeparatorStyle,
  bins: PackedPage[]
) {
  const { gutterLeftMargin, gutterRightMargin, gutterSeparatorThickness, columnWidth } = pageFormat
  const gutterWidth = gutterLeftMargin + gutterRightMargin + gutterSeparatorThickness

  // PDF Creation
  const { lineMarginTop, lineThickness } = separatorStyle

  for (const bin of bins) {
    let currentPage: PDFPage | undefined
    for (const columnsByPage of [
      bin.elementsByColumn.slice(0, pageFormat.columns),
      bin.elementsByColumn.slice(pageFormat.columns)
    ]) {
      // Skip blank pages.
      if (columnsByPage.every((chunks) => chunks.every((it) => it.type === 'blank'))) {
        continue
      }
      currentPage = pdfDoc.addPage([pageFormat.pageWidth, pageFormat.pageHeight])
      let cursorX = pageFormat.marginLeft
      for (const [columnIndex, columnChunks] of columnsByPage.entries()) {
        // New column
        let cursorY = pageFormat.pageHeight - pageFormat.marginTop
        let lastTextMargin = 0 // To be removed before drawing a separator
        for (const chunk of columnChunks) {
          if (chunk.type === 'chunk') {
            for (const element of chunk.elements) {
              currentPage.drawText(element.text, {
                x: cursorX + element.x,
                y: cursorY - element.y - element.style.height,
                font: element.style.font,
                size: element.style.size
              })
            }
            lastTextMargin = chunk.marginBottom
            cursorY -= chunk.height + chunk.marginBottom
          } else {
            cursorY += lastTextMargin // Erase last margin
            lastTextMargin = 0
            const y = cursorY - lineMarginTop + lineThickness / 2
            currentPage.drawLine({
              start: { x: cursorX, y },
              end: { x: cursorX + columnWidth, y },
              thickness: lineThickness,
              opacity: 0.3
            })
            cursorY -= chunk.height
          }
        }

        // draw column separator
        if (columnIndex !== columnsByPage.length - 1) {
          cursorX += columnWidth
          const gutterX = cursorX + gutterLeftMargin
          currentPage.drawLine({
            start: { x: gutterX, y: pageFormat.pageHeight - pageFormat.marginTop },
            end: { x: gutterX, y: pageFormat.marginBottom },
            thickness: gutterSeparatorThickness,
            opacity: 0.5
          })

          cursorX += gutterWidth
        }
      }
    }

    // Print last song number in the bottom-right corner
    if (bin.elementsByColumn[bin.elementsByColumn.length - 1].length > 0) {
      const objects = bin.objectsByColumn.flatMap((it) => it)
      const num = objects[objects.length - 1].obj.song.number!.toString()
      currentPage?.drawText(num, {
        x: pageFormat.pageWidth - pageFormat.marginRight - format.default.widthOf(num),
        y: pageFormat.marginBottom,
        font: format.default.font,
        size: format.default.size
      })
    }
  }
}
