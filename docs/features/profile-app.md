# Profile app

A page in your browser opens a profile file, edits it, shows it, and saves it back to your disk.

| | |
|---|---|
| Status | Merged 2026-11-13. The video was made again on 2026-11-14, with the editor field in it |
| Area | Browser app |
| Delivered in | Issue #2, "Build the app to edit and view a profile" |
| Related | [Profile format](profile-format.md), [the video](profile-app/profile-app.mp4) (75 seconds, narrated) |

## At a glance

- The app runs in the browser. It has no account and no backend. Your file is the store.
- It shows inspirations and taste references in two separate lists.
- It checks every change against the format. A profile that is not valid never reaches your file.
- **Move to inspirations** asks what the entry gave and which work credits it.
- **Export JSON-LD** writes the profile as schema.org data for a web page.

## Why it exists

A profile is a JSON file, and JSON is slow to edit by hand. The app gives the file a form and a readable view, and it keeps the rule of the format: a taste reference is never shown as an influence. It is issue #2.

## How it works

Start the app, then open a file or start a new one. [The video](profile-app/profile-app.mp4) shows the whole path in 75 seconds: it adds an entry to the example, then moves it to inspirations. Its words are in [profile-app.srt](profile-app/profile-app.srt).

1. Run `npm install`, then `npm run dev`. Open the address that the command prints.
2. Select **New profile**, **Open a file** or **See the example**.
3. Select **Add** above a list to add an entry to that list.
4. Select **Save**. The top bar shows "not saved" until you do.

### Add an entry

The form asks for a name, a kind, a date, the relation, and one or more links. Tags and notes are optional. Notes are written in the [editor field](editor-field.md), with bold, italic, links and bullet lists. The app makes the entry's `id` from its name, and never changes it.

If you select **Inspiration**, the form also asks for two things:

| Field | What to write |
|---|---|
| What it gave | One sentence: what your work took from it |
| Credited in | The work of yours that credits it. One work on each line: a name, then `\|` and a link if there is one |

### Move a taste reference to inspirations

1. Select **Move to inspirations** on the entry's card.
2. Write what it gave, and the work that credits it.
3. Select **Save**. The entry moves to the other list. It keeps its `id` and its date.

To move an entry back, select **Edit** and change the relation to **Taste reference**. The app then drops what it gave and the credits.

### Remove an entry

Select **Remove**. A message at the bottom of the page offers **Undo** for 8 seconds.

### Export JSON-LD

**Export JSON-LD** downloads a `.jsonld` file with a schema.org graph:

| Node | What it holds |
|---|---|
| The owner | A `Person` or `Organization` with its links |
| `#inspirations` | An `ItemList`. Each item is the entity, with what it gave as the item's description |
| `#taste-references` | An `ItemList`. Each item is the entity only |
| One `CreativeWork` for each crediting work | The owner as `creator`, and the inspirations it credits as `mentions` |

```json
{
  "@type": "ListItem",
  "position": 2,
  "item": {
    "@type": "CreativeWork",
    "@id": "#entry-the-patient-pot",
    "name": "The Patient Pot",
    "url": "https://books.example/the-patient-pot",
    "sameAs": ["https://books.example/the-patient-pot"],
    "keywords": "slow-cooking, comfort"
  },
  "description": "The slow tomato sauce that starts every Sunday dinner."
}
```

*Illustrative example, not real data.*

## Defensive styles

