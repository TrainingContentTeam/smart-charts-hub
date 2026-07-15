import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const TARGET_PROJECT_REF = "pvxqgtazxmvbnneuaabs";
const BATCH_SIZE = 500;
const TABLES = [
  { name: "upload_history", numeric: ["file_size", "row_count"] },
  {
    name: "raw_project_import_rows",
    numeric: ["row_number", "project_total_minutes", "interaction_count"],
    json: { raw_row: {}, parse_warnings: [] },
    uploadReference: true,
  },
  {
    name: "raw_time_log_rows",
    numeric: ["row_number", "minutes"],
    json: { raw_row: {}, parse_warnings: [] },
    uploadReference: true,
  },
  {
    name: "raw_sme_feedback_rows",
    numeric: ["row_number", "hours_worked", "amount_billed"],
    json: { raw_row: {}, parse_warnings: [] },
    uploadReference: true,
  },
  { name: "course_alias_config" },
  { name: "person_alias_config" },
  { name: "person_role_config" },
  { name: "sme_manual_join_overrides" },
  { name: "work_entity_decisions" },
  { name: "user_roles" },
];

function loadEnvFile(fileName) {
  if (!fs.existsSync(fileName)) return;
  for (const line of fs.readFileSync(fileName, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name]) continue;
    process.env[name] = rawValue.trim().replace(/^(["'])(.*)\1$/, "$2");
  }
}

function parseArgs(argv) {
  const args = { input: "migration-data", apply: false, bootstrapOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--apply") args.apply = true;
    else if (value === "--bootstrap-only") args.bootstrapOnly = true;
    else if (value === "--input") args.input = argv[++index];
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  npm run migrate:dry-run
  npm run migrate:apply
  node scripts/migrate-lovable-export.mjs --input <directory> [--apply]
  node scripts/migrate-lovable-export.mjs --bootstrap-only [--apply]

Required environment variables in .env.migration:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Optional:
  MIGRATION_ADMIN_EMAIL  Grants the first admin role after a successful apply.`);
}

function findCsv(inputDirectory, baseNames) {
  for (const baseName of baseNames) {
    for (const fileName of [`${baseName}.csv`, `public_${baseName}.csv`, `public.${baseName}.csv`]) {
      const candidate = path.join(inputDirectory, fileName);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export function readCsv(fileName) {
  const workbook = XLSX.readFile(fileName, { raw: false, cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
}

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseJsonValue(value, fallback, tableName, columnName, rowNumber, errors) {
  if (value === null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    errors.push(`${tableName} row ${rowNumber}: ${columnName} is not valid JSON`);
    return fallback;
  }
}

export function coerceRow(row, table, rowNumber, errors) {
  const coerced = { ...row };
  for (const columnName of ["id", "upload_id", "user_id"]) {
    if (columnName in coerced && (coerced[columnName] === "" || coerced[columnName] === null)) {
      coerced[columnName] = null;
    }
  }
  for (const columnName of table.numeric ?? []) {
    if (!(columnName in coerced) || coerced[columnName] === null || coerced[columnName] === "") {
      coerced[columnName] = null;
      continue;
    }
    const number = Number(coerced[columnName]);
    if (!Number.isFinite(number)) {
      errors.push(`${table.name} row ${rowNumber}: ${columnName} is not numeric`);
    } else {
      coerced[columnName] = number;
    }
  }
  for (const [columnName, fallback] of Object.entries(table.json ?? {})) {
    coerced[columnName] = parseJsonValue(
      coerced[columnName],
      fallback,
      table.name,
      columnName,
      rowNumber,
      errors,
    );
  }
  return coerced;
}

async function listTargetUsers(supabase) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

export function buildUserMapping(oldUsers, targetUsers, errors) {
  const targetsByEmail = new Map();
  for (const user of targetUsers) {
    const email = normalizeEmail(user.email);
    if (!email) continue;
    if (targetsByEmail.has(email)) errors.push(`Target Supabase has duplicate auth email: ${email}`);
    targetsByEmail.set(email, user.id);
  }

  const mapping = new Map();
  const missingUsers = [];
  for (const oldUser of oldUsers) {
    const oldId = String(oldUser.id ?? oldUser.user_id ?? "").trim();
    const email = normalizeEmail(oldUser.email);
    if (!oldId || !email) {
      errors.push("auth_users.csv must contain id (or user_id) and email for every row");
      continue;
    }
    const targetId = targetsByEmail.get(email);
    if (!targetId) {
      missingUsers.push(email);
      continue;
    }
    mapping.set(oldId, targetId);
  }
  return { mapping, missingUsers, targetsByEmail };
}

export function remapUsers(tableName, rows, mapping, targetUserIds, errors) {
  return rows.map((row, index) => {
    if (!("user_id" in row) || row.user_id === null || row.user_id === "") return row;
    const oldId = String(row.user_id).trim();
    if (mapping.has(oldId)) return { ...row, user_id: mapping.get(oldId) };
    if (targetUserIds.has(oldId)) return row;
    errors.push(`${tableName} row ${index + 2}: user_id ${oldId} has no email mapping`);
    return row;
  });
}

function validateIds(tableName, rows, errors) {
  const ids = new Set();
  rows.forEach((row, index) => {
    if (!row.id) {
      errors.push(`${tableName} row ${index + 2}: id is required to preserve primary keys`);
      return;
    }
    if (ids.has(row.id)) errors.push(`${tableName}: duplicate id ${row.id}`);
    ids.add(row.id);
  });
  return ids;
}

async function fetchExistingIds(supabase, tableName, ids) {
  const existing = new Set();
  const values = [...ids];
  for (let index = 0; index < values.length; index += BATCH_SIZE) {
    const batch = values.slice(index, index + BATCH_SIZE);
    if (batch.length === 0) continue;
    const { data, error } = await supabase.from(tableName).select("id").in("id", batch);
    if (error) throw error;
    data.forEach((row) => existing.add(row.id));
  }
  return existing;
}

async function validateUploadReferences(supabase, datasets, errors) {
  const exportedUploadIds = new Set((datasets.get("upload_history") ?? []).map((row) => row.id));
  const externalReferences = new Set();
  for (const table of TABLES.filter((item) => item.uploadReference)) {
    for (const row of datasets.get(table.name) ?? []) {
      if (row.upload_id && !exportedUploadIds.has(row.upload_id)) externalReferences.add(row.upload_id);
    }
  }
  const existing = await fetchExistingIds(supabase, "upload_history", externalReferences);
  for (const id of externalReferences) {
    if (!existing.has(id)) errors.push(`Referenced upload_history id is missing: ${id}`);
  }
}

async function upsertRows(supabase, tableName, rows) {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const { error } = await supabase.from(tableName).upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`${tableName}: ${error.message}`);
  }
}

async function verifyRows(supabase, tableName, rows) {
  const importedIds = await fetchExistingIds(supabase, tableName, new Set(rows.map((row) => row.id)));
  const { count, error } = await supabase
    .from(tableName)
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return { importedIds: importedIds.size, targetRows: count ?? 0 };
}

async function main() {
  loadEnvFile(path.resolve(".env.migration"));
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.migration");
  }
  if (new URL(supabaseUrl).hostname !== `${TARGET_PROJECT_REF}.supabase.co`) {
    throw new Error(`Refusing to use a target other than ${TARGET_PROJECT_REF}`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const errors = [];
  const inputDirectory = path.resolve(args.input);
  const targetUsers = await listTargetUsers(supabase);
  const targetUserIds = new Set(targetUsers.map((user) => user.id));
  const usersFile = findCsv(inputDirectory, ["auth_users", "users"]);
  const oldUsers = usersFile ? readCsv(usersFile) : [];
  const { mapping, missingUsers, targetsByEmail } = buildUserMapping(oldUsers, targetUsers, errors);

  if (!args.bootstrapOnly && !usersFile) {
    errors.push(`Missing ${path.join(inputDirectory, "auth_users.csv")}`);
  }
  if (missingUsers.length > 0) {
    errors.push(`Users must sign in to the new app before migration: ${missingUsers.join(", ")}`);
  }

  const datasets = new Map();
  for (const table of TABLES) {
    const fileName = findCsv(inputDirectory, [table.name]);
    if (!fileName) continue;
    const rows = readCsv(fileName).map((row, index) => coerceRow(row, table, index + 2, errors));
    const remappedRows = remapUsers(table.name, rows, mapping, targetUserIds, errors);
    validateIds(table.name, remappedRows, errors);
    datasets.set(table.name, remappedRows);
  }

  if (!args.bootstrapOnly && datasets.size === 0) {
    errors.push(`No table CSV exports found in ${inputDirectory}`);
  }
  await validateUploadReferences(supabase, datasets, errors);

  const adminEmail = normalizeEmail(process.env.MIGRATION_ADMIN_EMAIL);
  if (adminEmail && !targetsByEmail.has(adminEmail)) {
    errors.push(`MIGRATION_ADMIN_EMAIL has not signed in to the target project: ${adminEmail}`);
  }

  console.log(`Mode: ${args.apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Target: ${supabaseUrl}`);
  console.log(`Target auth users: ${targetUsers.length}`);
  console.log(`Mapped legacy users: ${mapping.size}/${oldUsers.length}`);
  for (const table of TABLES) {
    if (datasets.has(table.name)) console.log(`${table.name}: ${datasets.get(table.name).length} source rows`);
  }

  if (errors.length > 0) {
    console.error("\nMigration blocked:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  if (!args.apply) {
    console.log("\nDry run passed. Re-run with --apply to write to the target project.");
    return;
  }

  for (const table of TABLES) {
    const rows = datasets.get(table.name) ?? [];
    if (rows.length > 0) await upsertRows(supabase, table.name, rows);
  }

  if (adminEmail) {
    const { error } = await supabase
      .from("user_roles")
      .upsert(
        { user_id: targetsByEmail.get(adminEmail), role: "admin" },
        { onConflict: "user_id,role" },
      );
    if (error) throw new Error(`Unable to bootstrap admin: ${error.message}`);
  }

  console.log("\nVerification:");
  for (const table of TABLES) {
    const rows = datasets.get(table.name) ?? [];
    if (rows.length === 0) continue;
    const result = await verifyRows(supabase, table.name, rows);
    console.log(
      `${table.name}: ${result.importedIds}/${rows.length} imported IDs present; ${result.targetRows} total target rows`,
    );
    if (result.importedIds !== rows.length) process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
