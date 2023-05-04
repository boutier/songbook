export function fullErrorMessage(e: any): string {
  if (e instanceof Error) {
    return e.message + (e.cause ? ': ' + fullErrorMessage(e.cause) : '')
  }
  return `${e}`
}

export function capitalize(str: string): string {
  return str.replace(/^./, (x) => x.toLocaleUpperCase())
}
