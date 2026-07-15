// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildUserMapping,
  coerceRow,
  readCsv,
  remapUsers,
} from "../../scripts/migrate-lovable-export.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
});

describe("Lovable migration utilities", () => {
  it("reads a CSV export without changing IDs or email text", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "analytics-migration-"));
    temporaryDirectories.push(directory);
    const csvPath = path.join(directory, "auth_users.csv");
    fs.writeFileSync(csvPath, "id,email\nold-user-id,Person@Example.com\n", "utf8");

    expect(readCsv(csvPath)).toEqual([
      { id: "old-user-id", email: "Person@Example.com" },
    ]);
  });

  it("maps legacy users by normalized email and replaces user IDs", () => {
    const errors: string[] = [];
    const { mapping, missingUsers } = buildUserMapping(
      [{ id: "old-user-id", email: "Person@Example.com" }],
      [{ id: "new-user-id", email: "person@example.com" }],
      errors,
    );

    const rows = remapUsers(
      "upload_history",
      [{ id: "upload-id", user_id: "old-user-id" }],
      mapping,
      new Set(["new-user-id"]),
      errors,
    );

    expect(missingUsers).toEqual([]);
    expect(errors).toEqual([]);
    expect(rows[0].user_id).toBe("new-user-id");
  });

  it("coerces exported numeric and JSON fields for PostgREST", () => {
    const errors: string[] = [];
    const row = coerceRow(
      {
        id: "row-id",
        user_id: "",
        row_number: "12",
        minutes: "90.5",
        raw_row: '{"Course Name":"Example"}',
        parse_warnings: '["warning"]',
      },
      {
        name: "raw_time_log_rows",
        numeric: ["row_number", "minutes"],
        json: { raw_row: {}, parse_warnings: [] },
      },
      2,
      errors,
    );

    expect(errors).toEqual([]);
    expect(row).toMatchObject({
      user_id: null,
      row_number: 12,
      minutes: 90.5,
      raw_row: { "Course Name": "Example" },
      parse_warnings: ["warning"],
    });
  });
});
