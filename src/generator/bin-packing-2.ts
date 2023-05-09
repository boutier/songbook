export type ObjectToPack<T, TChunk> = {
  size: number
  taken?: boolean
  elements: { size: number; objChunk: TChunk }[]
  obj: T
}
/** A Bin may be defined as multiple columns (or pages). */
type BinDef<TChunk> = {
  binCapacities: number[]
  separator: { size: number; objChunk: TChunk }
}

export interface Bin<T, TChunk> {
  columns: number[]
  currentColumn: number
  totalRemaining: number
  /**
   * Objects to patch starting on this bin.
   * TODO: Or maybe just `T[]`?
   */
  objects: ObjectToPack<T, TChunk>[]
  elementsByColumn: TChunk[][]
}

namespace Bin {
  export function emptyBin(def: BinDef<unknown>): Bin<any, any> {
    return {
      columns: [...def.binCapacities],
      currentColumn: 0,
      totalRemaining: def.binCapacities.reduce((acc, it) => acc + it, 0),
      objects: [],
      elementsByColumn: def.binCapacities.map(() => [])
    }
  }

  export function resetRemaining<T, TChunk>(bin: Bin<T, TChunk>) {
    bin.totalRemaining = 0
    for (let i = bin.currentColumn; i < bin.columns.length; i++) {
      bin.totalRemaining += bin.columns[i]
    }
  }
}

export class BinSet<T, TChunk> {
  bins: Bin<T, TChunk>[] = []

  constructor(private def: BinDef<TChunk>) {
    if (def.binCapacities.some((it) => it !== def.binCapacities[0])) {
      throw new Error('Not supporting different column sizes')
    }
    this.bins.push(Bin.emptyBin(def))
  }

  newBin(): Bin<T, TChunk> {
    const newBin = Bin.emptyBin(this.def)
    this.bins.push(newBin)
    return newBin
  }

  lastBinIsEmpty(): boolean {
    const lastBin = this.bins[this.bins.length - 1]
    return lastBin.elementsByColumn[0].length === 0
  }

  add(obj: ObjectToPack<T, TChunk>, at = this.bins.length - 1): boolean {
    return this.addInColumn(obj, at) || this.addInColumns(obj, at)
  }

  addAndSplit(obj: ObjectToPack<T, TChunk>, at = this.bins.length - 1) {
    return this.addInColumn(obj, at) || this.forceAdd(obj)
  }

  private addInColumn(obj: ObjectToPack<T, TChunk>, binIndex: number): boolean {
    let bin = this.bins[binIndex]
    const prefixWithSeparator =
      bin.columns[bin.currentColumn] !== this.def.binCapacities[bin.currentColumn]
    const separatorSize = prefixWithSeparator ? this.def.separator.size : 0
    if (obj.size + separatorSize <= bin.columns[bin.currentColumn]) {
      // Fit in column
      bin.columns[bin.currentColumn] -= obj.size + separatorSize
      bin.objects.push(obj)
      if (prefixWithSeparator)
        bin.elementsByColumn[bin.currentColumn].push(this.def.separator.objChunk)
      obj.elements.forEach((it) => bin.elementsByColumn[bin.currentColumn].push(it.objChunk))
      Bin.resetRemaining(bin)
      return true
    }
    return false
  }

  private addInColumns(obj: ObjectToPack<T, TChunk>, binIndex: number): boolean {
    let bin = this.bins[binIndex]
    let prefixWithSeparator =
      bin.columns[bin.currentColumn] !== this.def.binCapacities[bin.currentColumn]
    if (obj.size <= bin.totalRemaining) {
      // May fit in all columns if splitted
      let i = bin.currentColumn
      const newColumns = [...bin.columns]
      const newElements = bin.elementsByColumn.map((it) => [...it])
      for (const el of obj.elements) {
        if (el.size <= newColumns[i]) {
          // Fit in current column
          if (prefixWithSeparator) {
            newColumns[i] -= this.def.separator.size
            newElements[i].push(this.def.separator.objChunk)
            prefixWithSeparator = false
          }
          newColumns[i] -= el.size
          newElements[i].push(el.objChunk)
        } else if (i < bin.columns.length - 1) {
          // Require a new column
          prefixWithSeparator = false
          ++i
          if (el.size <= newColumns[i]) {
            newColumns[i] -= el.size
            newElements[i].push(el.objChunk)
          } else {
            console.error('Chunk cannot fit in any column!', { obj: obj, chunk: el })
            return false
          }
        } else {
          // Not enough columns
          if (bin.columns[0] === this.def.binCapacities[0]) {
            // And the bin was empty!
            console.error('Cannot pack in any bin!', { obj: obj, chunk: el })
          }
          return false
        }
      }
      bin.currentColumn = i
      bin.columns = newColumns
      bin.elementsByColumn = newElements
      bin.objects.push(obj)
      Bin.resetRemaining(bin)
      return true
    }
    return false
  }

