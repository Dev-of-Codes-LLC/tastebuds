// Check a profile file against the format.
//
//   node scripts/validate.mjs examples/profile.json
//
// Exit code 0 when the file is valid, 1 when it is not, 2 on a usage error.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const read = (url) => JSON.parse(readFileSync(url, "utf8"));

export const schema = read(new URL("../schema/profile.schema.json", import.meta.url));
export const kinds = read(new URL("../schema/kinds.json", import.meta.url));

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const check = ajv.compile(schema);

// Returns a list of problems. An empty list means the profile is valid.
export function validate(profile) {
  if (!check(profile)) {
    return check.errors.map((e) => `${e.instancePath || "/"} ${e.message}`);
  }
  // JSON Schema cannot say "unique by id", so this is checked here.
  const problems = [];
  const seen = new Map();
  profile.entries.forEach((entry, i) => {
    if (seen.has(entry.id)) {
      problems.push(`/entries/${i}/id "${entry.id}" is already used by /entries/${seen.get(entry.id)}`);
    } else {
      seen.set(entry.id, i);
    }
  });
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
}
