# Lovable Cloud to Supabase Migration

Target project: `pvxqgtazxmvbnneuaabs`

## 1. Prepare the target

1. Link the Supabase CLI and apply the checked-in migrations:

   ```powershell
   npx supabase login
   npx supabase link --project-ref pvxqgtazxmvbnneuaabs
   npx supabase db push
   ```

2. In Supabase Authentication URL Configuration, set:

   - Site URL: `https://team-analytics-app.vercel.app`
   - Redirect URL: `https://team-analytics-app.vercel.app/auth`
   - Local redirect URL: `http://localhost:8080/auth`

3. Enable Email authentication and leave email confirmations enabled for magic links.
4. Enable Google authentication with your Google Client ID and secret.
5. Add `https://pvxqgtazxmvbnneuaabs.supabase.co/auth/v1/callback` as an authorized redirect URI in Google Cloud.
6. Ask every existing team member to sign in to the new app once.

## 2. Export Lovable Cloud

Pause writes to the old app for the final export. In Lovable Cloud, export these populated tables as CSV using the exact table name:

- `upload_history`
- `raw_project_import_rows`
- `raw_time_log_rows`
- `raw_sme_feedback_rows`
- `course_alias_config`
- `person_alias_config`
- `person_role_config`
- `sme_manual_join_overrides`
- `work_entity_decisions`
- `user_roles`

Export the old auth user ID and email list as `auth_users.csv`. The required columns are `id` and `email`; `user_id` is accepted as an alternative to `id`.

Put the files in the ignored `migration-data/` directory. Export Storage bucket objects separately if any exist.

## 3. Validate and import

Create `.env.migration` from `.env.migration.example`. Use the target project's service-role key and the email that should become the first administrator. Never commit this file or share the service-role key.

Run the read-only validation first:

```powershell
npm run migrate:dry-run
```

The check blocks the import if a legacy email has not signed in to the new project, a row has no user mapping, IDs are duplicated, JSON or numeric fields are invalid, or an upload foreign key is missing.

After the dry run passes:

```powershell
npm run migrate:apply
```

The importer preserves primary keys, remaps user IDs by email, writes in dependency order, grants the configured first admin role, and reports source/imported/target counts.

To bootstrap only the first admin after that person has signed in:

```powershell
node scripts/migrate-lovable-export.mjs --bootstrap-only --apply
```

## 4. Deploy

In Vercel, import the GitHub repository as a Vite project and configure:

- Build command: `npm run build`
- Output directory: `dist`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Deploy `supabase/functions/chat` and set its `GOOGLE_GEMINI_KEY` secret:

```powershell
npx supabase functions deploy chat --project-ref pvxqgtazxmvbnneuaabs
npx supabase secrets set GOOGLE_GEMINI_KEY=... --project-ref pvxqgtazxmvbnneuaabs
```

The tracked `vercel.json` provides the SPA rewrite needed for direct navigation to `/auth` and other React Router paths.
