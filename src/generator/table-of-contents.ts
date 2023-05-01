import { degrees, type PDFDocument } from 'pdf-lib'
import type { Bin, Format, FormatDefinition, PageFormat } from './formatter'
import { toFormat } from './formatter'
import type { Song } from './parser'
import { capitalize } from './utils'

function removeDiacritics(str: string) {
  // From https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
  // Note: use NFKD if you want things like \uFB01(ﬁ) normalized (to fi).
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export async function append_table_of_content_to_pdf(
  pdfDoc: PDFDocument,
  pageFormat: PageFormat,
  formatDefinition: FormatDefinition,
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

  console.log(tags)
  const ordered_tags = ['louange', 'méditation', 'esprit-saint', 'marie', 'célébration'].filter(
    (it) => tags.has(it)
  )
  for (const tag in tags) {
    if (!ordered_tags.includes(tag)) {
      ordered_tags.push(tag)
    }
  }

  const format: Format = await toFormat(pdfDoc, formatDefinition)

  const headerFormat = format.verse
  const oddFormat = format.refrain
  const evenFormat = format.verse
  const mainFormat = evenFormat
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
    page.drawText('Titre', {
      x: cursorX,
      y: cursorY,
      size: headerFormat.size,
      font: headerFormat.font
    })

    cursorX += headerLineMargin
    cursorX += headerLineThickness
    cursorX += headerLineMargin

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

    return [page, cursorY] as const
  }

  let [page, cursorY] = newPageWithHeader()
  alphabetic_ordered_songs.forEach((song) => {
    let cursorX = pageFormat.marginLeft
    const format =
      (removeDiacritics(song.title[0]).charCodeAt(0) - 'A'.charCodeAt(0)) % 2 === 0
        ? evenFormat
        : oddFormat

    cursorY -= format.height
    if (cursorY < pageFormat.marginBottom) {
      ;[page, cursorY] = newPageWithHeader()
      cursorY -= format.height
    }

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
    page.drawText(capitalize(song.title), {
      x: cursorX,
      y: cursorY,
      size: format.size,
      font: format.font
    })

    cursorX += headerLineMargin
    cursorX += headerLineThickness
    cursorX += headerLineMargin
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
