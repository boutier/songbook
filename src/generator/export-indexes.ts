import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx'
import type { FileChild } from 'docx/build/file/file-child'
import FileSaver from 'file-saver'
import Papa from 'papaparse'
import type { PackedPage } from './formatter'
import { mmToPoints } from './pdf-utils'
import { capitalize } from './utils'

type IndexByType = {
  [type: string]: {
    title: string
    number: number
  }[]
}

export function buildIndexes(bins: PackedPage[]): IndexByType {
  const indexByType: IndexByType = {}
  for (const bin of bins) {
    for (const col of bin.objectsByColumn) {
      for (const toPack of col) {
        const song = toPack.obj.song
        for (const tag of song.tags) {
          if (song.number === undefined) {
            throw Error(`No number to song '${song.title}'`)
          }
          ;(indexByType[tag] ??= []).push({ title: song.title, number: song.number! })
        }
      }
    }
  }

  Object.values(indexByType).forEach((index) => {
    index.sort((a, b) => a.title.localeCompare(b.title))
  })

  return indexByType
}

const GROUPED_AND_ORDERED_INDEXES: [group: string, ordered_indexes: string[]][] = [
  ['Thèmes', ['louange', 'esprit-saint', 'méditation', 'adoration', 'marie', 'célébration']],
  [
    'Temps liturgiques',
    [
      'avent',
      'immaculée conception',
      'noël',
      'mère de dieu',
      'épiphanie',
      'carême',
      'rameaux',
      'jeudi saint',
      'pâques',
      'saint joseph',
      'annonciation',
      'visitation',
      'pentecôte',
      'sainte trinité',
      'corpus christi',
      'sacré-coeur',
      'assomption',
      'croix glorieuse',
      'toussaint',
      'christ-roi'
    ]
  ],
  ['Temps de la messe', ['ouverture', 'aspersion', 'offertoire', 'communion', 'envoi']],
  ['Autre', ['baptême', 'funérailles', 'rite pénitentiel']]
]

export function exportIndexesCsv(bins: PackedPage[]) {
  const titleKey = 'Titre'
  const numberKey = 'N°'

  const indexByType = buildIndexes(bins)

  Object.entries(indexByType).forEach(([type, index]) => {
    const tmp = index.map((it) => ({ [titleKey]: it.title, [numberKey]: it.number }))
    const csv = Papa.unparse(tmp)
    const blob = new Blob([csv], { type: 'plain/text' })
    FileSaver.saveAs(blob, `index-${type}.csv`)
  })
}

export async function exportIndexesDocx(bins: PackedPage[]) {
  const indexByType = buildIndexes(bins)

  const sectionChildren: FileChild[] = []

  console.log(Object.keys(indexByType))

  GROUPED_AND_ORDERED_INDEXES.forEach(([group, indexes], groupIndex) => {
    sectionChildren.push(new Paragraph({ text: group, heading: HeadingLevel.HEADING_1 }))

    indexes.forEach((indexType, i) => {
      const index = indexByType[indexType]
      sectionChildren.push(
        new Paragraph({
          children: [new TextRun({ text: capitalize(indexType) })],
          heading: HeadingLevel.HEADING_2
        })
      )

      sectionChildren.push(
        new Table({
          style: 'table',
          columnWidths: [20 * mmToPoints(70), 20 * mmToPoints(10)],
          borders: {
            top: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
          },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                new TableCell({
                  children: [new Paragraph('Titre (' + indexType + ')')],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE }
                  }
                }),
                new TableCell({
                  children: [new Paragraph('N°')],
                  borders: {
                    top: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE }
                  }
                })
              ]
            }),
            ...index.map(
              (it) =>
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 70, type: WidthType.DXA },
                      children: [new Paragraph(it.title)]
                    }),
                    new TableCell({
                      width: { size: 10, type: WidthType.DXA },
                      children: [new Paragraph(it.number.toString())]
                    })
                  ]
                })
            )
          ]
        })
      )
    })

    if (groupIndex !== GROUPED_AND_ORDERED_INDEXES.length - 1) {
      sectionChildren.push(new Paragraph({ children: [new PageBreak()] }))
    }
  })

  const doc = new Document({
    creator: 'song-book generator',
    title: 'Index thématique',
    styles: {
      default: {
        heading1: {
          run: {
            size: '16pt',
            color: '3275B3'
          },
          paragraph: {
            spacing: { before: 20 * 6, after: 20 * 4 },
            indent: { left: 0, right: 0, start: 0, end: 0 }
          }
        },
        heading2: {
          run: {
            size: '13pt',
            color: '3275B3'
          },
          paragraph: {
            spacing: { before: 20 * 4, after: 20 * 2 },
            indent: { left: 0, right: 0, start: 0, end: 0 }
          },
          next: 'table'
        }
      },
      paragraphStyles: [
        {
          id: 'table',
          name: 'Tableau',
          run: { size: '10pt' },
          paragraph: {
            spacing: { before: 0, after: 0 },
            indent: { left: 0, right: 0, start: 0, end: 0 }
          }
        }
      ]
    },
    sections: [
      {
        properties: { column: { count: 2 } },
        children: sectionChildren
      }
    ]
  })

  const blob = await Packer.toBlob(doc)
  FileSaver.saveAs(blob, 'index-thématique.docx')
}
