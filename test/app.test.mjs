import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validate } from "../src/validate.ts";
import { toJsonLd } from "../src/jsonld.ts";
import { explainAll } from "../src/explain.ts";
import {
  addEntry,
  freeId,
  moveToInspiration,
  newProfile,
  parseCredits,
  parseLinks,
  parseTags,
  formatCredits,
  removeEntry,
  setOwner,
  slug,
  toFileText,
  updateEntry,
} from "../src/profile.ts";

const example = () =>
  JSON.parse(readFileSync(new URL("../examples/profile.json", import.meta.url), "utf8"));

const reference = {
  id: "odd-hours-radio",
  name: "Odd Hours Radio",
  kind: "channel",
  relation: "tasteReference",
  sameAs: ["https://audio.example/odd-hours"],
  tags: [],
  notes: "  ",
  added: "2026-04-01",
};

test("a new profile is valid and empty", () => {
  const p = newProfile({ type: "Person", name: "Rosa Marin" });
  assert.deepEqual(validate(p), []);
  assert.equal(p.entries.length, 0);
});

test("slug makes an id the format accepts", () => {
  assert.equal(slug("Lantern & Loom"), "lantern-loom");
  assert.equal(slug("  Café Élan!  "), "cafe-elan");
  assert.equal(slug("***"), "");
});

test("freeId never repeats an id", () => {
  const p = example();
  assert.equal(freeId(p, "Teo Okafor"), "teo-okafor-2");
  assert.equal(freeId(p, "Someone New"), "someone-new");
  assert.equal(freeId(p, "***"), "entry");
});

test("adding an entry keeps the profile valid and drops empty fields", () => {
  const p = addEntry(example(), reference);
  assert.deepEqual(validate(p), []);
  const added = p.entries.at(-1);
  assert.equal("notes" in added, false);
  assert.equal("tags" in added, false);
});

test("changes do not touch the profile they start from", () => {
  const before = example();
  const copy = structuredClone(before);
  addEntry(before, reference);
  removeEntry(before, "teo-okafor");
  moveToInspiration(before, "teo-okafor", "A garnish.", [{ name: "A site" }]);
  assert.deepEqual(before, copy);
});

test("removing an entry removes only that entry", () => {
  const p = removeEntry(example(), "teo-okafor");
  assert.equal(p.entries.length, example().entries.length - 1);
  assert.equal(p.entries.some((e) => e.id === "teo-okafor"), false);
  assert.deepEqual(validate(p), []);
});

test("moving to inspiration keeps the id and the date", () => {
  const before = example().entries.find((e) => e.id === "teo-okafor");
  const p = moveToInspiration(example(), "teo-okafor", "Plating on bare wood boards.", [
    { name: "Sunday Table, a cookbook" },
  ]);
  const after = p.entries.find((e) => e.id === "teo-okafor");
  assert.equal(after.relation, "inspiration");
  assert.equal(after.added, before.added);
  assert.equal(after.gave, "Plating on bare wood boards.");
  assert.deepEqual(validate(p), []);
});

test("moving to inspiration without what it gave is not valid", () => {
  const p = moveToInspiration(example(), "teo-okafor", "", []);
  assert.notDeepEqual(validate(p), []);
});

test("changing an inspiration back to a taste reference drops what it gave", () => {
  const p0 = example();
  const e = p0.entries.find((x) => x.id === "the-patient-pot");
  const p = updateEntry(p0, e.id, { ...e, relation: "tasteReference" });
  const after = p.entries.find((x) => x.id === "the-patient-pot");
  assert.equal("gave" in after, false);
  assert.equal("creditedIn" in after, false);
  assert.deepEqual(validate(p), []);
});

