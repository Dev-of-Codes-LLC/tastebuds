// Check a profile file against the format.
//
//   node scripts/validate.mjs examples/profile.json
//
// Exit code 0 when the file is valid, 1 when it is not, 2 on a usage error.

import { readFileSync } from "node:fs";
import { validate } from "../src/validate.ts";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/validate.mjs <profile.json> [...]");
  process.exit(2);
}
let failed = false;
for (const file of files) {
  let problems;
  try {
    problems = validate(JSON.parse(readFileSync(file, "utf8")));
  } catch (err) {
    problems = [err.message];
  }
  if (problems.length === 0) {
    console.log(`ok       ${file}`);
  } else {
    failed = true;
    console.log(`invalid  ${file}`);
    for (const p of problems) console.log(`         ${p}`);
  }
}
process.exit(failed ? 1 : 0);
