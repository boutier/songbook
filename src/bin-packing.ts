/** Just split content into bin in sequential order. Preserve ordering. */
export function naive_packing<T extends { size: number }>(packs: T[], bin_size: number): T[][] {
  const bins: T[][] = []

  let bin: T[] = []
  let available: number = bin_size
  for (const pack of packs) {
    if (pack.size > available) {
      if (pack.size > bin_size) {
        throw Error(`Cannot put ${pack} in any bin.`)
      }
      bins.push(bin)
      bin = []
      available = bin_size
    }
    bin.push(pack)
    available -= pack.size
  }

  bins.push(bin)

  return bins
}

type ObjectToPack<T = unknown> = T & {
  taken?: boolean
  size: number
}

type PackedBin<T> = {
  size: number
  objs: ObjectToPack<T>[]
}

/** Return index of next untaken object from i included. */
function next_obj(objs: ObjectToPack[], i: number) {
  while (i < objs.length && objs[i].taken) {
    i++
  }
  return i < objs.length ? i : undefined
}

/** Return `count` objects and its total size from index `from`. */
function next_size<T>(objs: ObjectToPack<T>[], from: number, count: number): PackedBin<T> {
  let res: PackedBin<T> = {
    size: 0,
    objs: []
  }

  let i = from
  while (count-- > 0) {
    const tmp = next_obj(objs, i)
    if (tmp === undefined) {
      break
    }
    i = tmp
    res.size += objs[i].size
    res.objs.push(objs[i])
    i++
  }
  return res
}

function best_fill<T>(capacity: number, objs: ObjectToPack<T>[], from: number, depth: number) {
  let best_cap = capacity
  let best: PackedBin<T> = {
    size: 0,
    objs: []
  }

  if (depth <= 0) {
    return best
  }

  for (let i = from; i < objs.length; i++) {
    const obj = objs[i]

    if (obj.taken) {
      continue
    }
    if (capacity < obj.size) {
      continue
    }
    if (depth == 1) {
      return {
        size: obj.size,
        objs: [obj]
      }
    }

    let new_capacity = capacity - obj.size
    let next_objs = next_size(objs, i + 1, depth - 1)
    let stop = false
    if (next_objs.size <= new_capacity) {
      /* Biggest next objects either can't fill the bin or exactly fill
       * the bin: in both case, we won't find something better. */
      stop = true
    } else {
      next_objs = best_fill(new_capacity, objs, i + 1, depth - 1)
    }

    new_capacity -= next_objs.size
    if (new_capacity < best_cap) {
      best_cap = new_capacity
      next_objs.objs.push(obj)
      next_objs.size += obj.size
      best = next_objs
    }
    if (stop) {
      break
    }
  }

  return best
}

/* `sorted_objs` is assumed to be sorted in ascending order and having two
 * attributes: `id` and `size`. */
export function bin_packing<T>(
  sorted_objs: ObjectToPack<T>[],
  max_capacity: number,
  depth: number,
  errors: string[]
): {
  capacity: number
  size: number
  objs: ObjectToPack<T>[]
}[] {
  const buckets = []
  const newBin = (): { capacity: number; size: number; objs: ObjectToPack<T>[] } => ({
    capacity: max_capacity,
    size: 0,
    objs: []
  })
  let current: { capacity: number; size: number; objs: ObjectToPack<T>[] } = newBin()
  const total_size_to_be_packed = sorted_objs.reduce((acc, obj) => acc + obj.size, 0)

  sorted_objs.forEach((obj) => (obj.taken = false))

  for (let i = 0; i < sorted_objs.length; i++) {
    const obj = sorted_objs[i]
    if (obj.taken) {
      continue
    }
    if (max_capacity < obj.size) {
      errors.push('Some objects are too big to fit in any bin.')
      continue
    }
    if (current.capacity < obj.size) {
      buckets.push(current)
      current = newBin()
    }
    current.size += obj.size
    current.capacity -= obj.size
    current.objs.push(obj)
    obj.taken = true

    /* Try to fill the bin. */
    const next_objs = next_size(sorted_objs, i + 1, depth)
    if (next_objs.size < current.capacity) {
      /* We can't fill the bin right now, continue. */
      continue
    }
    const best_objs = best_fill(current.capacity, sorted_objs, i + 1, depth)
    best_objs.objs.forEach(function (x) {
      current.objs.push(x)
      current.size += x.size
      current.capacity -= x.size
      x.taken = true
    })
  }

  if (current.objs.length > 0) {
    buckets.push(current)
  }

  var total_size_packed = buckets.reduce((acc, bin) => acc + bin.size, 0)
  if (total_size_packed != total_size_to_be_packed) {
    errors.push(
      'packed: ' + total_size_packed + '\n' + 'should be packed: ' + total_size_to_be_packed
    )
  }

  return buckets
}

// bin_packer_worker = new Worker("bin-packer-worker.js")
// bin_packer_worker.onmessage = function(event) {}

/* Optimal bin packing by Schreiber & Korf (Improved Bin Completion for Optimal
 * Bin Packing and Number Partitionning). */
function l2(sorted_objs: { size: number; taken: boolean }[], bin_capacity: number) {
  let wasted_space = 0
  let last = sorted_objs.length - 1
  let s_sum = 0 // Σ(s_i)
  let sum = 0

  for (let i = 0; i <= last; i++) {
    const s_i = sorted_objs[i] // largest element
    if (s_i.taken) {
      continue
    }
    s_sum += s_i.size
    const r = bin_capacity - s_i.size
    while (i < last && sorted_objs[last].size <= r) {
      sum += sorted_objs[last].size
      last--
    }
    // s_sum += sum
    if (sum <= r) {
      wasted_space += r - sum
      sum = 0
    } else {
      sum -= r
    }
  }

  return Math.ceil((wasted_space + s_sum) / bin_capacity)
}

function bin_packing_schreiber(
  sorted_objs: { size: number; taken: boolean }[],
  bin_capacity: number
) {
  var sum_of_elements = sorted_objs.reduce((acc, obj) => acc + obj.size, 0)
  var l1 = Math.ceil(sum_of_elements / sorted_objs.length)
  var l2 = Math.ceil(((sum_of_elements % bin_capacity) + sum_of_elements) / sorted_objs.length)

  var w = 0
  for (let i = 0; i < sorted_objs.length; i++) {
    const obj = sorted_objs[i]
    if (obj.taken) {
      continue
    }

    const r = bin_capacity - obj.size
  }
}
