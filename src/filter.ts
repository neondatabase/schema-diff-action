/**
 * Optional filters applied to PostgreSQL schema dumps before they are compared.
 *
 * Each filter removes whole SQL statements, so a removed statement never leaves
 * a partial hunk behind. Statements are located with a small tokenizer that
 * understands quoted identifiers, string literals, dollar-quoted bodies and
 * comments; it is not a general SQL parser.
 */

export type SchemaFilterOptions = {
  /** Extensions whose CREATE EXTENSION and COMMENT ON EXTENSION are removed. */
  excludeExtensions: string[]
  /** Security label providers whose SECURITY LABEL FOR <provider> statements are removed. */
  excludeSecurityLabelProviders: string[]
}

/**
 * A statement and the comment lines (for example pg_dump object headers) that
 * precede it.
 */
type Statement = {
  lead: string
  body: string
}

// Whitespace and comments that may precede a statement.
const LEADING_TRIVIA = /^(?:\s|--[^\n]*|\/\*[\s\S]*?\*\/)*/

// An identifier: either double-quoted (with "" escapes) or a bare word.
const IDENT = `("(?:[^"]|"")*"|[^\\s;]+)`

const CREATE_EXTENSION = new RegExp(
  `^CREATE\\s+EXTENSION\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${IDENT}`,
  'i'
)
const COMMENT_ON_EXTENSION = new RegExp(
  `^COMMENT\\s+ON\\s+EXTENSION\\s+${IDENT}\\s+IS\\b`,
  'i'
)
const SECURITY_LABEL_FOR = new RegExp(
  `^SECURITY\\s+LABEL\\s+FOR\\s+${IDENT}\\s+ON\\b`,
  'i'
)

/**
 * Parses a comma-separated input such as `anon, citext`. Empty entries are
 * ignored, so an unset input yields an empty list.
 */
export function parseNameList(input: string | undefined): string[] {
  return (input ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
}

/**
 * Removes the statements selected by `options` from a schema dump.
 *
 * With no filters configured the input is returned unchanged, so callers that
 * do not use filtering keep their existing output byte for byte. Otherwise the
 * result is re-rendered from the remaining statements. Two dumps that differ
 * only in excluded metadata therefore produce identical output.
 *
 * Names are matched case-insensitively.
 */
export function filterSchemaSql(
  sql: string | undefined,
  options?: SchemaFilterOptions
): string | undefined {
  if (sql === undefined || options === undefined) return sql

  const extensions = new Set(options.excludeExtensions.map(lower))
  const providers = new Set(options.excludeSecurityLabelProviders.map(lower))
  if (extensions.size === 0 && providers.size === 0) return sql

  const isExcluded = (body: string): boolean => {
    const extension =
      CREATE_EXTENSION.exec(body) ?? COMMENT_ON_EXTENSION.exec(body)
    if (extension) return extensions.has(lower(parseIdent(extension[1])))

    const label = SECURITY_LABEL_FOR.exec(body)
    return label !== null && providers.has(lower(parseIdent(label[1])))
  }

  const sections = groupSections(splitStatements(sql))

  const rendered: string[] = []
  for (const section of sections) {
    const kept = section
      .filter((statement) => !isExcluded(statement.body))
      .map((statement) => statement.body)

    // A section with no remaining statements is dropped entirely, including
    // its object header.
    if (kept.length === 0) continue

    // The header belongs to the section, not to any one statement, so it is
    // taken from the first statement even when that statement was removed.
    const header = section[0].lead.trim()
    rendered.push([header, ...kept].filter((part) => part !== '').join('\n\n'))
  }

  return rendered.length === 0 ? '' : rendered.join('\n\n') + '\n'
}

function lower(value: string): string {
  return value.toLowerCase()
}

/** Returns the name of an identifier as written in SQL, unquoted if needed. */
function parseIdent(raw: string): string {
  return raw.startsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw
}

function splitStatements(sql: string): Statement[] {
  const pieces: string[] = []
  let start = 0
  let i = 0

  while (i < sql.length) {
    const ch = sql[i]
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      i = end === -1 ? sql.length : end + 1
    } else if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? sql.length : end + 2
    } else if (ch === "'" || ch === '"') {
      i = skipQuoted(sql, i)
    } else if (ch === '$' && dollarTagAt(sql, i)) {
      const tag = dollarTagAt(sql, i) ?? ''
      const end = sql.indexOf(tag, i + tag.length)
      i = end === -1 ? sql.length : end + tag.length
    } else if (ch === ';') {
      pieces.push(sql.slice(start, i + 1))
      start = i + 1
      i++
    } else {
      i++
    }
  }
  if (start < sql.length) pieces.push(sql.slice(start))

  return pieces
    .map((piece): Statement => {
      const lead = LEADING_TRIVIA.exec(piece)?.[0] ?? ''
      return { lead, body: piece.slice(lead.length).trimEnd() }
    })
    .filter((statement) => statement.body !== '' && statement.body !== ';')
}

/** Returns the index just past a quoted string or identifier starting at `start`. */
function skipQuoted(sql: string, start: number): number {
  const quote = sql[start]
  // E'...' strings treat backslash as an escape character.
  const backslashEscapes =
    quote === "'" &&
    /[eE]/.test(sql[start - 1] ?? '') &&
    !/[A-Za-z0-9_$]/.test(sql[start - 2] ?? '')

  let i = start + 1
  while (i < sql.length) {
    if (backslashEscapes && sql[i] === '\\') {
      i += 2
    } else if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2
      } else {
        return i + 1
      }
    } else {
      i++
    }
  }
  return sql.length
}

/** Returns the dollar-quote tag (for example `$$` or `$body$`) opening at `i`. */
function dollarTagAt(sql: string, i: number): string | undefined {
  // A `$` inside an identifier such as `a$b$` does not open a dollar quote.
  if (i > 0 && /[A-Za-z0-9_$]/.test(sql[i - 1])) return undefined
  const match = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 256))
  return match?.[0]
}

/**
 * Groups statements into sections. A section begins at a statement that
 * carries a comment header, which is how pg_dump marks each object.
 */
function groupSections(statements: Statement[]): Statement[][] {
  const sections: Statement[][] = []
  for (const statement of statements) {
    if (sections.length === 0 || /--|\/\*/.test(statement.lead)) {
      sections.push([statement])
    } else {
      sections[sections.length - 1].push(statement)
    }
  }
  return sections
}
