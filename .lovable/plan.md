

## Plan: Fix Data Accuracy Across All Charts

### Confirmed: Duration Parsing

Yes — the "Time spent" column values are durations, not time-of-day. The parser (`parse-duration.ts`) already handles this correctly:
- `39:45` → 39h 45m
- `5:30:00 AM` (Excel date-time artifact from 1900-based serial) → treated as duration via the `year === 1900` branch
- Excel serial numbers (fractions of a day, 0–10 range) → multiplied by 24 to get hours

No changes needed to the duration parser.

### Terminology Fix: "Uncategorized" not "Untracked"

When category time doesn't sum to Total Effort, the remainder label will be **"Uncategorized"** — the time was tracked but not assigned to a specific category.

### Changes

#### 1. Project Detail — Category chart as percentage of Total Effort
**File: `src/pages/Projects.tsx`** — `categoryBreakdown` memo (line ~181)

- After summing raw category hours, normalize them proportionally against the project's `total_hours`.
- If raw sum exceeds `total_hours`, scale each category down proportionally so they sum to 100%.
- If raw sum is less than `total_hours`, add an "Uncategorized" slice for the remainder.
- Display format: each bar shows `X% (Yh)` where Y = percentage × total_hours.
- Update tooltip formatter and chart labels accordingly.

#### 2. Development Page — Category hours chart
**File: `src/pages/Development.tsx`** — `categoryHours` memo (line ~266)

- Currently sums raw `time_entries.hours` per category across filtered projects. This is the aggregate view.
- Apply the same proportional normalization: for each project, compute category shares relative to that project's `total_hours`, then aggregate the normalized hours across projects.
- This ensures the Development page category totals align with each project's Total Effort rather than raw time entry sums.

#### 3. Data Explorer — Add context
**File: `src/pages/DataExplorer.tsx`**

- Add a small info note below the header explaining that hours shown are raw category entries from the Time Spent file and may not sum to a project's Total Effort.

#### 4. Cross-source data joining
**Files: `src/pages/UploadData.tsx`, `src/lib/parse-sme-survey.ts`**

- The join key between data sources is **Course Name + Year**. The upload logic already uses `courseKey(courseName, reportingYear)` as the composite key.
- Verify the SME survey parser maps the `Year` column to `reportingYear` for consistent joining. If not, add that mapping.
- Ensure `normKey()` normalization (trim, lowercase, collapse whitespace) is applied consistently across all parsers before joining.

#### 5. Dashboard — No changes needed
The dashboard hours card already sums `projects.total_hours` from Legacy/Modern files, which is the authoritative Total Effort. Project counts also come from the projects table. These are correct per your intent.

### Technical Detail: Proportional Normalization Formula

```text
For a single project with total_hours = T:
  rawCategorySum = Σ(time_entry.hours per category)
  
  For each category C:
    share = categoryHours[C] / rawCategorySum
    normalizedHours = share × T
    percentage = share × 100
  
  If rawCategorySum < T:
    uncategorizedHours = T - (Σ normalizedHours)
    Add "Uncategorized" entry with uncategorizedHours
```

### Files Modified
- `src/pages/Projects.tsx` — Normalize category breakdown against Total Effort
- `src/pages/Development.tsx` — Normalize aggregate category hours per project's Total Effort
- `src/pages/DataExplorer.tsx` — Add contextual note about raw hours
- `src/lib/parse-sme-survey.ts` — Verify Year → reportingYear mapping for cross-source joining