test("the form parsers read what a person types", () => {
  assert.deepEqual(parseLinks("https://a.example/\n  https://b.example/ https://a.example/"), [
    "https://a.example/",
    "https://b.example/",
  ]);
  assert.deepEqual(parseTags("Motion, slow  pacing, motion,"), ["motion", "slow-pacing"]);
  const credits = parseCredits("Field Notes | https://x.example/notes\n\nTide Tables\n");
  assert.deepEqual(credits, [
    { name: "Field Notes", url: "https://x.example/notes" },
    { name: "Tide Tables" },
  ]);
  assert.deepEqual(parseCredits(formatCredits(credits)), credits);
});

test("the owner can change, and empty links are dropped", () => {
  const p = setOwner(example(), { type: "Organization", name: " Vale Works ", sameAs: [] });
  assert.equal(p.owner.name, "Vale Works");
  assert.equal("sameAs" in p.owner, false);
  assert.deepEqual(validate(p), []);
});

test("the saved file reads back as the same profile", () => {
  const p = example();
  assert.deepEqual(JSON.parse(toFileText(p)), p);
  assert.ok(toFileText(p).endsWith("}\n"));
});

test("the export keeps the two relations in two lists", () => {
  const p = example();
  const graph = toJsonLd(p)["@graph"];
  const names = (id) =>
    graph.find((n) => n["@id"] === id).itemListElement.map((li) => li.item.name).sort();
  const of = (relation) => p.entries.filter((e) => e.relation === relation).map((e) => e.name).sort();
  assert.deepEqual(names("#inspirations"), of("inspiration"));
  assert.deepEqual(names("#taste-references"), of("tasteReference"));
});

test("the export never says a taste reference gave something", () => {
  const graph = toJsonLd(example())["@graph"];
  const refs = graph.find((n) => n["@id"] === "#taste-references");
  for (const li of refs.itemListElement) assert.equal("description" in li, false);
  const refIds = new Set(refs.itemListElement.map((li) => li.item["@id"]));
  for (const node of graph.filter((n) => n["@type"] === "CreativeWork")) {
    for (const m of node.mentions) assert.equal(refIds.has(m["@id"]), false);
  }
});

test("the export uses the schema.org type of each kind", () => {
  const graph = toJsonLd(example())["@graph"];
  const items = graph
    .filter((n) => n["@type"] === "ItemList")
    .flatMap((n) => n.itemListElement.map((li) => li.item));
  const type = (name) => items.find((i) => i.name === name)["@type"];
  assert.equal(type("Teo Okafor"), "Person");
  assert.equal(type("Casa Lumbre"), "Organization");
  assert.equal(type("The Patient Pot"), "CreativeWork");
  assert.equal(graph[0]["@type"], "Person");
});

test("the export lists each crediting work once, with every entry it credits", () => {
  const graph = toJsonLd(example())["@graph"];
  const works = graph.filter((n) => n["@type"] === "CreativeWork");
  assert.equal(works.length, 2);
  const club = works.find((w) => w.name === "The Friday supper club");
  assert.deepEqual(club.mentions.map((m) => m["@id"]).sort(), [
    "#entry-casa-lumbre",
    "#entry-the-patient-pot",
  ]);
  assert.deepEqual(club.creator, { "@id": "#owner" });
});

test("the export leaves the notes out", () => {
  assert.equal(JSON.stringify(toJsonLd(example())).includes("Plates that look"), false);
});

test("problems read as sentences about the form's fields", () => {
  const p = moveToInspiration(example(), "teo-okafor", "", []);
  assert.deepEqual(explainAll(validate(p)), [
    "What it gave: cannot be empty.",
    "Credited in: add one or more.",
  ]);

  const q = example();
  q.entries[0].sameAs = ["not-a-link"];
  q.entries[0].added = "2026-02-30";
  assert.deepEqual(explainAll(validate(q)).sort(), [
    "Date added: must be a real date, as YYYY-MM-DD.",
    "Links: each one must be a full link that starts with http:// or https://.",
  ]);

  const r = example();
  delete r.owner.name;
  r.entries[0].gave = "x";
  assert.deepEqual(explainAll(validate(r)).sort(), [
    "Owner, Name: is needed.",
    "What it gave: is only allowed on an inspiration.",
  ]);
});
