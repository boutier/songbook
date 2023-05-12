import { PDFPage, StandardFonts, degrees, type PDFDocument } from 'pdf-lib'
import {
  format_element,
  toFormat,
  type FormattedText,
  type PageFormat,
  type StyleDefinition
} from './formatter'
import type { Song } from './parser'
import { capitalize } from './utils'

function removeDiacritics(str: string) {
  // From https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
  // Note: use NFKD if you want things like \uFB01(ﬁ) normalized (to fi).
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export type TableOfContentFormatDefinition = {
  header: StyleDefinition
  oddTitle: StyleDefinition
  evenTitle: StyleDefinition
  otherFields: StyleDefinition
}

export const DEFAULT_TABLE_OF_CONTENT_STYLES: TableOfContentFormatDefinition = {
  header: {
    font: StandardFonts.TimesRomanBold,
    size: 9,
    toUpper: false,
    interLine: 0,
    afterParagraph: 0
  },
  oddTitle: {
    font: StandardFonts.TimesRomanBold,
    size: 8,
    toUpper: false,
    interLine: 0,
    afterParagraph: 0
  },
  evenTitle: {
    font: StandardFonts.TimesRoman,
    size: 9,
    toUpper: false,
    interLine: 0,
    afterParagraph: 0
  },
  otherFields: {
    font: StandardFonts.TimesRoman,
    size: 9,
    toUpper: false,
    interLine: 0,
    afterParagraph: 0
  }
}

export async function append_table_of_content_to_pdf(
  pdfDoc: PDFDocument,
  pageFormat: PageFormat,
  formatDefinition: TableOfContentFormatDefinition,
  songs: Song[]
) {
  const tags = new Set<string>()
  songs.forEach((song) => song.tags.forEach((tag) => tags.add(tag)))
  const alphabetic_ordered_songs: Song[] = songs.sort((a, b) => a.title.localeCompare(b.title))

  const ordered_tags = ['louange', 'méditation', 'esprit-saint', 'marie', 'célébration'].filter(
    (it) => tags.has(it)
  )
  for (const tag in tags) {
    if (!ordered_tags.includes(tag)) {
      ordered_tags.push(tag)
    }
  }

  const formats = await toFormat(pdfDoc, formatDefinition)

  const headerFormat = formats.header
  const oddFormat = formats.oddTitle
  const evenFormat = formats.evenTitle
  const mainFormat = formats.otherFields
  const tagHeaders = [...tags].map((tag) => ({ text: tag, size: headerFormat.widthOf(tag) }))
  const widestTag = tagHeaders.reduce((acc, it) => Math.max(acc, it.size), 0)

  const headerLineMargin = 1
  const headerLineThickness = 1
  // titleNumber is something like '000' to guess the N° length.
  const titleNumber = new Array(Math.floor(Math.log10(songs.length)) + 1).fill('0').join('')
  const numberWidth = Math.max(
    headerFormat.widthOf('N°'),
    oddFormat.widthOf(titleNumber),
    evenFormat.widthOf(titleNumber)
  )
  const markShiftForCentering = (headerFormat.height - evenFormat.widthOf('+')) / 2

  const { gutterLeftMargin, gutterRightMargin, gutterSeparatorThickness, columnWidth } = pageFormat
  const gutterWidth = gutterLeftMargin + gutterRightMargin + gutterSeparatorThickness

  // Helper to create headers on each new page
  const pageCursorY = pageFormat.pageHeight - pageFormat.marginTop
  const newPage = () => {
    const page = pdfDoc.addPage([pageFormat.pageWidth, pageFormat.pageHeight])
    let cursorY = pageCursorY
    let cursorX = pageFormat.marginLeft

    return [page, cursorX, cursorY] as const
  }

  const drawVerticalLine = (page: PDFPage, x: number, thickness: number, opacity: number) => {
    page.drawLine({
      start: { x: x, y: pageFormat.pageHeight - pageFormat.marginTop },
      end: { x: x, y: pageFormat.marginBottom },
      thickness: thickness,
      opacity: 0.5
    })
  }

  const drawHeaders = (page: PDFPage, cursorX: number, cursorY: number) => {
    const originX = cursorX
    cursorY -= widestTag

    // Tags
    tagHeaders.forEach((header) => {
      cursorX += headerFormat.height
      page.drawText(capitalize(header.text), {
        x: cursorX - headerFormat.height / 6,
        y: cursorY,
        size: headerFormat.size,
        font: headerFormat.font,
        rotate: degrees(90)
      })

      cursorX += headerLineMargin
      drawVerticalLine(page, cursorX, 0.3, 0.1)
      cursorX += headerLineThickness
      cursorX += headerLineMargin
    })

    // Song number
    page.drawText('N°', {
      x: cursorX,
      y: cursorY,
      size: headerFormat.size,
      font: headerFormat.font
    })

    cursorX += numberWidth
    cursorX += headerLineMargin
    drawVerticalLine(page, cursorX, 0.3, 0.1)
    cursorX += headerLineThickness
    cursorX += headerLineMargin

    // Song number
    const maxTitleWidth = columnWidth - cursorX + originX
    page.drawText('Titre', {
      x: cursorX,
      y: cursorY,
      size: headerFormat.size,
      font: headerFormat.font
    })

    // Horizontal line
    const lineMarginTop = 1
    const lineMarginBottom = 1
    const lineThickness = 1
    cursorY -= lineMarginTop + lineThickness / 2
    page.drawLine({
      start: { x: originX, y: cursorY },
      end: { x: originX + columnWidth, y: cursorY },
      thickness: lineThickness
    })
    cursorY -= lineMarginBottom + lineThickness / 2

    return [cursorY, maxTitleWidth] as const
  }

  const drawColumnSeparator = (page: PDFPage, cursorX: number) => {
    drawVerticalLine(page, cursorX + gutterLeftMargin, gutterSeparatorThickness, 0.5)
    return cursorX + gutterWidth
  }

  // Ok, let's build the index!
  let prevLetter = ''
  let format = oddFormat
  let [page, cursorX, cursorY] = newPage()
  let maxTitleWidth: number
  ;[cursorY, maxTitleWidth] = drawHeaders(page, cursorX, cursorY)
  let stripped = false
  let currentColumn = 0
  alphabetic_ordered_songs.forEach((song) => {
    let cursorX = pageFormat.marginLeft + currentColumn * (columnWidth + gutterWidth)

    // Switch format on letter change
    const firstTitleLetter = removeDiacritics(song.title[0])
    if (prevLetter !== firstTitleLetter) {
      prevLetter = firstTitleLetter
      format = format === oddFormat ? evenFormat : oddFormat
    }

    const titleLines: FormattedText[] = []
    let titleHeight = format_element(
      titleLines,
      capitalize(song.title + (song.context ? ' ' + song.context : '')),
      maxTitleWidth,
      format,
      0,
      0,
      0
    )
    if (titleLines.length === 0) {
      console.warn('No title line?', song)
      titleLines.push({ x: 0, y: 0, style: format, text: '' })
      titleHeight = format.height
    }

    if (cursorY - titleHeight < pageFormat.marginBottom) {
      // New column or new page
      if (++currentColumn < pageFormat.columns) {
        cursorX = drawColumnSeparator(page, cursorX + columnWidth)
        cursorY = pageCursorY
      } else {
        currentColumn = 0
        ;[page, cursorX, cursorY] = newPage()
      }
      ;[cursorY, maxTitleWidth] = drawHeaders(page, cursorX, cursorY)
      stripped = false
    }

    // Stripped background
    if (stripped) {
      const totalHeight = format.height * titleLines.length
      /*
        Line height (without any margin) go from the baseline (bottom of
        letter 'A' for example) to the top of 'Ô'. We should extend it of
        ~20% to includes bottom of 'p'. For now, instead, we just shift
        the stripped background of 20% of the line height because there
        is less accents on upper-case letters than letters under the
        baseline.
      */
      page.drawRectangle({
        x: cursorX,
        y: cursorY - totalHeight - format.height / 5,
        width: columnWidth,
        height: totalHeight,
        opacity: 0.1
      })
      // page.drawLine({
      //   start: { x: pageFormat.marginLeft, y: cursorY },
      //   end: { x: pageFormat.marginLeft + pageFormat.displayWidth, y: cursorY },
      //   thickness: lineThickness
      // })
    }
    stripped = !stripped

    cursorY -= format.height

    // Tags
    tagHeaders.forEach((header) => {
      if (song.tags.includes(header.text))
        page.drawText('+', {
          x: cursorX + markShiftForCentering,
          y: cursorY,
          size: mainFormat.size,
          font: mainFormat.font
        })

      cursorX += mainFormat.height
      cursorX += headerLineMargin
      cursorX += headerLineThickness
      cursorX += headerLineMargin
    })

    // Song number
    page.drawText(song.number!.toString(), {
      x: cursorX,
      y: cursorY,
      size: mainFormat.size,
      font: mainFormat.font
    })

    cursorX += numberWidth
    cursorX += headerLineMargin
    cursorX += headerLineThickness
    cursorX += headerLineMargin

    // Song number
    titleLines.forEach((line, index) =>
      page.drawText(line.text, {
        x: cursorX + (index && pageFormat.wrapAlineaWidth),
        y: cursorY - line.y,
        size: format.size,
        font: format.font
      })
    )
    cursorY -= titleHeight - format.height
  })
}