The styles follow the tips at [Defensive CSS](https://defensivecss.dev). They assume content the design did not plan for: a name of 200 letters, a link with no break, 30 tags, a window 320px wide. Each place in `src/style.css` has a comment that starts with "Defensive:" and names the tip.

| Tip | Where it applies |
|---|---|
| Long content | Every name, link and note breaks to fit. The file name in the top bar cuts with an ellipsis |
| Flexbox wrapping | The top bar, list headings, card actions, tags and dialog buttons |
| Minimum content size in flexbox and grid | The file name, the two lists, and the label column of a card |
| CSS grid fixed values, auto-fit | A card's labels sit above their text on a narrow card. Form fields stack when there is no room for two |
| Scrollbars on demand, scroll chaining, scrollbar gutter | A dialog scrolls only when it must, and the page behind it stays still |
| Vertical media queries | The start screen moves down the page only in a tall window |
| Accidental hover on mobile | Hover styles apply only with a pointer that can hover |
| Input zoom on iOS Safari | Form fields use 16px text |
| Button minimum width | Short buttons such as **Add** keep a 64px width |
| Default flexbox stretching | A tag keeps its height next to a link that wraps |
| Fixed sizes | Text areas have a minimum and a maximum height, not a fixed one |
| Image maximum width, image distortion | A base rule, ready for the first image |

These tips have nothing to apply to yet: background repeat, text over image, image inner border, position sticky with CSS grid, grouping vendor selectors, using space-between, and CSS variable fallback. The app has no background images, sticky parts or vendor selectors, and it sets every variable in one place.

## What it guarantees

Each promise is checked by a test in `test/app.test.mjs`.

- The app writes only valid profiles. Every add, edit and move runs the same check as `npm run validate`.
- A taste reference never carries what it gave, in the view, the file or the export.
- An entry keeps its `id` and its date when it moves to inspirations.
- The saved file reads back as the same profile.
- The export leaves your notes out.

## What it does not do

- It does not save in place in every browser. Chrome and Edge write back to the file you opened. Firefox and Safari download a new copy on each save.
- It does not open a file that is not valid. It lists the problems, and you fix the file by hand.
- It does not keep a draft. If you close the tab before you save, the changes are gone. The browser asks first.
- It does not edit the `id` of an entry, or reorder entries.
- It is not hosted anywhere. You run it from a checkout.

> **Not verified:** Open and save through the browser's file picker, and the Firefox and Safari download path. The checks in the browser used the built-in example.

## When something goes wrong

| What you see | What to do |
|---|---|
| "This file is not a valid profile" | Fix the listed problems in the file, then open it again. `npm run validate -- <file>` shows the same list |
| "Links: add one or more." | Give the entry one or more links that start with `http://` or `https://` |
| "Credited in: add one or more." | An inspiration must name the work that credits it. If no work credits it yet, keep it a taste reference |
| Save downloads a file each time | Your browser cannot write to the file. Replace the old file with the download |

## Key decisions

- **No framework.** The app is TypeScript and the DOM. Issue #2 says to add a framework only if the editor field needs one.
- **One check for the app, the tests and the command line.** All three import `src/validate.ts`, so they cannot disagree.
- **Changes are pure functions.** Each one in `src/profile.ts` returns a new profile. That makes Undo one line, and the tests run without a browser.
- **Two lists in the export, not one list with a flag.** A reader of the JSON-LD cannot mistake a taste reference for a credit.

## Verification

| Check | Outcome |
|---|---|
| 33 tests, `npm test` | pass |
| Type check and production build, `npm run build` | pass |
| Add, move to inspirations, move back, remove and undo, in the browser | pass |
| Light and dark theme, desktop and phone width | pass |
| No sideways scroll at 320px with a 160-letter name, a 220-letter link and 30 tags | pass |
| The video plays the real app: add an entry, move it to inspirations | pass |
| Open and save with a real file | not checked |

## Technical appendix

| File | What it is |
|---|---|
| `index.html`, `src/main.ts`, `src/style.css` | The page: view, dialogs, top bar |
| `src/profile.ts` | The types, and the changes to a profile |
| `src/validate.ts` | The check: the schema plus unique ids |
| `src/explain.ts` | Turns a problem into a sentence about a form field |
| `src/jsonld.ts` | The JSON-LD export |
| `src/file.ts` | Open, save and download |
| `video/profile-app/storyboard.json` | The script of the video: each line of narration and the clicks and keys that go with it |

Commands: `npm run dev` (the app), `npm run build` (a static copy in `dist/`), `npm test`, `npm run validate -- <file>`. Node 22.18 or newer runs the TypeScript files directly. The app uses Vite, TypeScript, `ajv` and `ajv-formats`.
