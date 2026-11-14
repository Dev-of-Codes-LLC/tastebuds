// The app: open a profile file, edit its entries, show the profile with the
// two relations apart, save the file, and export JSON-LD.

import { createEditor, renderMarkdown } from "tastebuds-editor-field";
import exampleProfile from "../examples/profile.json" with { type: "json" };
import { explainAll } from "./explain.ts";
import { download, openFile, saveFile } from "./file.ts";
import { toJsonLdText } from "./jsonld.ts";
import {
  KINDS,
  addEntry,
  byRelation,
  formatCredits,
  freeId,
  moveToInspiration,
  newProfile,
  parseCredits,
  parseLinks,
  parseTags,
  removeEntry,
  setOwner,
  tidy,
  today,
  toFileText,
  updateEntry,
} from "./profile.ts";
import type { Entry, Kind, Owner, Profile, Relation } from "./profile.ts";
import { validate } from "./validate.ts";

// --- State ---------------------------------------------------------------

interface State {
  profile: Profile | null;
  fileName: string;
  handle?: unknown;
  dirty: boolean;
}

const state: State = { profile: null, fileName: "profile.json", dirty: false };
const root = document.getElementById("app")!;

function change(profile: Profile): void {
  state.profile = profile;
  state.dirty = true;
  render();
}

window.addEventListener("beforeunload", (event) => {
  if (state.dirty) event.preventDefault();
});

// --- Small DOM helper ----------------------------------------------------

