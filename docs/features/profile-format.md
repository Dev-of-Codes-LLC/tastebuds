# Profile format

One JSON file holds a whole taste profile: who it belongs to, whose taste they watch, and what shaped their work.

| | |
|---|---|
| Status | In review as of 2026-11-13 |
| Area | File format, version 1.0 |
| Delivered in | Issue #1, "Define the taste profile format" |
| Related | [The schema](../../schema/profile.schema.json), [the example profile](../../examples/profile.json) |

## At a glance

- A profile is one JSON file with three fields: `formatVersion`, `owner` and `entries`.
- Each entry has one of two relations: `tasteReference` or `inspiration`.
- Only an inspiration can say what it gave. A taste reference that claims to give something is not valid.
- Each entry has a kind, and each kind maps to one schema.org type.
- `npm run validate -- <file>` checks a file against the format.

## Why it exists

The app, the export and any site that shows a profile all read this file, so it comes first.

The format keeps two things apart that other tools mix: taste you watch, and work that shaped yours. A profile that mixes them credits people for things they did not give.

## How it works

Write the profile as a JSON file, then check it.

1. Copy [examples/profile.json](../../examples/profile.json).
2. Set the `owner`: a `type` of `Person` or `Organization`, a `name`, and `sameAs` links.
3. Add one object to `entries` for each entity.
4. Run `npm install` once, then `npm run validate -- your-profile.json`.

### An entry

| Field | Required | What it holds |
|---|---|---|
| `id` | yes | A short stable name, unique in the profile: lower-case letters, digits and hyphens |
| `name` | yes | The name to show |
| `kind` | yes | `person`, `studio`, `channel`, `book` or `work` |
| `relation` | yes | `tasteReference` or `inspiration` |
| `sameAs` | yes | One or more links to the entity's own site and profiles. The first link is the main one |
| `added` | yes | The day you added the entry, as `YYYY-MM-DD` |
| `tags` | no | Taste tags: short lower-case words for what you see in the entity |
| `notes` | no | Your own notes, as plain text |
| `gave` | inspirations only | What the entity gave to your work, in a sentence |
| `creditedIn` | inspirations only | One or more pieces of your work that credit it, each with a `name` and an optional `url` |

Put the entity's Wikidata item in `sameAs` when one exists. It is the link that other catalogues are most likely to share.

### Kinds and schema.org types

| Kind | schema.org type | Use it for |
|---|---|---|
| `person` | `Person` | One person |
| `studio` | `Organization` | A studio, company or group |
| `channel` | `CreativeWork` | A video channel, podcast or newsletter |
| `book` | `CreativeWork` | A book |
| `work` | `CreativeWork` | Any other single work: a site, a film, an album |

The same mapping is in [schema/kinds.json](../../schema/kinds.json), for code to read.

### The two relations

| | Taste reference | Inspiration |
|---|---|---|
| Meaning | You watch this entity's taste. You took nothing from it yet | It gave something to your work, and that work credits it |
| `gave` | Not allowed | Required |
| `creditedIn` | Not allowed | Required, one or more |

To move an entry from taste reference to inspiration, change `relation` and add `gave` and `creditedIn`. Keep the `id` and the `added` date.

```json
{
  "id": "the-quiet-grid",
  "name": "The Quiet Grid",
  "kind": "book",
  "relation": "inspiration",
  "sameAs": ["https://books.example/the-quiet-grid"],
  "added": "2026-01-05",
  "gave": "The eight-column layout and its wide outer margins.",
  "creditedIn": [{ "name": "Field Notes, the 2026 redesign" }]
}
```

*Illustrative example, not real data.*

## What it guarantees

Each promise is checked by a test in `test/format.test.mjs`.

- A valid file never shows a taste reference as an influence. The schema rejects `gave` and `creditedIn` on a taste reference.
- Every inspiration says what it gave and names the work that credits it.
- Every entry has one or more `http` or `https` links, so the entity is recognisable elsewhere.
- Every kind has a schema.org type.
- A file written for 1.0 stays valid against every later 1.x schema. A 1.x schema only adds optional fields.
- A typing mistake in a field name fails the check. The schema allows no unknown fields.

## What it does not do

- It does not export JSON-LD. The format only fixes the mapping that the export needs. The export comes with the app.
- It does not record when an entry became an inspiration, or its history. Version control of the file holds that.
- It does not check that a link works or points at the right entity.
- It does not hold rich text. `notes` is plain text until the editor field exists.
- It does not use the more exact schema.org types, such as `Book`. Three types keep version 1 small.

> **Limitation:** JSON Schema cannot require unique entry ids. Only the validate script checks them. A site that uses the schema alone must check ids itself.

## When something goes wrong

| What you see | What to do |
|---|---|
| `/entries/0/gave boolean schema is false` | The entry is a taste reference. Remove `gave` and `creditedIn`, or change `relation` to `inspiration` |
| `must have required property 'creditedIn'` | The entry is an inspiration. Name the work that credits it |
| `must NOT have additional properties` | A field name is wrong or not in the format |
| `id "x" is already used by /entries/n` | Give one of the two entries a different `id` |
| `must match format "date"` | Write `added` as a real date, `YYYY-MM-DD` |

## Key decisions

- **One file field for the relation, not two lists.** An entry moves between relations without a new `id`, so links to it survive.
- **Links are required on entries, optional on the owner.** An entry with no link cannot be matched to an entity. An owner can be private.
- **The schema.org type is not stored.** It follows from the kind, so a file cannot disagree with itself.
- **The schema `$id` is a URN, `urn:tastebuds:schema:profile:1`.** It does not depend on where the repository lives.

## Verification

| Check | Outcome |
|---|---|
| The example profile validates | pass |
| 15 format tests, `npm test` | pass |
| The validate script exits 1 on an invalid file | pass |
| A real profile written in the format | not checked |
| The schema in a validator other than Ajv | not checked |

## Technical appendix

| File | What it is |
|---|---|
| `schema/profile.schema.json` | The JSON Schema, draft 2020-12 |
| `schema/kinds.json` | Kind to schema.org type |
| `examples/profile.json` | A profile with both relations, made-up entities only |
| `scripts/validate.mjs` | The check: the schema plus unique ids. Exports `validate(profile)` |
| `test/format.test.mjs` | The tests |

The check needs Node 20 or newer, with `ajv` and `ajv-formats` as development dependencies.
