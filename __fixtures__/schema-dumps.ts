// Schema dumps shaped like the PostgreSQL dump output returned by the Neon
// schema API. Headers follow pg_dump's `--` object comment format.

/** An application schema with no anonymizer installed. */
export const BASE_DUMP = `--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET client_encoding = 'UTF8';

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';

--
-- Name: "Users"; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Users" (
    id integer NOT NULL,
    email public.citext NOT NULL,
    display_name text
);

--
-- Name: "weird""name"; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."weird""name" (
    id integer NOT NULL
);

--
-- Name: TABLE "Users"; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON TABLE public."Users" IS 'Users; one row per account';

--
-- Name: get_user_count(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.get_user_count() RETURNS integer
    LANGUAGE sql
    AS $$
  SELECT count(*)::int FROM public."Users";
$$;

--
-- Name: Users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "Users_pkey" PRIMARY KEY (id);
`

/**
 * The schema after the anonymizer is installed and masking rules are applied,
 * with only anonymizer metadata added. This is the case from the request.
 */
export const ANONYMIZER_DUMP = `${BASE_DUMP}
--
-- Name: anon; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS anon WITH SCHEMA public;

--
-- Name: EXTENSION anon; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION anon IS 'Anonymization & Data Masking for PostgreSQL';

--
-- Name: COLUMN "Users".email; Type: SECURITY LABEL; Schema: public; Owner: neondb_owner
--

SECURITY LABEL FOR anon ON COLUMN public."Users".email
    IS 'MASKED WITH VALUE NULL';
`

/**
 * ANONYMIZER_DUMP plus a section that mixes two providers: an anon label and
 * an unrelated sepgsql label in the same object section.
 */
export const ANONYMIZED_DUMP = `${ANONYMIZER_DUMP}
--
-- Name: TABLE "Users"; Type: SECURITY LABEL; Schema: public; Owner: neondb_owner
--

SECURITY LABEL FOR anon ON TABLE public."Users"
    IS 'MASKED WITH FUNCTION public.anon_fake_id()';

SECURITY LABEL FOR sepgsql ON TABLE public."Users"
    IS 'system_u:object_r:sepgsql_table_t:s0; reviewed';
`

/** A real application change on top of the anonymized schema: display_name is now varchar(255). */
export const REAL_CHANGE_DUMP = ANONYMIZED_DUMP.replace(
  'display_name text',
  'display_name varchar(255)'
)

/** The citext extension statements, as they appear in BASE_DUMP. */
export const CITEXT_STATEMENTS = `--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';
`
