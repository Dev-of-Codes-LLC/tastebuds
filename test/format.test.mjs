import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validate, schema, kinds } from "../src/validate.ts";

const example = () =>
  JSON.parse(readFileSync(new URL("../examples/profile.json", import.meta.url), "utf8"));

const entry = (profile, id) => profile.entries.find((e) => e.id === id);

test("the example profile is valid", () => {
  assert.deepEqual(validate(example()), []);
});

test("the example has both kinds of entry", () => {
  const relations = new Set(example().entries.map((e) => e.relation));
  assert.deepEqual([...relations].sort(), ["inspiration", "tasteReference"]);
});

test("every kind maps to a schema.org type", () => {
  const allowed = ["Person", "Organization", "CreativeWork"];
  for (const kind of schema.$defs.entry.properties.kind.enum) {
    assert.ok(allowed.includes(kinds[kind]), `${kind} has no schema.org type`);
  }
  assert.equal(Object.keys(kinds).length, schema.$defs.entry.properties.kind.enum.length);
});

test("a taste reference cannot say what it gave", () => {
  const p = example();
  entry(p, "ansel-marrow").gave = "A hover effect.";
  assert.notDeepEqual(validate(p), []);
});

test("a taste reference cannot be credited in a work", () => {
  const p = example();
  entry(p, "ansel-marrow").creditedIn = [{ name: "Some site" }];
  assert.notDeepEqual(validate(p), []);
});

test("an inspiration must say what it gave", () => {
  const p = example();
  delete entry(p, "the-quiet-grid").gave;
  assert.notDeepEqual(validate(p), []);
});

test("an inspiration must name the work that credits it", () => {
  const p = example();
  entry(p, "the-quiet-grid").creditedIn = [];
  assert.notDeepEqual(validate(p), []);
});

test("a taste reference becomes an inspiration by gaining both fields", () => {
  const p = example();
  const e = entry(p, "ansel-marrow");
  e.relation = "inspiration";
  assert.notDeepEqual(validate(p), []);
  e.gave = "The fade between pages.";
  e.creditedIn = [{ name: "Field Notes, the 2026 redesign" }];
  assert.deepEqual(validate(p), []);
});

test("an entry needs at least one link", () => {
  const p = example();
  entry(p, "ansel-marrow").sameAs = [];
  assert.notDeepEqual(validate(p), []);
});

test("links must be http or https", () => {
  const p = example();
  entry(p, "ansel-marrow").sameAs = ["ftp://anselmarrow.example/"];
  assert.notDeepEqual(validate(p), []);
});

test("the date added must be a real date", () => {
  const p = example();
  entry(p, "ansel-marrow").added = "2026-02-30";
  assert.notDeepEqual(validate(p), []);
});

test("entry ids must be unique", () => {
  const p = example();
  p.entries[1].id = p.entries[0].id;
  assert.match(validate(p).join("\n"), /already used/);
});

test("unknown fields are rejected", () => {
  const p = example();
  entry(p, "ansel-marrow").influence = "high";
  assert.notDeepEqual(validate(p), []);
});

test("the owner is a Person or an Organization", () => {
  const p = example();
  p.owner.type = "Organization";
  assert.deepEqual(validate(p), []);
  p.owner.type = "CreativeWork";
  assert.notDeepEqual(validate(p), []);
});

test("a later 1.x file is accepted, a 2.x file is not", () => {
  const p = example();
  p.formatVersion = "1.3";
  assert.deepEqual(validate(p), []);
  p.formatVersion = "2.0";
  assert.notDeepEqual(validate(p), []);
});
