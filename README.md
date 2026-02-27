# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

### Local dev auth bypass (optional)

If Google sign-in is blocked in your local setup, you can bypass auth only in development:

```sh
echo 'VITE_BYPASS_AUTH=true' >> .env.local
npm run dev
```

This bypass is only active for local Vite development (`import.meta.env.DEV`).

When bypass mode is enabled, `Import All` persists imported data to browser `localStorage` so charts remain available as you navigate pages locally.

## Data Import Contract

The upload flow expects 3 files:

1. `Legacy Course Data` (calendar years 2022-2025)
2. `Modern Course Data` (calendar years 2026+)
3. `Time Spent Category Data` (detail entries for selected categories)

### Key matching rules

- Legacy and Modern rows are keyed by:
  - `Course Name`
  - reporting column (`[LCT] Reporting (L)` for Legacy, `[LCT] Reporting (M)` for Modern)
- Time Spent rows are keyed by:
  - `Course Name` only
  - if multiple projects share the same course name, the app uses the time-entry date year to prefer Legacy (`<= 2025`) or Modern (`>= 2026`).

### Time parsing rules

- `Time spent` values are parsed as **duration quantities** (hours), not wall-clock times.
- Supported inputs include:
  - `h:mm`
  - `h:mm:ss` (example: `39:45:00` => `39.75` hours)
  - Excel duration-backed date-time strings like `1/9/1900 3:45:00 PM` (treated as duration, not timestamp)
  - numeric Excel serial durations

### Date parsing rules

- Time Spent `Date` values are normalized to ISO `YYYY-MM-DD`.
- Supported forms include `M/D/YYYY`, ISO date strings, and Excel serial dates.

### Aggregation and totals

- `projects.total_hours` is authoritative from Legacy/Modern `Time spent` for those files.
- Time Spent Category rows are imported as detail entries and do **not** override project totals.
- Time Spent file can contain many rows per course; rows are preserved as separate detail entries.
- Legacy summary rows are **not** inserted into `time_entries`, preventing duplicate total counting during import.

### Duplicate-title diagnostics

- The Upload preview now flags duplicate title groups where multiple Legacy/Modern projects share the same `Course Name`.
- For each duplicate group, it shows variant reporting years/sources, time-entry row count, undated row count, and observed entry years.
- During import, the app reports when rows required fallback mapping (latest reporting year) or source-hint mapping by date year.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
