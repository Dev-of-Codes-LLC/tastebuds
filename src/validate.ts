// Check a profile against the format. Used by the app, the tests and the
// command line script.

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../schema/profile.schema.json" with { type: "json" };
import kinds from "../schema/kinds.json" with { type: "json" };

export { schema, kinds };

// Ajv is a CommonJS package: a bundler hands over the class, plain Node may
// hand over the module object. Take the class from either.
const pick = (m: any) => m?.default ?? m;
const ajv = new (pick(Ajv2020))({ allErrors: true });
pick(addFormats)(ajv);
const check = ajv.compile(schema);

// Returns a list of problems. An empty list means the profile is valid.
export function validate(profile: unknown): string[] {
  if (!check(profile)) {
    const problems: string[] = [];
    for (const e of check.errors ?? []) {
      // "must match else schema" only repeats the error under it.
      if (e.keyword === "if") continue;
      const path = e.instancePath || "/";
      if (e.keyword === "false schema" && /\/(gave|creditedIn)$/.test(path)) {
        problems.push(`${path} is only allowed on an inspiration`);
      } else if (e.keyword === "additionalProperties") {
        problems.push(`${path} has a field the format does not know: ${e.params.additionalProperty}`);
      } else {
        problems.push(`${path} ${e.message}`);
      }
    }
    return [...new Set(problems)];
  }
  // JSON Schema cannot say "unique by id", so this is checked here.
  const problems: string[] = [];
  const seen = new Map<string, number>();
  (profile as { entries: { id: string }[] }).entries.forEach((entry, i) => {
    if (seen.has(entry.id)) {
      problems.push(`/entries/${i}/id "${entry.id}" is already used by /entries/${seen.get(entry.id)}`);
    } else {
      seen.set(entry.id, i);
    }
  });
  return problems;
}
