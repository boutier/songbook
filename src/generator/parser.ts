function err(e: string): any {
  throw Error(e)
}

export type Song = {
  title: string
  stanzas: Stanza[]
  tags: string[]
  number?: number
}

export type PrefixType = 'R' | '#' | 'Coda' | ''

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
    prefixType: '',
    lines: []
  }

  let line = next_non_empty(lines)
  if (!line) {
    return undefined
  }

  for (; line && line.length > 0; line = lines.pop()) {
    // First line determine paragraph type.
    const m = line.match(
      /^((?<num>[0-9]+)|(?<r>[r])|(?<coda>coda)|(?<other>[^a-z]+))\s*[.:/]\s*(?<text>.*)/i
    ) as null | {
      groups: { num?: string; r?: string; coda?: string; other?: string; text: string }
    }
    if (m) {
      if (stanza.lines.length > 0) {
        // paragraph change
        lines.push(line)
        break
      }

      const { num, r, coda, other, text } = m.groups
      if (r) {
        stanza.prefixType = 'R'
        stanza.prefix = 'R.'
      } else if (num) {
        stanza.prefixType = '#'
        stanza.prefix = num // Rewritten afterwards
      } else if (coda) {
        stanza.prefixType = 'Coda'
        stanza.prefix = 'Coda'
      } else if (other) {
        stanza.prefixType = ''
        stanza.prefix = other
      }
      const trimmed_text = text.trim()
      if (trimmed_text) stanza.lines.push(trimmed_text)
    } else {
      stanza.lines.push(line)
    }
  }
  return stanza
}

function parse_comment(tags: string[], line: string) {
  line
    .split(/type\s*:\s*/, 2)[1]
    ?.split(/[\s,;]+/)
    ?.forEach((tag) => tags.push(tag.toLocaleLowerCase()))
}

function parse_song(text: string): Song {
  const tags: string[] = []
  const lines = text
    .trim()
    .split(/\s*[\n\u2028\u2029]\s*/)
    .filter((line) => {
      if (line.match(/\s*#/)) {
        parse_comment(tags, line)
        return false
      }
      return true
    })
    .reverse() // To use pop()

  const song: Song = {
    title: next_non_empty(lines) ?? err('Empty song'),
    stanzas: [],
    tags: tags
  }

  let stanza: Stanza | undefined
  while ((stanza = parse_next_stanza(lines))) {
    song.stanzas.push(stanza)
  }

  let stanzaNum = 1
  song.stanzas.forEach((it) => {
    if (it.prefixType === '#') it.prefix = `${stanzaNum++}.`
  })
  return song
}

export function parse_file(file: string): Song[] {
  const songs = file
    // Remove non-breaking spaces, tabulations, etc.
    .replace(/ /g, ' ')
    // Normalize quotes, drop tabulations
    .replace(/[’´\t]/g, (c) => (c === '\t' ? '' : "'"))
    // Add non-breaking spaces
    .replace(/\s*([!?;:])/g, ' $1')
    .normalize('NFC')
    .split(/[0-9]+\s*[-—–]/)
    .map((it) => it.trim())
    .filter((it) => !!it)
  return songs.map((it) => parse_song(it))
}
