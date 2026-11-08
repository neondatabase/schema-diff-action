import { describe, expect, it } from 'vitest'

import {
  ANONYMIZED_DUMP,
  ANONYMIZER_DUMP,
  BASE_DUMP,
  CITEXT_STATEMENTS,
  REAL_CHANGE_DUMP
} from '../__fixtures__/schema-dumps'
import { filterSchemaSql, parseNameList } from '../src/filter'

const ANON_ONLY = {
  excludeExtensions: ['anon'],
  excludeSecurityLabelProviders: ['anon']
}

describe('parseNameList', () => {
  it('splits, trims and drops empty entries', () => {
    expect(parseNameList(' anon, citext ,,')).toEqual(['anon', 'citext'])
  })

  it('returns an empty list for missing or blank input', () => {
    expect(parseNameList(undefined)).toEqual([])
    expect(parseNameList('')).toEqual([])
    expect(parseNameList(' , ')).toEqual([])
  })
})

describe('filterSchemaSql', () => {
  // 1. Backward compatibility
  it('returns the input unchanged when no options are given', () => {
    expect(filterSchemaSql(ANONYMIZED_DUMP)).toBe(ANONYMIZED_DUMP)
    expect(filterSchemaSql(ANONYMIZED_DUMP, undefined)).toBe(ANONYMIZED_DUMP)
  })

  it('returns the input unchanged when both lists are empty', () => {
    expect(
      filterSchemaSql(ANONYMIZED_DUMP, {
        excludeExtensions: [],
        excludeSecurityLabelProviders: []
      })
    ).toBe(ANONYMIZED_DUMP)
  })

  it('passes an undefined schema through unchanged', () => {
    expect(filterSchemaSql(undefined, ANON_ONLY)).toBeUndefined()
  })

  // 2. Anonymizer-only changes
  it('makes an anonymizer-only change compare equal to the base schema', () => {
    expect(filterSchemaSql(ANONYMIZER_DUMP, ANON_ONLY)).toBe(
      filterSchemaSql(BASE_DUMP, ANON_ONLY)
    )
  })

  it('removes every anon statement and header', () => {
    const filtered = filterSchemaSql(ANONYMIZED_DUMP, ANON_ONLY) ?? ''

    expect(filtered).not.toContain('anon')
    expect(filtered).not.toContain('MASKED WITH')
    expect(filtered).not.toContain('Name: EXTENSION anon')
    expect(filtered).not.toContain('Name: COLUMN "Users".email')
  })

  it('returns an empty string when every statement is excluded', () => {
    const onlyAnon = `--
-- Name: anon; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS anon WITH SCHEMA public;

--
-- Name: COLUMN "Users".email; Type: SECURITY LABEL; Schema: public; Owner: -
--

SECURITY LABEL FOR anon ON COLUMN public."Users".email IS 'MASKED WITH VALUE NULL';
`
    expect(filterSchemaSql(onlyAnon, ANON_ONLY)).toBe('')
  })

  // 3. Real schema changes
  it('keeps a real column change visible after filtering', () => {
    const filteredBase = filterSchemaSql(ANONYMIZED_DUMP, ANON_ONLY)
    const filteredChange = filterSchemaSql(REAL_CHANGE_DUMP, ANON_ONLY)

    expect(filteredChange).not.toBe(filteredBase)
    expect(filteredChange).toContain('display_name varchar(255)')
    expect(filteredBase).toContain('display_name text')
  })

  // 4. Unrelated extensions
  it('keeps unrelated extensions and their comments', () => {
    const filtered = filterSchemaSql(ANONYMIZED_DUMP, ANON_ONLY) ?? ''

    expect(filtered).toContain(CITEXT_STATEMENTS.trim())
  })

  it('still reports a removed unrelated extension as a difference', () => {
    const withoutCitext = BASE_DUMP.replace(CITEXT_STATEMENTS, '')

    expect(filterSchemaSql(withoutCitext, ANON_ONLY)).not.toBe(
      filterSchemaSql(BASE_DUMP, ANON_ONLY)
    )
  })

  // 5. Unrelated security labels
  it('keeps security labels from other providers', () => {
    const filtered = filterSchemaSql(ANONYMIZED_DUMP, ANON_ONLY) ?? ''

    expect(filtered).toContain(
      'SECURITY LABEL FOR sepgsql ON TABLE public."Users"'
    )
    expect(filtered).toContain(
      "IS 'system_u:object_r:sepgsql_table_t:s0; reviewed';"
    )
  })

  // 6. Mixed-provider sections
  it('filters one provider from a section without touching the other', () => {
    const filtered = filterSchemaSql(ANONYMIZED_DUMP, {
      excludeExtensions: [],
      excludeSecurityLabelProviders: ['anon']
    }) as string

    // The section holds a sepgsql label that must survive, so its header stays.
    expect(filtered).toContain('Name: TABLE "Users"; Type: SECURITY LABEL')
    expect(filtered).toContain('SECURITY LABEL FOR sepgsql ON TABLE')
    expect(filtered).not.toContain('SECURITY LABEL FOR anon')
    // The extension itself is not excluded, so its statements remain.
    expect(filtered).toContain('CREATE EXTENSION IF NOT EXISTS anon')
  })

  it('filters a provider only, leaving the same section intact for another', () => {
    const filtered = filterSchemaSql(ANONYMIZED_DUMP, {
      excludeExtensions: [],
      excludeSecurityLabelProviders: ['sepgsql']
    }) as string

    expect(filtered).toContain('SECURITY LABEL FOR anon ON TABLE')
    expect(filtered).not.toContain('SECURITY LABEL FOR sepgsql')
  })

  // 7. Extension comments
  it('removes only comments belonging to excluded extensions', () => {
    const filtered = filterSchemaSql(ANONYMIZED_DUMP, ANON_ONLY) ?? ''

    expect(filtered).not.toContain('COMMENT ON EXTENSION anon')
    expect(filtered).toContain(
      "COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';"
    )
    expect(filtered).toContain(
      `COMMENT ON TABLE public."Users" IS 'Users; one row per account';`
    )
  })

  // Tokenizer: text that merely looks like a statement must not be removed
  it('does not treat text inside literals or bodies as statements', () => {
    const dump = `--
-- Name: TABLE "Users"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Users" IS 'CREATE EXTENSION anon; SECURITY LABEL FOR anon ON TABLE x IS ''y'';';

--
-- Name: get_user_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_count() RETURNS integer
    LANGUAGE plpgsql
    AS $body$
BEGIN
  -- CREATE EXTENSION anon;
  RETURN 1;
END;
$body$;
`
    const filtered = filterSchemaSql(dump, ANON_ONLY) ?? ''

    expect(filtered).toContain(
      "IS 'CREATE EXTENSION anon; SECURITY LABEL FOR anon ON TABLE x IS ''y'';';"
    )
    expect(filtered).toContain('-- CREATE EXTENSION anon;')
    expect(filtered).toContain('RETURN 1;')
  })

  it('preserves quoted identifiers and multiline statements verbatim', () => {
    const filtered = filterSchemaSql(ANONYMIZED_DUMP, ANON_ONLY) ?? ''

    expect(filtered).toContain('CREATE TABLE public."weird""name" (')
    expect(filtered).toContain('CREATE TABLE public."Users" (\n')
    expect(filtered).toContain('$$\n  SELECT count(*)::int')
  })

  it('matches names case-insensitively and accepts quoted extension names', () => {
    const quoted = `CREATE EXTENSION IF NOT EXISTS "Anon" WITH SCHEMA public;\n`

    expect(
      filterSchemaSql(quoted, {
        excludeExtensions: ['ANON'],
        excludeSecurityLabelProviders: []
      })
    ).toBe('')
  })

  it('is idempotent', () => {
    const once = filterSchemaSql(ANONYMIZED_DUMP, ANON_ONLY)

    expect(filterSchemaSql(once, ANON_ONLY)).toBe(once)
  })

  // 8. Output hygiene
  it('leaves no runs of blank lines and ends with a single newline', () => {
    const filtered = filterSchemaSql(ANONYMIZED_DUMP, ANON_ONLY) ?? ''

    expect(filtered).not.toMatch(/\n\n\n/)
    expect(filtered.endsWith('\n')).toBe(true)
    expect(filtered.endsWith('\n\n')).toBe(false)
  })
})
