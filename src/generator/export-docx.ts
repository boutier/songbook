import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph
} from 'docx'
import type { IParagraphStylePropertiesOptions } from 'docx/build/file/paragraph/properties'
import FileSaver from 'file-saver'
import type { FormatDefinition, FormattedSong, PageFormat } from './formatter'
import type { PrefixType, Stanza } from './parser'
import { mmToPoints } from './pdf-utils'

function pointsToTwip(points: number): number {
  return 20 * points
}

export async function exportDocx(
  pageFormat: PageFormat,
  format: FormatDefinition,
  bins: { objs: { song: FormattedSong }[] }[]
) {
  const styleByPrefixType: { [t in PrefixType]: string } = {
    '': 'default',
    R: 'refrain',
    '#': 'verse',
    Coda: 'coda'
  }

  const numberingByPrefixType: { [t in PrefixType]?: string } = {
    R: 'refrain',
    '#': 'verse'
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
    for (const { song } of bin.objs) {
      ++songNumber
      contentSectionChildren.push(
        new Paragraph({
          text: song.song.title,
          heading: HeadingLevel.HEADING_1,
          numbering: {
            reference: 'title',
            level: 0
          }
        })
      )
      for (const stanza of song.song.stanzas) {
        const styleId = styleByPrefixType[stanza.prefixType]

        contentSectionChildren.push(
          new Paragraph({
            style: styleId,
            text: stanza.lines.join('\u2028'),
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
              after: pointsToTwip(format.chunkGap)
            },
            indent: { left: 0, right: 0, start: 0, end: 0 }
          }
        }
      },
      paragraphStyles: [
        {
          id: 'default',
          name: 'Default',
          run: {
            size: `${format.default.size}pt`,
            bold: format.default.font.includes('Bold'),
            italics:
              format.default.font.includes('Italic') || format.default.font.includes('Oblique')
          },
          paragraph: {
            spacing: { after: pointsToTwip(format.chunkGap) },
            indent: { left: 0, right: 0, start: 0, end: 0 }
          }
        },
        {
          id: 'refrain',
          name: 'Refrain',
          run: {
            size: `${format.refrain.size}pt`,
            bold: format.refrain.font.includes('Bold'),
            italics:
              format.refrain.font.includes('Italic') || format.refrain.font.includes('Oblique')
          },
          paragraph: {
            spacing: { after: pointsToTwip(format.chunkGap) },
            indent: { left: 0, right: 0, start: 0, end: 0 }
          }
        },
        {
          id: 'verse',
          name: 'Verse',
          run: {
            size: `${format.verse.size}pt`,
            bold: format.verse.font.includes('Bold'),
            italics: format.verse.font.includes('Italic') || format.verse.font.includes('Oblique')
          },
          paragraph: {
            spacing: { after: pointsToTwip(format.chunkGap) },
            indent: { left: 0, right: 0, start: 0, end: 0 }
          }
        },
        {
          id: 'coda',
          name: 'Coda',
          run: {
            size: `${format.coda.size}pt`,
            bold: format.coda.font.includes('Bold'),
            italics: format.coda.font.includes('Italic') || format.coda.font.includes('Oblique')
          },
          paragraph: {
            spacing: { after: pointsToTwip(format.chunkGap) },
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
      ]
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
