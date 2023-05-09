function err(e: string): any {
  throw Error(e)
}

export type Song = {
  title: string
  context?: string
  stanzas: Stanza[]
  tags: string[]
  number?: number
}

export type PrefixType = 'refrain' | 'numbered-verse' | 'coda' | 'bridge' | 'none'

export type Stanza = {
  prefixType: PrefixType
  prefix: string
  lines: string[]
}

/** Lines should have been reversed. */
function next_non_empty(lines: string[]): string | undefined {
  let line: string | undefined
  do {
    line = lines.pop()
  } while (line?.length === 0)
  return line
}

function parse_next_stanza(lines: string[]): Stanza | undefined {
  const stanza: Stanza = {
    prefix: '',
    prefixType: 'none',
    lines: []
  }

  let line = next_non_empty(lines)
  if (!line) {
    return undefined
  }

  for (; line && line.length > 0; line = lines.pop()) {
    // First line determine paragraph type.
    const m = line.match(
      /^((?<num>[0-9]+)|(?<r>[r])|(?<coda>coda)|(?<pont>pont)|(?<other>[a-z0-9]+))\s*[.:/]\s*(?<text>.*)/i
    ) as null | {
      groups: {
        num?: string
        r?: string
        coda?: string
        pont?: string
        other?: string
        text: string
      }
    }
    if (m) {
      if (stanza.lines.length > 0) {
        // paragraph change
        lines.push(line)
        break
      }

      const { num, r, coda, pont, other, text } = m.groups
      if (r) {
        stanza.prefixType = 'refrain'
        stanza.prefix = 'R.'
      } else if (num) {
        stanza.prefixType = 'numbered-verse'
        stanza.prefix = num // Rewritten afterwards
      } else if (coda) {
        stanza.prefixType = 'coda'
        stanza.prefix = 'Coda.'
      } else if (pont) {
        stanza.prefixType = 'bridge'
        stanza.prefix = 'Pont.'
      } else if (other) {
        stanza.prefixType = 'none'
        stanza.prefix = other + '.'
        console.log('unknown prefix detected', other)
      }
      const trimmed_text = text.trim()
      if (trimmed_text) stanza.lines.push(trimmed_text)
    } else {
      stanza.lines.push(line)
    }
  }
  return stanza
}

function parse_comment(opts: { type: string[]; context?: string }, line: string) {
  const m = line.match(/(?<key>type|context)\s*:\s*(?<value>.*)/)
  const key = m?.groups?.key as 'type' | 'context' | undefined
  const value = m?.groups?.value
  if (!key) {
    console.error('Unmatched comment:', line)
    return
  }
  if (!value) {
    return
  }
  if (key === 'type') {
    value
      .replace(/(.*)intercession\+?/, '$1méditation')
      .split(/[\s,;]+/)
      .forEach((tag) => opts.type.push(tag.toLocaleLowerCase()))
  } else {
    opts.context = value.trim()
  }
}

function parse_song(text: string): Song {
  const opts: { type: string[]; context?: string } = { type: [] }
  const lines = text
    .trim()
    .split(/\s*[\n\u2028\u2029]\s*/)
    .filter((line) => {
      if (line.match(/\s*#/)) {
        parse_comment(opts, line)
        return false
      }
      return true
    })
    .reverse() // To use pop()

  const song: Song = {
    title: next_non_empty(lines) ?? err('Empty song'),
    stanzas: [],
    tags: opts.type,
    context: opts.context
  }

  let stanza: Stanza | undefined
  while ((stanza = parse_next_stanza(lines))) {
    song.stanzas.push(stanza)
  }

  let stanzaNum = 1
  song.stanzas.forEach((it) => {
    if (it.prefixType === 'numbered-verse') it.prefix = `${stanzaNum++}.`
  })
  return song
}

export function parse_file(file: string): Song[] {
  const songs = file
    // Remove non-breaking spaces, tabulations, etc.
    .replace(/ /g, ' ')
    // Normalize quotes, drop tabulations
    .replace(/[’´\t]/g, (c) => (c === '\t' ? '' : "'"))
    .replaceAll('...', '…')
    // Add non-breaking spaces
    .replace(/([«])\s*/g, '$1 ')
    .replace(/\s*([!?;:»])/g, ' $1')
    .normalize('NFC')
    .split(/[0-9]+\s*[-—–]/)
    .map((it) => it.trim())
    .filter((it) => !!it)
  return songs.map((it) => parse_song(it))
}
