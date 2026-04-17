import { describe, expect, it } from "vitest";
import { buildAnalyticsSnapshot } from "@/lib/analytics/snapshot";
import type { AnalyticsPersistenceBundle, RawProjectImportRow, RawSmeFeedbackRow, RawTimeLogRow } from "@/lib/analytics/types";

function createBundle(overrides?: Partial<AnalyticsPersistenceBundle>): AnalyticsPersistenceBundle {
  return {
    uploadHistory: [],
    rawProjectImportRows: [],
    rawTimeLogRows: [],
    rawSmeFeedbackRows: [],
    courseAliasConfig: [],
    personAliasConfig: [],
    personRoleConfig: [],
    smeManualJoinOverrides: [],
    workEntityDecisions: [],
    ...overrides,
  };
}

function createProjectRow(partial: Partial<RawProjectImportRow> = {}): RawProjectImportRow {
  return {
    id: partial.id || crypto.randomUUID(),
    upload_id: null,
    user_id: null,
    source_dataset: "legacy",
    source_file_name: "legacy.csv",
    row_number: 1,
    raw_row: {},
    raw_course_name: "Course Alpha",
    normalized_course_name: "Course Alpha",
    compact_course_name: "coursealpha",
    reporting_label: "2026 Courses",
    reporting_year: "2026",
    raw_status: "LP Development",
    raw_time_spent: "2:00",
    project_total_minutes: 120,
    id_assigned_raw: "Alex Doe, Sam Roe",
    sme_assigned_raw: "Taylor SME",
    legal_reviewer_raw: "Lee Legal",
    vertical_raw: 'EMS1A, "Fire"',
    course_type: "New",
    authoring_tool: "Rise",
    course_style: "Scenario",
    course_length_raw: "1 hr",
    interaction_count: 8,
    parse_warnings: [],
    created_at: "2026-04-17T00:00:00.000Z",
    ...partial,
  };
}

function createTimeLogRow(partial: Partial<RawTimeLogRow>): RawTimeLogRow {
  return {
    id: partial.id || crypto.randomUUID(),
    upload_id: null,
    user_id: null,
    source_file_name: "time.csv",
    row_number: 1,
    raw_row: {},
    raw_course_name: "Course Alpha",
    normalized_course_name: "Course Alpha",
    compact_course_name: "coursealpha",
    raw_category: "LP Development LC",
    raw_date: "2026-04-10",
    log_date: "2026-04-10",
    raw_time_spent: "1:30",
    minutes: 90,
    raw_user: "Alex Doe",
    parse_warnings: [],
    created_at: "2026-04-17T00:00:00.000Z",
    ...partial,
  };
}

function createSmeRow(partial: Partial<RawSmeFeedbackRow>): RawSmeFeedbackRow {
  return {
    id: partial.id || crypto.randomUUID(),
    upload_id: null,
    user_id: null,
    source_file_name: "sme.csv",
    row_number: 1,
    raw_row: {
      "Overall Rating of SME Collaboration - ID": "5",
      "SME Promoter Score - ID": "9",
      "Overall Experience with Lexipol": "Agree",
      "Clarity of Goals and Objectives": "Agree",
    },
    course_key_raw: "Course Alpha",
    course_key_normalized: "Course Alpha",
    course_key_compact: "coursealpha",
    course_name_raw: "Course Alpha",
    course_name_normalized: "Course Alpha",
    course_name_compact: "coursealpha",
    reporting_year: "2026",
    id_survey_raw_created: "04/11/2026 14:30",
    id_survey_created_at: "2026-04-11T14:30:00",
    id_survey_date: "2026-04-11",
    id_survey_date_source: "Created",
    sme_survey_raw_date: "4/11/26",
    sme_survey_date: "2026-04-11",
    sme_survey_date_source: "Survey Date",
    sme_raw: "Taylor SME",
    instructional_designer_raw: "Alex Doe",
    sme_email_raw: "taylor@example.com",
    internal_raw: "No",
    hours_worked: 10,
    amount_billed: 1000,
    parse_warnings: [],
    created_at: "2026-04-17T00:00:00.000Z",
    ...partial,
  };
}

