# Editor field

A small box for formatted notes that any web page can embed with one call.

| | |
|---|---|
| Status | In review as of 2026-11-14 |
| Area | `packages/editor-field`, and the Notes field of the app |
| Delivered in | Issue #3, "Write entry notes in an embeddable editor field" |
| Related | [Profile app](profile-app.md), [Profile format](profile-format.md) |

## At a glance

- One call makes the field: `createEditor({ mount, document })`. One call removes it: `destroy()`.
- It does paragraphs, bold, italic, links and bullet lists. Nothing else.
- The document is a string in a small Markdown subset. Plain text is valid, so notes from format 1.0 open unchanged.
- It is built on Tiptap's open-source packages, on ProseMirror. It needs no framework.
- A first install took 4.6 seconds of machine time, from an empty folder to a built field. No person has timed it by hand yet.

## Why it exists

Notes on an entry were plain text. A note often needs a link, an emphasis or a short list.

The field is also a test. It is the smallest layer of a larger editor plan: one prose surface behind a `createEditor` call that a host can embed in minutes. The app is its first host. It is issue #3.

## How it works

Build the field once, then put it on a page.

1. Run `npm install`, then `npm run build:field`.
2. Copy `editor-field.js` and `editor-field.css` from `packages/editor-field/dist/` to your page's folder.
3. Add the stylesheet, an empty element, and the call:

```html
<link rel="stylesheet" href="editor-field.css" />
<div id="notes"></div>

<script type="module">
  import { createEditor } from "./editor-field.js";

  const editor = createEditor({
    mount: document.getElementById("notes"),
    document: "Some **notes** to start with.",
  });
  editor.on("change", (document) => console.log(document));
</script>
```

`npm run example:field` serves a page that does this. Open `http://localhost:4174/example/`.

A project with a bundler imports the source instead: `import { createEditor } from "tastebuds-editor-field"`, and the stylesheet from `tastebuds-editor-field/style.css`.

### The calls

| Call | What it does |
|---|---|
| `createEditor(options)` | Builds the field inside `options.mount` and returns the editor |
| `editor.on("change", handler)` | Calls `handler(document)` after each edit. Returns a function that stops it |
| `editor.getDocument()` | The document now |
| `editor.setDocument(document)` | Replaces the document. Does not fire "change" |
| `editor.execute(command, args)` | Runs `bold`, `italic`, `bulletList`, `link` (with `{ href }`), `unlink`, `undo`, `redo` or `focus`. Returns `false` when it cannot apply |
| `editor.destroy()` | Removes the field and all it added to the page |

### The options

| Option | Default | What it sets |
|---|---|---|
| `mount` | required | The element to build the field in |
| `document` | `""` | The starting text |
| `label` | `"Notes"` | The name a screen reader says |
| `placeholder` | none | Grey text in an empty field |
| `toolbar` | `true` | The row of buttons: B, I, List, Link |
| `profile` | `"manuscript"` | The kind of surface. This field has one |

### The stored format

The document is text in a Markdown subset:

| You write | It means |
|---|---|
| A blank line | A new paragraph |
| A line break | A line break, kept |
| `**bold**` | Bold |
| `_italic_` | Italic |
| `[text](https://example.com/)` | A link. Only `http` and `https` |
| `- item` at the start of a line | One item of a bullet list |

Nothing else is Markdown here: a `#` is a `#`. To write `\`, `*`, `_`, `[` or `]` as itself, or a `-` at the start of a line, put a backslash before it. The field does this for you.

```text
A restaurant I watched for a year.

