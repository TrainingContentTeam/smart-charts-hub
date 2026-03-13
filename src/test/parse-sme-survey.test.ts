import { describe, expect, it } from "vitest";
import { parseSmeSurveyFile } from "@/lib/parse-sme-survey";
import * as XLSX from "xlsx";

function makeFile(rows: Record<string, unknown>[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return {
    name: "sme.xlsx",
    arrayBuffer: async () => buffer,
  } as File;
}

describe("parseSmeSurveyFile", () => {
  it("parses likert, numeric, boolean, and money fields", async () => {
    const file = makeFile([
      {
        CourseKey: "ABC-123",
        "Course Name": "Course Alpha",
        Year: "2026",
        "Hours Worked": "12.5",
        "Amount Billed": "$1,250.00",
        "Survey Date": "3/1/2026",
        SME: "Jane Doe",
        "SME Email": "JANE@example.com",
        "Overall Experience with Lexipol": "Strongly Agree",
        "Clarity of Goals and Objectives": "Agree",
        "Staff Responsiveness": "Neutral",
        "Adequacy of Tools and Resources": "Disagree",
        "Training and Support Provided": "Strongly Disagree",
        "Use of My Expertise": "5",
        "Incorporation of My Feedback": "4",
        "Autonomy in Course Design": "3",
        "Feeling Valued as an SME": "2",
        "Likelihood to Recommend Lexipol": "1",
        "Additional Feedback or Suggestions": "Helpful team",
        "Instructional Designer - ID": "ID-42",
        "Overall Rating of SME Collaboration - ID": "5",
        "SME's knowledge and expertise - ID": "4",
        "Responsiveness - ID": "3",
        "Instructional design knowledge - ID": "2",
        "Contribution to development - ID": "1",
        "Openness suggestions and feedback - ID": "5",
        "Deadlines and schedule - ID": "4",
        "Overall quality end product - ID": "3",
        "SME assistance in interactions - ID": "2",
        "Realworld examples - ID": "Yes",
        "SME Promoter Score - ID": "9",
        "Additional Comments - ID": "Strong examples",
        Created: "2026-03-02T15:30:00Z",
      },
    ]);

    const [row] = await parseSmeSurveyFile(file);

    expect(row.courseKeyRaw).toBe("ABC-123");
    expect(row.courseName).toBe("Course Alpha");
    expect(row.reportingYear).toBe("2026");
    expect(row.hoursWorked).toBe(12.5);
    expect(row.amountBilled).toBe(1250);
    expect(row.effectiveHourlyRate).toBe(100);
    expect(row.surveyDate).toBe("2026-03-01");
    expect(row.smeEmail).toBe("jane@example.com");
    expect(row.smeOverallExperienceScore).toBe(5);
    expect(row.trainingSupportScore).toBe(1);
    expect(row.recommendLexipolScore).toBe(1);
    expect(row.idOverallCollaborationScore).toBe(5);
    expect(row.idContributionDevelopmentScore).toBe(1);
    expect(row.idRealworldExamplesIncluded).toBe(true);
    expect(row.idSmePromoterScore).toBe(9);
    expect(row.additionalCommentsId).toBe("Strong examples");
    expect(row.sourceCreatedAt).toBe("2026-03-02T15:30:00.000Z");
  });

  it("keeps invalid score shapes null while still parsing the row", async () => {
    const file = makeFile([
      {
        "Course Name": "Course Beta",
        Year: "2027",
        "Hours Worked": "",
        "Amount Billed": "",
        "Overall Experience with Lexipol": "Sometimes",
        "Overall Rating of SME Collaboration - ID": "8",
        "SME Promoter Score - ID": "11",
        "Realworld examples - ID": "Maybe",
      },
    ]);

    const [row] = await parseSmeSurveyFile(file);

    expect(row.courseName).toBe("Course Beta");
    expect(row.smeOverallExperienceScore).toBeNull();
    expect(row.idOverallCollaborationScore).toBeNull();
    expect(row.idSmePromoterScore).toBeNull();
    expect(row.idRealworldExamplesIncluded).toBeNull();
    expect(row.hoursWorked).toBe(0);
    expect(row.amountBilled).toBe(0);
  });
});