  /** Add to the last bin and allow to split among multiple bins. New bins may be created. */
  private forceAdd(obj: ObjectToPack<T, TChunk>): void {
    let bin = this.bins[this.bins.length - 1]
    bin.objects.push(obj)
    let prefixWithSeparator =
      bin.columns[bin.currentColumn] !== this.def.binCapacities[bin.currentColumn]
    for (const el of obj.elements) {
      let pushed = false
      while (!pushed) {
        if (el.size <= bin.columns[bin.currentColumn]) {
          // Fit in current column
          if (prefixWithSeparator) {
            bin.columns[bin.currentColumn] -= this.def.separator.size
            bin.elementsByColumn[bin.currentColumn].push(this.def.separator.objChunk)
            prefixWithSeparator = false
          }
          bin.columns[bin.currentColumn] -= el.size
          bin.elementsByColumn[bin.currentColumn].push(el.objChunk)
          pushed = true
        } else if (el.size > this.def.binCapacities[0]) {
          console.error('Chunk cannot fit in any column!', { obj: obj, chunk: el })
          return
        } else if (bin.currentColumn < bin.columns.length - 1) {
          // Require a new column
          prefixWithSeparator = false
          // bin.columns[bin.currentColumn] = 0
          ++bin.currentColumn
        } else {
          // Require a new bin
          prefixWithSeparator = false
          // bin.columns[bin.currentColumn] = 0
          bin.totalRemaining = 0
          bin.currentColumn = bin.columns.length
          bin = this.newBin()
        }
      }
    }
    Bin.resetRemaining(bin)
    return
  }
}

/** Just split content into bins in sequential order. Preserve ordering. */
export function naive_packing<T, TChunk>(
  objects: ObjectToPack<T, TChunk>[],
  bins: BinSet<T, TChunk>
): Bin<T, TChunk>[] {
  for (const obj of objects) {
    if (!bins.add(obj)) {
      if (!bins.lastBinIsEmpty()) bins.newBin()
      bins.addAndSplit(obj)
    }
  }

  return bins.bins
}

/** Sort objects (biggest first) and put in the first matching bin. */
export function packing1<T, TChunk>(
  objects: ObjectToPack<T, TChunk>[],
  bins: BinSet<T, TChunk>
): Bin<T, TChunk>[] {
  const biggestObjectsFirst = objects.sort((a, b) => b.size - a.size)

  for (const obj of biggestObjectsFirst) {
    for (let i = 0; i < bins.bins.length; i++) {
      if (bins.add(obj, i)) {
        obj.taken = true
        break
      }
    }
    if (!obj.taken) {
      if (!bins.lastBinIsEmpty()) bins.newBin()
      bins.addAndSplit(obj)
      obj.taken = true
    }
  }
  return bins.bins
}

// /** Return index of next untaken object from i included. */
// function next_obj(objs: ObjectToPack<T, TChunk>[], i: number) {
//   while (i < objs.length && objs[i].taken) {
//     i++
//   }
//   return i < objs.length ? i : undefined
// }

// /** Return `count` objects and its total size from index `from`. */
// function next_size<T, TChunk>(objs: ObjectToPack<T, TChunk>[], from: number, count: number): PackedBin<T> {
//   let res: PackedBin<T> = {
//     size: 0,
//     objs: []
//   }

//   let i = from
//   while (count-- > 0) {
//     const tmp = next_obj(objs, i)
//     if (tmp === undefined) {
//       break
//     }
//     i = tmp
//     res.size += objs[i].size
//     res.objs.push(objs[i])
//     i++
//   }
//   return res
// }

// function best_fill<T, TChunk>(capacity: number, objs: ObjectToPack<T, TChunk>[], from: number, depth: number) {
//   let best_cap = capacity
//   let best: PackedBin<T> = {
//     size: 0,
//     objs: []
//   }

//   if (depth <= 0) {
//     return best
//   }

//   for (let i = from; i < objs.length; i++) {
//     const obj = objs[i]

//     if (obj.taken) {
//       continue
//     }
//     if (capacity < obj.size) {
//       continue
//     }
//     if (depth == 1) {
//       return {
//         size: obj.size,
//         objs: [obj]
//       }
//     }

//     let new_capacity = capacity - obj.size
//     let next_objs = next_size(objs, i + 1, depth - 1)
//     let stop = false
//     if (next_objs.size <= new_capacity) {
//       /* Biggest next objects either can't fill the bin or exactly fill
//        * the bin: in both case, we won't find something better. */
//       stop = true
//     } else {
//       next_objs = best_fill(new_capacity, objs, i + 1, depth - 1)
//     }

