import { StandardFonts, degrees, type PDFDocument } from 'pdf-lib'
import {
  format_element,
  toFormat,
  type Bin,
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
    size: 10,
    toUpper: false,
    interLine: 2,
    afterParagraph: 0
  },
  oddTitle: {
    font: StandardFonts.TimesRomanBold,
    size: 10,
    toUpper: false,
    interLine: 2,
    afterParagraph: 0
  },
  evenTitle: {
    font: StandardFonts.TimesRoman,
    size: 10,
    toUpper: false,
    interLine: 2,
    afterParagraph: 0
  },
  otherFields: {
    font: StandardFonts.TimesRoman,
    size: 10,
    toUpper: false,
    interLine: 2,
    afterParagraph: 0
  }
}

export async function append_table_of_content_to_pdf(
  pdfDoc: PDFDocument,
  pageFormat: PageFormat,
  formatDefinition: TableOfContentFormatDefinition,
  bins: Bin[]
) {
  const tags = new Set<string>()
  const alphabetic_ordered_songs: Song[] = bins
    .flatMap((bin) =>
      bin.objs.map((obj) => {
        const song = obj.song.song
        song.tags.forEach((tag) => tags.add(tag))
        return song
      })
    )
    .sort((a, b) => a.title.localeCompare(b.title))

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
  const numberWidth = Math.max(
    headerFormat.widthOf('N°'),
    oddFormat.widthOf('000'),
    evenFormat.widthOf('000')
  )
  const markShiftForCentering = (headerFormat.height - evenFormat.widthOf('+')) / 2

  // Helper to create headers on each new page
  const newPageWithHeader = () => {
    const page = pdfDoc.addPage([pageFormat.pageWidth, pageFormat.pageHeight])
    let cursorY = pageFormat.pageHeight - pageFormat.marginTop
    cursorY -= widestTag
    let cursorX = pageFormat.marginLeft

    // Tags
    tagHeaders.forEach((header) => {
      cursorX += headerFormat.height
      page.drawText(capitalize(header.text), {
        x: cursorX,
        y: cursorY,
        size: headerFormat.size,
        font: headerFormat.font,
        rotate: degrees(90)
      })

      cursorX += headerLineMargin
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
    cursorX += headerLineThickness
    cursorX += headerLineMargin

    // Song number
    const maxTitleWidth = pageFormat.displayWidth - cursorX + pageFormat.marginLeft
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
      start: { x: pageFormat.marginLeft, y: cursorY },
      end: { x: pageFormat.marginLeft + pageFormat.displayWidth, y: cursorY },
      thickness: lineThickness
    })
    cursorY -= lineMarginBottom + lineThickness / 2

    return [page, cursorY, maxTitleWidth] as const
  }

  // Ok, let's build the index!
  let prevLetter = ''
  let format = oddFormat
  let [page, cursorY, maxTitleWidth] = newPageWithHeader()
  alphabetic_ordered_songs.forEach((song) => {
    let cursorX = pageFormat.marginLeft

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
      ;[page, cursorY] = newPageWithHeader()
    }
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
    titleLines.forEach((line) =>
      page.drawText(line.text, {
        x: cursorX,
        y: cursorY - line.y,
        size: format.size,
        font: format.font
      })
    )
    cursorY -= titleHeight - format.height
  })

  return

  // for (const bin of bins) {
  //   const page = pdfDoc.addPage([pageFormat.pageWidth, pageFormat.pageHeight])
  //   const songs = bin.objs.map((it) => it.song)

  //   let cursorY = pageFormat.pageHeight - pageFormat.marginTop
  //   for (const [i, song] of songs.entries()) {
  //     for (const element of song.elements) {
  //       page.drawText(element.text, {
  //         x: pageFormat.marginLeft + element.x,
  //         y: cursorY - element.y - element.style.height,
  //         size: element.style.size,
  //         font: element.style.font
  //       })
  //     }

  //     if (i !== songs.length - 1) {
  //       cursorY -= song.height

  //       cursorY -= lineMarginTop + lineThickness / 2
  //       page.drawLine({
  //         start: { x: pageFormat.marginLeft, y: cursorY },
  //         end: { x: pageFormat.marginLeft + pageFormat.displayWidth, y: cursorY },
  //         thickness: lineThickness,
  //         opacity: 0.3
  //       })
  //       cursorY -= lineMarginBottom + lineThickness / 2
  //     }
  //   }
  // }
}
