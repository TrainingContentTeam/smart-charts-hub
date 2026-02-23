
# Project Time Analytics Dashboard

## Overview
A full-featured analytics dashboard tailored for Wrike-exported project and time entry data. Upload Excel/CSV files, and the app parses, stores, and visualizes your training course development time data with charts, KPIs, tables, and AI-powered insights.

---

## Pages & Features

### 1. Dashboard Home
- **KPI Cards**: Total hours logged, number of projects, average hours per project, most time-intensive project, number of development phases tracked
- **Charts**:
  - **Bar chart**: Hours by project (e.g., "Written Communication and Report Writing" vs "Wildland Chainsaws" vs "Wheezing (ALS)")
  - **Pie chart**: Time distribution by development phase (LP Development, Rise Development, Media Development, CQO Review, Testing, etc.)
  - **Bar chart**: Hours by quarter (Q2 2024, Q4 2024, Q3 2025, Q4 2025, etc.)
- **Filters**: Filter by quarter, by project, or by development phase

### 2. Data Upload
- **Drag-and-drop upload** supporting both .xlsx and .csv files
- **Automatic parsing** of the Wrike export format (Task name, Time spent, Project or folder columns)
- **Smart hierarchy detection** — automatically identifies parent tasks (projects), phases (e.g., "LP Development LC"), and individual time entries
- **Preview & validation** before importing — shows parsed data and flags any issues
- **Upload history** — see all past imports with timestamps and row counts

### 3. Projects Overview
- **List of all projects** with total hours and phase breakdown per project
- **Project detail view** — click into any project to see:
  - Hours by phase (bar chart)
  - Individual time entries (table)
  - Quarter distribution

### 4. Data Explorer
- **Full searchable, sortable, filterable table** of all time entries
- Columns: Project, Phase, Time Spent, Quarter
- **Export to CSV** for sharing or further analysis

### 5. AI Insights
- **Automatic analysis** of your data: which projects take the most time, which phases are most intensive, trends across quarters
- **Natural language questions** — ask things like "Which phase takes the most time across all projects?" or "How do Q2 2024 hours compare to Q4 2025?"
- Responses include text summaries and supporting visualizations

---

## Backend
- **Database** to store projects, phases, time entries, and upload history
- **Edge function** for Excel/CSV parsing and data import
- **AI insights edge function** using Lovable AI to analyze stored data on demand

## Design
- Clean, modern dashboard with sidebar navigation
- Dark/light mode
- Responsive for desktop and tablet