//     new_capacity -= next_objs.size
//     if (new_capacity < best_cap) {
//       best_cap = new_capacity
//       next_objs.objs.push(obj)
//       next_objs.size += obj.size
//       best = next_objs
//     }
//     if (stop) {
//       break
//     }
//   }

//   return best
// }

// /* `sorted_objs` is assumed to be sorted in ascending order and having two
//  * attributes: `id` and `size`. */
// export function bin_packing<T, TChunk>(
//   sorted_objs: ObjectToPack<T, TChunk>[],
//   max_capacity: number,
//   depth: number,
//   errors: string[]
// ): {
//   capacity: number
//   size: number
//   objs: ObjectToPack<T, TChunk>[]
// }[] {
//   const buckets = []
//   const newBin = (): { capacity: number; size: number; objs: ObjectToPack<T, TChunk>[] } => ({
//     capacity: max_capacity,
//     size: 0,
//     objs: []
//   })
//   let current: { capacity: number; size: number; objs: ObjectToPack<T, TChunk>[] } = newBin()
//   const total_size_to_be_packed = sorted_objs.reduce((acc, obj) => acc + obj.size, 0)

//   sorted_objs.forEach((obj) => (obj.taken = false))

//   for (let i = 0; i < sorted_objs.length; i++) {
//     const obj = sorted_objs[i]
//     if (obj.taken) {
//       continue
//     }
//     if (max_capacity < obj.size) {
//       console.log('cannot fit:', obj)
//       errors.push('Some objects are too big to fit in any bin.')
//       continue
//     }
//     if (current.capacity < obj.size) {
//       buckets.push(current)
//       current = newBin()
//     }
//     current.size += obj.size
//     current.capacity -= obj.size
//     current.objs.push(obj)
//     obj.taken = true

//     /* Try to fill the bin. */
//     const next_objs = next_size(sorted_objs, i + 1, depth)
//     if (next_objs.size < current.capacity) {
//       /* We can't fill the bin right now, continue. */
//       continue
//     }
//     const best_objs = best_fill(current.capacity, sorted_objs, i + 1, depth)
//     best_objs.objs.forEach(function (x) {
//       current.objs.push(x)
//       current.size += x.size
//       current.capacity -= x.size
//       x.taken = true
//     })
//   }

//   if (current.objs.length > 0) {
//     buckets.push(current)
//   }

//   var total_size_packed = buckets.reduce((acc, bin) => acc + bin.size, 0)
//   if (Math.round(total_size_packed) != Math.round(total_size_to_be_packed)) {
//     errors.push(
//       'packed: ' + total_size_packed + '\n' + 'should be packed: ' + total_size_to_be_packed
//     )
//   }

//   return buckets
// }

// // bin_packer_worker = new Worker("bin-packer-worker.js")
// // bin_packer_worker.onmessage = function(event) {}

// /* Optimal bin packing by Schreiber & Korf (Improved Bin Completion for Optimal
//  * Bin Packing and Number Partitionning). */
// function l2(sorted_objs: { size: number; taken: boolean }[], bin_capacity: number) {
//   let wasted_space = 0
//   let last = sorted_objs.length - 1
//   let s_sum = 0 // Σ(s_i)
//   let sum = 0

//   for (let i = 0; i <= last; i++) {
//     const s_i = sorted_objs[i] // largest element
//     if (s_i.taken) {
//       continue
//     }
//     s_sum += s_i.size
//     const r = bin_capacity - s_i.size
//     while (i < last && sorted_objs[last].size <= r) {
//       sum += sorted_objs[last].size
//       last--
//     }
//     // s_sum += sum
//     if (sum <= r) {
//       wasted_space += r - sum
//       sum = 0
//     } else {
//       sum -= r
//     }
//   }

//   return Math.ceil((wasted_space + s_sum) / bin_capacity)
// }

// function bin_packing_schreiber(
//   sorted_objs: { size: number; taken: boolean }[],
//   bin_capacity: number
// ) {
//   var sum_of_elements = sorted_objs.reduce((acc, obj) => acc + obj.size, 0)
//   var l1 = Math.ceil(sum_of_elements / sorted_objs.length)
//   var l2 = Math.ceil(((sum_of_elements % bin_capacity) + sum_of_elements) / sorted_objs.length)

//   var w = 0
//   for (let i = 0; i < sorted_objs.length; i++) {
//     const obj = sorted_objs[i]
//     if (obj.taken) {
//       continue
//     }

//     const r = bin_capacity - obj.size
//   }
// }
