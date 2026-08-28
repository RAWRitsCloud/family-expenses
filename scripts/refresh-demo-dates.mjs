#!/usr/bin/env node
// Keeps the bundled demo data (src/data/expenses.json) looking current.
//
// The demo dataset tells a little story relative to "today": a handful of
// entries in the recent past, a couple of clubs that already ended, and one
// upcoming entry. Left alone, those hardcoded dates drift into the past and
// the demo starts looking stale. Instead of hand-editing them, every date in
// the file is defined here as an offset (in days) from whenever this script
// runs, so re-running it — e.g. from a monthly GitHub Action — recomputes
// dates that keep the same shape relative to "today".
//
// Usage: node scripts/refresh-demo-dates.mjs [--date=YYYY-MM-DD]

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "../src/data/expenses.json");

// Offsets are measured in days from "today" (negative = past, positive = future).
// They mirror the relative spacing the demo data was originally written with.
const DATE_OFFSETS = [
  { expense: "Swimming Lessons", entry: "Badge assessment", offsetDays: -144 },
  { expense: "Dance Class", entry: "Show costume contribution", offsetDays: -118 },
  { expense: "Football Club", entry: "Tournament fee", offsetDays: -102 },
  { expense: "After-school Club", entry: "Holiday craft session", offsetDays: -77 },
  { expense: "After-school Club", entry: "Art workshop", offsetDays: -49 },
  { expense: "Holiday Camp", entry: "Summer camp deposit", offsetDays: -30 },
  { expense: "Holiday Camp", entry: "Activity balance", offsetDays: -13 },
  { expense: "Train Pass", entry: "Autumn term pass", offsetDays: 34 },
  { expense: "Cinema Club", field: "endDate", offsetDays: -61 },
  { expense: "Football Club", field: "endDate", offsetDays: -31 },
];

function parseDateArg(argv) {
  const arg = argv.find((value) => value.startsWith("--date="));
  if (!arg) return new Date();
  const [, value] = arg.split("=");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --date value: ${value}`);
  }
  return parsed;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(baseDate, offsetDays) {
  const next = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate())
  );
  next.setUTCDate(next.getUTCDate() + offsetDays);
  return next;
}

function applyOffsets(data, today) {
  let changed = false;

  for (const { expense: expenseName, entry: entryDescription, field, offsetDays } of DATE_OFFSETS) {
    const expense = data.expenses.find((candidate) => candidate.name === expenseName);
    if (!expense) {
      console.warn(`Skipping "${expenseName}": expense not found in ${DATA_PATH}`);
      continue;
    }

    const nextDate = formatDate(addDays(today, offsetDays));

    if (field === "endDate") {
      if (expense.endDate !== nextDate) {
        expense.endDate = nextDate;
        changed = true;
      }
      continue;
    }

    const entry = (expense.entries || []).find((candidate) => candidate.description === entryDescription);
    if (!entry) {
      console.warn(`Skipping "${expenseName}" / "${entryDescription}": entry not found`);
      continue;
    }
    if (entry.date !== nextDate) {
      entry.date = nextDate;
      changed = true;
    }
  }

  return changed;
}

async function main() {
  const today = parseDateArg(process.argv.slice(2));
  const raw = await readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw);

  const changed = applyOffsets(data, today);

  if (!changed) {
    console.log("Demo dates already up to date, nothing to write.");
    return;
  }

  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Updated demo dates in ${path.relative(process.cwd(), DATA_PATH)} relative to ${formatDate(today)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
