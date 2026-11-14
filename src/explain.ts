// Turn a problem from validate() into a sentence for the form.
//   "/entries/2/sameAs must NOT have fewer than 1 items" -> "Links: add one or more."

const labels: Record<string, string> = {
  id: "Id",
  name: "Name",
  kind: "Kind",
  relation: "Relation",
  sameAs: "Links",
  tags: "Tags",
  notes: "Notes",
  added: "Date added",
  gave: "What it gave",
  creditedIn: "Credited in",
  owner: "Owner",
  type: "Type",
  url: "Link",
  formatVersion: "Format version",
  entries: "Entries",
};

export function explain(problem: string): string {
  const space = problem.indexOf(" ");
  const path = problem.slice(0, space);
  let rest = problem.slice(space + 1);

  // "/entries/2/creditedIn/0/url" -> ["creditedIn", "url"]
  const parts = path
    .replace(/^\/entries\/\d+/, "")
    .split("/")
    .filter((p) => p !== "" && !/^\d+$/.test(p));

  const missing = rest.match(/^must have required property '(.+)'$/);
  if (missing) {
    parts.push(missing[1]);
    rest = "is needed.";
  } else if (/fewer than 1 items/.test(rest)) {
    rest = "add one or more.";
  } else if (/format "uri"|pattern "\^https\?:\/\/"/.test(rest)) {
    rest = "each one must be a full link that starts with http:// or https://.";
  } else if (/pattern "\\S"|fewer than 1 characters/.test(rest)) {
    rest = "cannot be empty.";
  } else if (/format "date"/.test(rest)) {
    rest = "must be a real date, as YYYY-MM-DD.";
  } else if (/must match pattern/.test(rest)) {
    rest = "use lower-case letters, digits and hyphens only.";
  } else if (/duplicate items/.test(rest)) {
    rest = "the same value is there twice.";
  } else if (!/[.!?]$/.test(rest)) {
    rest += ".";
  }

  const label = parts.map((p) => labels[p] ?? p).join(", ") || "Profile";
  return `${label}: ${rest}`;
}

export function explainAll(problems: string[]): string[] {
  return [...new Set(problems.map(explain))];
}
