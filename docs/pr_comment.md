<!--- [schema diff GitHub action comment identifier] -->
<!--- [diff digest: 0397306b7beb76c53ec7090d4fde82657be5f1f7f4aa6e1fb4a079f6c41cc204] -->

# <picture><source media="(prefers-color-scheme: dark)" srcset="./logos/logo-dark.svg"><img alt="Neon logo" src="./logos/logo-light.svg" width="24" height="24"></picture> Neon Schema Diff summary

Schema diff between the compare branch
([preview/pr-9-feat/add-soft-delete](https://console.neon.tech/app/projects/holy-wind-90398863/branches/br-misty-resonance-a5jvokot))
and the base branch
([main](https://console.neon.tech/app/projects/holy-wind-90398863/branches/br-crimson-mode-a5j632xb)).

- Base branch: main
  ([br-crimson-mode-a5j632xb](https://console.neon.tech/app/projects/holy-wind-90398863/branches/br-crimson-mode-a5j632xb))
  🔒
- Compare branch: preview/pr-9-feat/add-soft-delete
  ([br-misty-resonance-a5jvokot](https://console.neon.tech/app/projects/holy-wind-90398863/branches/br-misty-resonance-a5jvokot))
- Database: neondb

```diff
Index: neondb-schema.sql
===================================================================
--- neondb-schema.sql Branch main
+++ neondb-schema.sql Branch preview/pr-9-feat/add-soft-delete
@@ -111,9 +111,10 @@
     title text NOT NULL,
     content text NOT NULL,
     user_id integer NOT NULL,
     created_at timestamp without time zone DEFAULT now() NOT NULL,
-    updated_at timestamp without time zone DEFAULT now() NOT NULL
+    updated_at timestamp without time zone DEFAULT now() NOT NULL,
+    deleted_at timestamp without time zone
 );


 ALTER TABLE public.posts OWNER TO neondb_owner;
@@ -180,5 +181,5 @@
 --
 -- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: neondb_owner
 --

-ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_m
\ No newline at end of file
+ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN
\ No newline at end of file

```

This comment was last updated at 11/20/2024 10:05:59 AM
