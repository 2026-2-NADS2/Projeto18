import { readFileSync } from "node:fs";
import { runReport } from "./print.ts";
import type { Rule } from "../core/model.ts";

const path = process.argv[2];
if (!path) {
  console.error("uso: node src/cli/report.ts <fixture.json>");
  process.exit(1);
}

const rules = JSON.parse(readFileSync(path, "utf8")) as Rule[];
runReport(rules, path);
