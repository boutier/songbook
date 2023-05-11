import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
  type IParagraphStyleOptions
} from 'docx'
import type { IParagraphStylePropertiesOptions } from 'docx/build/file/paragraph/properties'
import FileSaver from 'file-saver'
import type { FormatDefinition, PackedPage, PageFormat, StyleDefinition } from './formatter'
import type { PrefixType, Stanza } from './parser'
import { mmToPoints } from './pdf-utils'
import { capitalize } from './utils'

function pointsToTwip(points: number): number {
  return 20 * points
}

function styleToDocxStyle(id: string, style: StyleDefinition): IParagraphStyleOptions {
  return {
    id: id,
    name: capitalize(id),
    run: {
      size: `${style.size}pt`,
      bold: style.font.includes('Bold'),
      italics: style.font.includes('Italic') || style.font.includes('Oblique')
    },
    paragraph: {
      spacing: { after: pointsToTwip(style.afterParagraph) },
      indent: { left: 0, right: 0, start: 0, end: 0 }
    }
  }

  // {
  //   id: 'aside',
  //   name: 'Aside',
  //   basedOn: 'Normal',
  //   next: 'Normal',
  //   run: {
  //     color: '999999',
  //     italics: true
  //   },
  //   paragraph: {
  //     indent: {
  //       left: convertInchesToTwip(0.5)
  //     },
  //     spacing: {
  //       line: 276
  //     }
  //   }
  // },
}

export async function exportDocx(
  pageFormat: PageFormat,
  format: FormatDefinition,
  bins: PackedPage[]
) {
  const styleByPrefixType: { [t in PrefixType]: IParagraphStyleOptions } = {
    none: styleToDocxStyle('sb-default', format.default),
    refrain: styleToDocxStyle('sb-refrain', format.refrain),
    'numbered-verse': styleToDocxStyle('sb-verse', format.verse),
    coda: styleToDocxStyle('sb-coda', format.coda),
    bridge: styleToDocxStyle('sb-bridge', format.bridge)
  }

  const numberingByPrefixType: { [t in PrefixType]?: string } = {
    refrain: 'refrain',
    'numbered-verse': 'verse'
    // Coda: 'coda'
  }

  function numberingFromStanza(
    stanza: Stanza,
    songNumber: number
  ): IParagraphStylePropertiesOptions['numbering'] | undefined {
    const reference = numberingByPrefixType[stanza.prefixType]
    if (!reference) {
      return undefined
    }
    if (reference === 'verse') {
      return {
        reference: 'title',
        level: 1
      }
    }
    return {
      reference: reference,
      level: 0
    }
  }

  const contentSectionChildren = []
  let songNumber = 0
  for (const bin of bins) {
    for (const { obj } of bin.objects) {
      const song = obj.song
      ++songNumber
      contentSectionChildren.push(
        new Paragraph({
          text: song.title,
          heading: HeadingLevel.HEADING_1,
          numbering: {
            reference: 'title',
            level: 0
          }
        })
      )
      for (const stanza of song.stanzas) {
        const styleId = styleByPrefixType[stanza.prefixType].id

        contentSectionChildren.push(
          new Paragraph({
            style: styleId,
            children: stanza.lines.map((it, i) =>
              i === 0 ? new TextRun(it) : new TextRun({ text: it, break: 1 })
            ),
            numbering: numberingFromStanza(stanza, songNumber)
          })
        )
      }
    }
    contentSectionChildren.push(new Paragraph({ children: [new PageBreak()] }))
  }

  const doc = new Document({
    creator: 'song-book generator',
    title: 'Carnet de chant',
    description: 'Carnet de chant au format docx',
    styles: {
      default: {
        heading1: {
          run: {
            size: `${format.title.size}pt`,
            bold: format.title.font.includes('Bold'),
            italics: format.title.font.includes('Italic') || format.title.font.includes('Oblique'),
            color: '000000'
          },
          paragraph: {
            spacing: {
              after: pointsToTwip(format.title.afterParagraph)
            },
            indent: { left: 0, right: 0, start: 0, end: 0 }
          }
        }
      },
      paragraphStyles: Object.values(styleByPrefixType)

      //   characterStyles: [
      //     {
      //       id: 'strikeUnderlineCharacter',
      //       name: 'Strike Underline',
      //       basedOn: 'Normal',
      //       quickFormat: true,
      //       run: {
      //         strike: true,
      //         underline: {
      //           type: UnderlineType.SINGLE
      //         }
      //       }
      //     }
      //   ]
    },
    numbering: {
      config: [
        {
          reference: 'title',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1 —',
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { hanging: pointsToTwip(mmToPoints(7)) }
                }
              }
            },
            {
              // I'm unable to have a separate 'verse' numbering because I'm unable to reset the numbering.
              level: 1,
              format: LevelFormat.DECIMAL,
              text: '%2.',
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { hanging: pointsToTwip(mmToPoints(5)) }
                }
              }
            }
          ]
        },
        {
          reference: 'refrain',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: 'R.',
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { hanging: pointsToTwip(mmToPoints(5)) }
                }
              }
            }
          ]
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: pointsToTwip(pageFormat.marginTop),
              right: pointsToTwip(pageFormat.marginRight),
              bottom: pointsToTwip(pageFormat.marginBottom),
              left: pointsToTwip(pageFormat.marginLeft)
            }
          }
        },
        children: contentSectionChildren
      }
    ]
  })

  const blob = await Packer.toBlob(doc)
  FileSaver.saveAs(blob, 'songs.docx')
}