- one long table
- [the open fire](https://casalumbre.example/fire)
```

*Illustrative example, not real data.*

### The look

The field reads six CSS variables, each with a fallback: `--ef-ink`, `--ef-muted`, `--ef-line`, `--ef-surface`, `--ef-accent` and `--ef-font`. Set them on any element around the field. The app maps them to its own colours in `src/style.css`.

## What it guarantees

Each promise is checked by a test in `test/editor-field.test.mjs`, or by a run in a browser where the row says so.

- Every part of the format reads back as the same text. Marks that overlap keep their marks.
- Plain notes from format 1.0 read as paragraphs and line breaks.
- A link is `http` or `https`, or it is plain text. A `javascript:` address never becomes a link.
- Text never becomes markup. The read-only view builds elements one by one and parses no HTML.
- Importing the package needs no browser. Only `createEditor` does.
- `destroy()` leaves nothing of the field on the page (checked in a browser).
- Enter in the link box applies the link. It does not send the form around the field (checked in a browser).

## What it does not do

- It has no headings, numbered lists, images, tables or code. The format has no words for them.
- It keeps one line for each list item, and one level of list.
- It does not save. The host saves what "change" hands it. The `storage` option of the larger plan is refused with a clear error.
- It takes no extensions. A non-empty `extensions` list is refused.
- It has one profile, `"manuscript"`. The plan's `"code"` profile is refused.
- It is not on npm. It lives in this repository as `packages/editor-field`.
- An `_` inside a word is italic here. Standard Markdown readers do not treat it so.

> **Limitation:** The one-file build is 585 kB, 162 kB compressed. Most of it is ProseMirror. The app's own bundle grew from 172 kB to 555 kB.

> **Not verified:** A person's first install against the 15-minute target. Screen readers. Phones and their on-screen keyboards. Firefox and Safari.

## When something goes wrong

| What you see | What to do |
|---|---|
| `createEditor needs a mount` | Pass the element to build in: `mount: document.getElementById("notes")` |
| `This field takes no extensions yet` | Remove the `extensions` option |
| `This field has no storage adapter` | Remove `storage`. Save the document in your "change" handler |
| The field has no border or buttons look bare | The stylesheet is not loaded. Add `editor-field.css` |
| The page is blank and the console says "Failed to resolve module" | Open the page from a web server, not from a file. `npm run example:field` is one |
| "Use a full address that starts with http:// or https://" | Type the whole address of the link |

## Key decisions

- **The code lives in this repository, as a package.** The field has one host. A repository of its own is worth it when a second host appears. The package boundary is already there: the app imports it by name.
- **Notes are stored as a Markdown subset, not as ProseMirror JSON.** A profile is a file that people read and edit by hand, and a string keeps every 1.0 file valid. The cost is a converter, which the tests cover.
- **Italic is written `_like this_`, bold `**like this**`.** Two different markers cannot be confused with each other when marks overlap.
- **The converter is this project's own, about 250 lines.** It does exactly the subset, has no dependencies, and runs without a browser.
- **The contract follows the plan's example where the field can, and refuses where it cannot.** `mount`, `profile`, `document`, `on("change")`, `execute` and `destroy` match. `extensions` and `storage` raise an error; they do not pretend to work.

## Verification

| Check | Outcome |
|---|---|
| 12 tests of the format and the import, `npm test` | pass |
| Type, bold with Ctrl+B, save, and read the note back on its card, in the app | pass |
| Link and list buttons, a refused bad address, Escape in the link box, in the app | pass |
| A fresh clone builds the field and the example page takes typing | pass |
| A person's first install, timed | not checked |
| Screen reader, phone, Firefox, Safari | not checked |

First install, measured 2026-11-14 on Windows 11 with Node 24 and an empty npm cache: clone 0.3 s, `npm install` 2.9 s, `npm run build:field` 1.4 s. The page then needs the 12 lines above.

## Technical appendix

| File | What it is |
|---|---|
| `packages/editor-field/src/index.ts` | `createEditor`, the toolbar and the commands |
| `packages/editor-field/src/markdown.ts` | The format: `fromMarkdown`, `toMarkdown`, `toPlainText` |
| `packages/editor-field/src/render.ts` | `renderMarkdown`: a read-only view of a document |
| `packages/editor-field/src/style.css` | The look and its variables |
| `packages/editor-field/example/index.html` | The first-install page |
| `packages/editor-field/vite.config.ts` | The one-file build |

Tiptap packages, all MIT, version 3.34: `core`, `pm`, `extension-document`, `extension-paragraph`, `extension-text`, `extension-hard-break`, `extension-bold`, `extension-italic`, `extension-link`, `extension-list` and `extensions` (undo and placeholder). A list item is limited to one paragraph, to match the stored format.

The profile format is now 1.1: the `notes` field holds this Markdown subset. A 1.0 file is a valid 1.1 file.
