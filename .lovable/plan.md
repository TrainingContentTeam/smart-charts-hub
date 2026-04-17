
# Fix plan for `time zone displacement out of range: "+045217-01"`

## What I found

- The `/upload` page uses `src/lib/analytics/source-readers.ts` for all four file types.
- The primary risky code is `parseDateToIso()` in that file:
  - it handles Excel serials when they are actual numbers
  - it handles plain integer serial strings like `"45217"`
  - but it still falls back to `new Date(text)` for anything else
- That fallback is unsafe for spreadsheet-exported values. A value that looks numeric-but-not-exactly-integer (for example decimal serials, partially formatted serials, or odd date fragments) can be interpreted as a huge year-like string and then sent to the database as an invalid date, which matches the error you saw.
- There are older duplicate parsers with the same pattern in:
  - `src/lib/parse-sme-survey.ts`
  - `src/lib/parse-time-spent.ts`
  - `src/lib/parse-catalog-date.ts`

## Root cause

This is not mainly a database problem. It is a parsing problem before insert:
- an Excel-style serial/date-like string is slipping past the guarded cases
- `new Date(...)` is converting it into a malformed far-future date shape
- that malformed value is then inserted into a `date` column, causing Postgres to throw the timezone displacement error

## Implementation plan

### 1. Harden the canonical upload parser first
Update `src/lib/analytics/source-readers.ts` so `parseDateToIso()`:
- accepts Excel serials as:
  - numbers
  - integer strings
  - decimal strings like `"45217.0"` or `"45217.5"`
- converts serials with a dedicated helper instead of falling through
- removes or drastically restricts the generic `new Date(text)` fallback
- only accepts clearly supported formats:
  - Excel serial
  - `YYYY-MM-DD`
  - `M/D/YYYY`
  - optionally `MM/DD/YYYY HH:MM[:SS]` if needed
- returns `null` for anything ambiguous, so the row gets a parse warning instead of breaking the upload

### 2. Apply the same safe parsing rule everywhere else
Align the other date helpers so the app does not keep reintroducing the same bug in other flows:
- `src/lib/parse-sme-survey.ts`
- `src/lib/parse-time-spent.ts`
- `src/lib/parse-catalog-date.ts`

Best approach: either reuse one shared safe parser or copy the stricter logic consistently.

### 3. Add regression tests
Add/extend tests to cover:
- Excel serial as number: `45217`
- Excel serial as string: `"45217"`
- Excel serial with decimal: `"45217.0"` and `"45217.5"`
- normal slash date: `"3/1/2026"`
- ISO date: `"2026-03-01"`
- ambiguous/invalid values that should return `null` or `""`, not a malformed date

This is the key guard against the same upload failure returning later.

### 4. Keep upload behavior resilient
Where rows are built in `source-readers.ts`:
- preserve the existing warning behavior (`Could not confidently parse log date.` / `survey date`)
- do not throw on a bad date string
- let the row upload with `log_date` / `survey_date` as `null` when needed

## Expected result

After this fix:
- uploads should stop failing with the timezone displacement error
- malformed date cells will be treated as parse warnings instead of hard failures
- numeric Excel serial dates from CSV/XLS/XLSX should import safely
- all date parsing paths will behave consistently across the app

## Files to update

- `src/lib/analytics/source-readers.ts`
- `src/lib/parse-sme-survey.ts`
- `src/lib/parse-time-spent.ts`
- `src/lib/parse-catalog-date.ts`
- related test files for parsing/import behavior

## Assumption

I’m assuming the bad value is coming from a spreadsheet-exported date/serial field in one of the upload files, not from the schema itself. The code strongly supports that conclusion because the current upload flow parses dates client-side before insert.
