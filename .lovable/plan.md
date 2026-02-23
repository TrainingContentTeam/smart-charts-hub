

# Complete Implementation Plan: Two-File Upload, Data Synthesis, and AI Chatbot

This plan covers everything we've discussed: uploading two different Excel files, combining their data by project name, building richer visualizations, and adding an AI chatbot powered by your Google Gemini key (no Lovable AI credits used).

---

## Phase 1: Store Your Google Gemini API Key

Your API key will be stored securely as a backend secret called `GOOGLE_GEMINI_KEY`. It will only be accessible from backend functions -- never exposed in the browser.

---

## Phase 2: Expand the Database

Add new columns to the `projects` table for course metadata:

| Column | Type | Purpose |
|--------|------|---------|
| id_assigned | text | Who's assigned (e.g., "Devin Weiss") |
| authoring_tool | text | Rise, Storyline, LMS |
| vertical | text | EMS1A, P1A, FR1A, etc. |
| course_length | text | Duration like "1:00" |
| course_type | text | New, Revamp, Maintenance |
| course_style | text | Full Length, Single Video |
| reporting_year | text | "2022 Courses", "2023 Courses" |
| interaction_count | integer | Course interaction count |

---

## Phase 3: Two-File Upload System

Redesign the Upload page with two separate upload zones:

- **Left panel**: "Course Data" -- for your Course_Data.xlsx (metadata)
- **Right panel**: "Time Entries" -- for your Time_Spent.xlsx (hours)

After uploading both files:
- A **match preview** shows how many courses were found in both files, how many are unmatched
- A single **"Import All"** button processes both files together
- You can also upload just one file at a time

### New Course Data Parser
A new parser (`src/lib/parse-course-data.ts`) will:
- Read all columns from Course_Data.xlsx (Title, [LCT] ID Assigned, [LCT] Authoring Tool, etc.)
- Skip year-grouping header rows (e.g., "2022 Courses (45)")
- Strip Wrike hyperlinks from the Title column to get clean course names
- Return structured metadata objects

### Import Logic
1. Upsert projects from Course_Data (match by name, add/update metadata)
2. Parse time entries from Time_Spent and link to matched projects
3. Show a result summary: X courses imported, Y time entries, Z matched

---

## Phase 4: Enhanced Dashboard and Visualizations

With combined data, the Dashboard gets new charts:

- **Hours by Authoring Tool** (bar chart) -- Rise vs Storyline vs LMS
- **Hours by Course Type** (bar chart) -- New vs Revamp vs Maintenance
- **Hours by Vertical** (bar chart) -- EMS1A, P1A, FR1A, etc.
- **Hours by Reporting Year** (bar chart) -- trend over years
- **Hours by Assigned Person** (bar chart) -- who spent the most time

### Updated Data Explorer
- New sortable/searchable columns: Authoring Tool, Vertical, Course Type, Assigned To
- CSV export includes all fields

### Updated Projects Page
- Each project card shows metadata badges (authoring tool, vertical, course type)
- Project detail view shows full metadata alongside time breakdowns

---

## Phase 5: AI Chatbot (Google Gemini -- No Lovable Credits)

### Backend Function
Create a new backend function (`supabase/functions/chat/index.ts`) that:
1. Receives your message and conversation history
2. Queries the database for all projects (with metadata) and time entries
3. Builds a system prompt with your data as context
4. Calls the **Google Gemini API directly** using your own API key
5. Streams the response back token-by-token

This uses your Google Gemini free tier -- no Lovable AI credits consumed.

### AI Insights Page
Replace the placeholder with a full chat interface:
- Scrollable message area with markdown-rendered responses
- Text input at the bottom with send button
- Streaming responses (tokens appear as they're generated)
- Suggested starter questions as clickable chips:
  - "Which project took the most time?"
  - "Compare hours across authoring tools"
  - "What's the average time per course type?"
  - "Summarize my project data"
- Error handling for rate limits with friendly messages

### Config Update
Add the chat function to `supabase/config.toml` with `verify_jwt = false`.

---

## Files Changed Summary

| File | Change |
|------|--------|
| Database migration | Add 8 metadata columns to `projects` table |
| `src/lib/parse-course-data.ts` | **New** -- parser for Course_Data.xlsx |
| `src/lib/parse-wrike.ts` | Minor cleanup (no breaking changes) |
| `src/pages/UploadData.tsx` | Redesign with two-panel upload + match preview |
| `src/hooks/use-time-data.ts` | Update project query to include new fields |
| `src/pages/Dashboard.tsx` | Add 5 new charts for metadata dimensions |
| `src/pages/DataExplorer.tsx` | Add metadata columns to table |
| `src/pages/Projects.tsx` | Show metadata on project cards |
| `supabase/functions/chat/index.ts` | **New** -- Gemini-powered chat backend |
| `supabase/config.toml` | Add chat function config |
| `src/pages/AiInsights.tsx` | Rewrite with full chat UI + streaming |
| `package.json` | Add `react-markdown` dependency |