describe("buildAnalyticsSnapshot", () => {
  it("dedupes canonical projects by status rank and preserves duplicate audit", () => {
    const snapshot = buildAnalyticsSnapshot(createBundle({
      rawProjectImportRows: [
        createProjectRow({ id: "project-low", raw_status: "LP Development", project_total_minutes: 300 }),
        createProjectRow({ id: "project-high", raw_status: "**Published**", project_total_minutes: 180, source_dataset: "modern" }),
      ],
    }));

    expect(snapshot.canonicalProjects).toHaveLength(1);
    expect(snapshot.canonicalProjects[0].status).toBe("Published");
    expect(snapshot.projectDuplicateAudit).toHaveLength(1);
    expect(snapshot.projectOwnerBridge).toHaveLength(2);
    expect(snapshot.projectVerticalBridge.map((row) => row.vertical)).toEqual(["EMS1", "FIRE"]);
  });

  it("keeps project totals separate from matched time log totals and flags discrepancies", () => {
    const snapshot = buildAnalyticsSnapshot(createBundle({
      rawProjectImportRows: [createProjectRow({ project_total_minutes: 120 })],
      rawTimeLogRows: [createTimeLogRow({ minutes: 90 })],
    }));

    expect(snapshot.canonicalProjects[0].project_total_minutes).toBe(120);
    expect(snapshot.canonicalProjects[0].time_log_minutes_sum).toBe(90);
    expect(snapshot.canonicalProjects[0].hours_discrepancy_flag).toBe(true);
    expect(snapshot.timeLogs[0].work_match_status).toBe("matched_project_work");
  });

  it("classifies unmatched course-like and operational time logs without forcing them into projects", () => {
    const snapshot = buildAnalyticsSnapshot(createBundle({
      rawProjectImportRows: [createProjectRow()],
      rawTimeLogRows: [
        createTimeLogRow({ id: "standalone", raw_course_name: "Single Video Safety Module", normalized_course_name: "", compact_course_name: "", raw_category: "Media Development LC", minutes: 60 }),
        createTimeLogRow({ id: "operational", raw_course_name: "Admin Meeting Follow Up", normalized_course_name: "", compact_course_name: "", raw_category: "In Process LC", minutes: 30 }),
      ],
    }));

    const standalone = snapshot.timeLogs.find((row) => row.raw_time_log_row_id === "standalone");
    const operational = snapshot.timeLogs.find((row) => row.raw_time_log_row_id === "operational");

    expect(standalone?.work_match_status).toBe("standalone_video_course");
    expect(standalone?.work_entity_type).toBe("standalone_course");
    expect(operational?.work_match_status).toBe("non_project_work");
    expect(operational?.work_entity_type).toBe("operational_work");
  });

  it("applies manual course aliases and safe SME join logic without auto-resolving ambiguous rows", () => {
    const snapshot = buildAnalyticsSnapshot(createBundle({
      rawProjectImportRows: [
        createProjectRow({ id: "course-alpha", raw_course_name: "Course Alpha" }),
        createProjectRow({ id: "arff", raw_course_name: "Aircraft Rescue and Firefighting (ARFF) Basic Skills" }),
        createProjectRow({ id: "year-2025", raw_course_name: "Course Family", reporting_label: "2025 Courses", reporting_year: "2025" }),
        createProjectRow({ id: "year-2026", raw_course_name: "Course Family", reporting_label: "2026 Courses", reporting_year: "2026", source_dataset: "modern" }),
      ],
      rawTimeLogRows: [
        createTimeLogRow({ id: "alias-match", raw_course_name: "Intro to ARFF", normalized_course_name: "", compact_course_name: "" }),
      ],
      rawSmeFeedbackRows: [
        createSmeRow({ id: "coursekey-exact", course_key_raw: "Course Alpha", course_key_compact: "coursealpha", course_name_raw: "Course Alpha", course_name_compact: "coursealpha" }),
        createSmeRow({ id: "ambiguous", course_key_raw: "", course_key_compact: "", course_name_raw: "Course Family", course_name_compact: "coursefamily", reporting_year: null }),
      ],
      courseAliasConfig: [
        {
          id: "alias-config",
          alias_title_raw: "Intro to ARFF",
          alias_title_normalized: "Intro to ARFF",
          alias_title_compact: "introtoarff",
          canonical_title_raw: "Aircraft Rescue and Firefighting (ARFF) Basic Skills",
          canonical_title_normalized: "Aircraft Rescue and Firefighting (ARFF) Basic Skills",
          canonical_title_compact: "aircraftrescueandfirefightingarffbasicskills",
          reporting_year: "2026",
          target_project_key: null,
          alias_scope: "all",
          notes: null,
          user_id: null,
          created_at: "2026-04-17T00:00:00.000Z",
          updated_at: "2026-04-17T00:00:00.000Z",
        },
      ],
    }));

    expect(snapshot.timeLogs.find((row) => row.raw_time_log_row_id === "alias-match")?.work_match_status).toBe("matched_project_work");
    expect(snapshot.smeJoinAudit.find((row) => row.raw_sme_feedback_row_id === "coursekey-exact")?.join_method).toBe("coursekey_exact");
    expect(snapshot.smeFeedbackIdView.find((row) => row.raw_sme_feedback_row_id === "coursekey-exact")?.id_survey_created_at).toBe("2026-04-11T14:30:00");
    expect(snapshot.smeFeedbackSmeView.find((row) => row.raw_sme_feedback_row_id === "coursekey-exact")?.sme_survey_date).toBe("2026-04-11");
    expect(snapshot.smeJoinAudit.find((row) => row.raw_sme_feedback_row_id === "ambiguous")?.join_status).toBe("ambiguous");
  });
});
