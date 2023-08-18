import FileSaver from 'file-saver'
import Papa from 'papaparse'
import type { PackedPage } from './formatter'

export async function exportIndexes(bins: PackedPage[]) {
  const indexByType: {
    [type: string]: {
      title: string
      number: number
    }[]
  } = {}
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

  Object.entries(indexByType).forEach(([type, index]) => {
    const titleKey = 'Titre'
    const numberKey = 'N°'
    const tmp = index.map((it) => ({ [titleKey]: it.title, [numberKey]: it.number }))
    const csv = Papa.unparse(tmp)
    const blob = new Blob([csv], { type: 'plain/text' })
    FileSaver.saveAs(blob, `index-${type}.csv`)
  })
}
