import fs from 'node:fs'

export function pkg(): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return JSON.parse(fs.readFileSync('package.json', 'utf-8'))
}
