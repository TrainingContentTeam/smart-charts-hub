

## Apply Shared-Read RLS Policies

The migration file exists but the policies haven't been applied to the database. I'll run the migration SQL to:

1. Drop the old `Users can read own` SELECT policies on `projects`, `time_entries`, and `upload_history`
2. Create new `Authenticated users can read all` SELECT policies with `USING (true)` on all three tables

This is a single database migration step — no code changes needed.