type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2), value as EventListener);
    } else if (key === "class") {
      el.className = String(value);
    } else if (key in el && key !== "list" && key !== "form") {
      (el as any)[key] = value;
    } else {
      el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

const host = (link: string): string => {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
};

const outLink = (href: string, text: string) =>
  h("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);

// --- Toast ---------------------------------------------------------------

let toastTimer = 0;

function toast(message: string, undo?: () => void, bad = false): void {
  document.querySelector(".toast")?.remove();
  window.clearTimeout(toastTimer);
  const el = h("div", { class: bad ? "toast bad" : "toast", role: "status" }, message);
  if (undo) {
    el.append(
      h("button", { type: "button", onclick: () => (el.remove(), undo()) }, "Undo"),
    );
  }
  document.body.append(el);
  toastTimer = window.setTimeout(() => el.remove(), undo ? 8000 : 4000);
}

// --- File actions --------------------------------------------------------

function leaveOk(): boolean {
  return !state.dirty || window.confirm("This profile has changes that are not saved. Leave it?");
}

async function open(): Promise<void> {
  if (!leaveOk()) return;
  const file = await openFile();
  if (!file) return;
  let profile: unknown;
  try {
    profile = JSON.parse(file.text);
  } catch {
    showProblems(file.name, ["Profile: the file is not JSON."]);
    return;
  }
  const problems = validate(profile);
  if (problems.length > 0) {
    showProblems(file.name, explainAll(problems));
    return;
  }
  state.profile = profile as Profile;
  state.fileName = file.name;
  state.handle = file.handle;
  state.dirty = false;
  render();
}

async function save(): Promise<void> {
  if (!state.profile) return;
  try {
    const saved = await saveFile(toFileText(state.profile), state.fileName, state.handle);
    if (!saved) return;
    state.fileName = saved.name;
    state.handle = saved.handle;
    state.dirty = false;
    render();
    toast(`Saved ${saved.name}`);
  } catch (err) {
    toast(`Could not save: ${(err as Error).message}`, undefined, true);
  }
}

function exportJsonLd(): void {
  if (!state.profile) return;
  const name = state.fileName.replace(/\.json$/i, "") + ".jsonld";
  download(toJsonLdText(state.profile), name, "application/ld+json");
  toast(`Exported ${name}`);
}

function startNew(): void {
  if (!leaveOk()) return;
  ownerDialog(null);
}

function openExample(): void {
  if (!leaveOk()) return;
  const { $schema: _unused, ...profile } = exampleProfile as Profile;
  state.profile = profile;
  state.fileName = "example-profile.json";
  state.handle = undefined;
  state.dirty = false;
  render();
}

// --- Dialogs -------------------------------------------------------------

function dialog(
  title: string,
  lead: string,
  body: Child[],
  onSubmit: () => string[],
  onShut: () => void = () => {},
): void {
  const problems = h("ul", { class: "problems", role: "alert" });
  // Every way out of the dialog goes through here, once.
  const shut = () => {
    if (!el.isConnected) return;
    onShut();
    el.remove();
  };
  const el = h(
    "dialog",
    {},
    h(
      "form",
      {
        method: "dialog",
        novalidate: true,
        onsubmit: (event: Event) => {
          event.preventDefault();
          const found = onSubmit();
          problems.replaceChildren(...found.map((p) => h("li", {}, p)));
          if (found.length === 0) shut();
        },
      },
      h("h2", {}, title),
      h("p", { class: "lead" }, lead),
      ...body,
      problems,
      h(
        "div",
        { class: "buttons" },
        h("button", { type: "button", onclick: shut }, "Cancel"),
        h("button", { type: "submit", class: "primary" }, "Save"),
      ),
    ),
  );
  el.addEventListener("close", shut);
  document.body.append(el);
  el.showModal();
}

function showProblems(fileName: string, problems: string[]): void {
  const el = h(
    "dialog",
    {},
    h("h2", {}, "This file is not a valid profile"),
    h("p", { class: "lead" }, `${fileName} was not opened. Fix these and open it again.`),
    h("ul", { class: "problems" }, ...problems.slice(0, 12).map((p) => h("li", {}, p))),
    h(
      "div",
      { class: "buttons" },
      h("button", { type: "button", class: "primary", onclick: () => el.remove() }, "Close"),
    ),
  );
  el.addEventListener("close", () => el.remove());
  document.body.append(el);
  el.showModal();
}

const field = (label: string, hint: string, control: HTMLElement) =>
  h("label", {}, label, hint && h("small", {}, hint), control);

function inspirationFields(entry: Partial<Entry>) {
  const gave = h("textarea", { name: "gave", rows: 2, value: entry.gave ?? "" });
  const credits = h("textarea", {
    name: "creditedIn",
    rows: 2,
    value: formatCredits(entry.creditedIn),
    placeholder: "Sunday Table | https://example.com/sunday-table",
  });
  const block = h(
    "div",
    { class: "inspiration-only" },
    field("What it gave", "One sentence. What did your work take from it?", gave),
    field(
      "Credited in",
      "The work of yours that credits it. One work on each line: a name, then | and a link if there is one.",
      credits,
    ),
  );
  return { block, gave, credits };
}

function ownerDialog(current: Owner | null): void {
  const name = h("input", { type: "text", name: "ownerName", value: current?.name ?? "" });
  const type = h(
    "select",
    { name: "ownerType" },
    h("option", { value: "Person" }, "A person"),
    h("option", { value: "Organization" }, "An organization"),
  );
  type.value = current?.type ?? "Person";
  const links = h("textarea", {
    name: "ownerLinks",
    rows: 2,
    value: (current?.sameAs ?? []).join("\n"),
  });
  dialog(
    current ? "Edit the owner" : "New profile",
    "A profile belongs to one person or one organization.",
    [
      field("Name", "", name),
      field("The owner is", "", type),
      field("Links", "Optional. Your own site and profiles, one on each line. The first is the main one.", links),
    ],
    () => {
      const owner: Owner = {
        type: type.value as Owner["type"],
        name: name.value,
        sameAs: parseLinks(links.value),
      };
      const next = setOwner(state.profile && current ? state.profile : newProfile(owner), owner);
      const problems = explainAll(validate(next));
      if (problems.length > 0) return problems;
      if (!current) {
        state.fileName = "profile.json";
        state.handle = undefined;
      }
      change(next);
      return [];
    },
  );
  name.focus();
}

function entryDialog(current: Entry | null, relation: Relation): void {
  const profile = state.profile!;
  const start: Partial<Entry> = current ?? { relation, kind: "person", added: today() };

  const name = h("input", { type: "text", name: "name", value: start.name ?? "" });
  const kind = h("select", { name: "kind" }, ...KINDS.map((k) => h("option", { value: k }, k)));
  kind.value = start.kind!;
  const added = h("input", { type: "date", name: "added", value: start.added });
  const links = h("textarea", {
    name: "sameAs",
    rows: 2,
    value: (start.sameAs ?? []).join("\n"),
    placeholder: "https://",
  });
  const tags = h("input", { type: "text", name: "tags", value: (start.tags ?? []).join(", ") });
  // The notes are written in the editor field, not in a plain text area.
  const notesMount = h("div", { class: "notes-field" });
  const notes = createEditor({
    mount: notesMount,
    document: start.notes ?? "",
    label: "Notes",
    placeholder: "What you see in it, in your own words.",
  });
  const { block, gave, credits } = inspirationFields(start);

  const radio = (value: Relation, label: string) =>
    h(
      "label",
      {},
      h("input", {
        type: "radio",
        name: "relation",
        value,
        checked: start.relation === value,
        onchange: () => (block.hidden = value !== "inspiration"),
      }),
      " ",
      label,
    );
  block.hidden = start.relation !== "inspiration";

  dialog(
    current ? `Edit ${current.name}` : "Add an entry",
    "A taste reference is taste you watch. An inspiration gave your work something, and your work credits it.",
    [
      field("Name", "", name),
      h("div", { class: "row" }, field("Kind", "", kind), field("Date added", "", added)),
      h(
        "fieldset",
        {},
        "Relation",
        h(
          "div",
          { class: "choices" },
          radio("tasteReference", "Taste reference"),
          radio("inspiration", "Inspiration"),
        ),
      ),
      block,
      field(
        "Links",
        "Its own site and profiles, one on each line. One or more. The first is the main one.",
        links,
      ),
      field("Tags", "What you see in it. Separate tags with commas.", tags),
      h("div", { class: "group" }, h("span", { class: "group-label" }, "Notes"), notesMount),
    ],
    () => {
      const chosen = (document.querySelector('input[name="relation"]:checked') as HTMLInputElement)
        .value as Relation;
      const entry: Entry = tidy({
        id: current?.id ?? freeId(profile, name.value),
        name: name.value,
        kind: kind.value as Kind,
        relation: chosen,
        sameAs: parseLinks(links.value),
        tags: parseTags(tags.value),
        notes: notes.getDocument(),
        added: added.value,
        gave: gave.value,
        creditedIn: parseCredits(credits.value),
      });
      const next = current ? updateEntry(profile, current.id, entry) : addEntry(profile, entry);
      const problems = explainAll(validate(next));
      if (problems.length > 0) return problems;
      change(next);
      return [];
    },
    () => notes.destroy(),
  );
  name.focus();
}

function moveDialog(entry: Entry): void {
  const { block, gave, credits } = inspirationFields({});
  dialog(
    `Move ${entry.name} to inspirations`,
    "Do this when it shaped a piece of your work, and that work credits it.",
    [block],
    () => {
      const next = moveToInspiration(
        state.profile!,
        entry.id,
        gave.value,
        parseCredits(credits.value),
      );
      const problems = explainAll(validate(next));
      if (problems.length > 0) return problems;
      change(next);
      toast(`${entry.name} is now an inspiration`);
      return [];
    },
  );
  gave.focus();
}

function remove(entry: Entry): void {
  const before = state.profile!;
  const wasDirty = state.dirty;
  change(removeEntry(before, entry.id));
  toast(`Removed ${entry.name}`, () => {
    state.profile = before;
    state.dirty = wasDirty;
    render();
  });
}

// --- View ----------------------------------------------------------------

function card(entry: Entry): HTMLElement {
  const isInspiration = entry.relation === "inspiration";
  return h(
    "article",
    { class: "card", "data-id": entry.id },
    h("h3", {}, outLink(entry.sameAs[0], entry.name)),
    h("span", { class: "kind" }, entry.kind),
    isInspiration &&
      h(
        "dl",
        {},
        h("dt", {}, "Gave"),
        h("dd", {}, entry.gave ?? ""),
        h("dt", {}, "Credited in"),
        h(
          "dd",
          {},
          ...(entry.creditedIn ?? []).flatMap((c, i) => [
            i > 0 && h("br"),
            c.url ? outLink(c.url, c.name) : c.name,
          ]),
        ),
      ),
    entry.notes && h("div", { class: "notes" }, renderMarkdown(entry.notes)),
    h(
      "div",
      { class: "meta" },
      ...(entry.tags ?? []).map((t) => h("span", { class: "tag" }, t)),
      ...entry.sameAs.map((link) => outLink(link, host(link))),
      h("span", {}, `added ${entry.added}`),
    ),
    h(
      "div",
      { class: "actions" },
      !isInspiration &&
        h(
          "button",
          { type: "button", class: "quiet move", onclick: () => moveDialog(entry) },
          "Move to inspirations",
        ),
      !isInspiration ? null : h("span", { style: "margin-right:auto" }),
      h(
        "button",
        { type: "button", class: "quiet", onclick: () => entryDialog(entry, entry.relation) },
        "Edit",
      ),
      h("button", { type: "button", class: "quiet", onclick: () => remove(entry) }, "Remove"),
    ),
  );
}

function relationSection(profile: Profile, relation: Relation): HTMLElement {
  const entries = byRelation(profile, relation);
  const isInspiration = relation === "inspiration";
  return h(
    "section",
    { class: `relation ${relation}` },
    h(
      "header",
      {},
      h("h2", {}, isInspiration ? "Inspirations" : "Taste references"),
      h("span", { class: "count" }, String(entries.length)),
      h("button", { type: "button", onclick: () => entryDialog(null, relation) }, "Add"),
    ),
    h(
      "p",
      { class: "what" },
      isInspiration
        ? `These gave something to the work of ${profile.owner.name}. Each is credited by name.`
        : `Taste that ${profile.owner.name} watches. Nothing was taken from them.`,
    ),
    entries.length === 0 &&
      h(
        "p",
        { class: "empty" },
        isInspiration
          ? "No inspirations yet. Add one, or move a taste reference here when it shapes a piece of work."
          : "No taste references yet. Add someone whose taste you watch.",
      ),
    ...entries.map(card),
  );
}

function profileView(profile: Profile): HTMLElement {
  const owner = profile.owner;
  return h(
    "main",
    {},
    h(
      "section",
      { class: "owner" },
      h(
        "div",
        { class: "eyebrow" },
        owner.type === "Person" ? "Taste profile of" : "Taste profile of the organization",
      ),
      h("h1", {}, owner.name),
      h(
        "div",
        { class: "links" },
        ...(owner.sameAs ?? []).map((link) => outLink(link, host(link))),
        h("button", { type: "button", class: "quiet", onclick: () => ownerDialog(owner) }, "Edit the owner"),
      ),
    ),
    h(
      "div",
      { class: "columns" },
      relationSection(profile, "inspiration"),
      relationSection(profile, "tasteReference"),
    ),
    h(
      "p",
      { class: "disclaimer" },
      `${owner.name} is not affiliated with or endorsed by the people and work in this profile.`,
    ),
  );
}

function startView(): HTMLElement {
  return h(
    "main",
    {},
    h(
      "section",
      { class: "start" },
      h("h1", {}, "Keep a taste profile."),
      h(
        "p",
        {},
        "The people and work whose taste you watch, and the ones that shaped your own work, with credit. A profile is one JSON file on your disk. There is no account.",
      ),
      h(
        "div",
        { class: "actions" },
        h("button", { type: "button", class: "primary", onclick: startNew }, "New profile"),
        h("button", { type: "button", onclick: open }, "Open a file"),
        h("button", { type: "button", onclick: openExample }, "See the example"),
      ),
    ),
  );
}

function bar(): HTMLElement {
  const has = state.profile !== null;
  return h(
    "header",
    { class: "bar" },
    h("div", { class: "mark" }, "Tastebuds"),
    has &&
      h(
        "span",
        { class: "file" },
        h("span", { class: "name", title: state.fileName }, state.fileName),
        state.dirty && h("span", { class: "dirty" }, " · not saved"),
      ),
    has && h("button", { type: "button", onclick: startNew }, "New"),
    h("button", { type: "button", onclick: open }, "Open"),
    has && h("button", { type: "button", class: state.dirty ? "primary" : "", onclick: save }, "Save"),
    has && h("button", { type: "button", onclick: exportJsonLd }, "Export JSON-LD"),
  );
}

function render(): void {
  root.replaceChildren(bar(), state.profile ? profileView(state.profile) : startView());
  document.title = state.profile ? `${state.profile.owner.name} · Tastebuds` : "Tastebuds";
}

render();
