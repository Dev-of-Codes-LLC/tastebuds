// The shape of a profile, and the changes the app makes to one.
// Every change returns a new profile and leaves the old one as it was.

export type Relation = "tasteReference" | "inspiration";
export type Kind = "person" | "studio" | "channel" | "book" | "work";

export interface Credit {
  name: string;
  url?: string;
}

export interface Entry {
  id: string;
  name: string;
  kind: Kind;
  relation: Relation;
  sameAs: string[];
  tags?: string[];
  notes?: string;
  added: string;
  gave?: string;
  creditedIn?: Credit[];
}

export interface Owner {
  type: "Person" | "Organization";
  name: string;
  sameAs?: string[];
}

export interface Profile {
  $schema?: string;
  formatVersion: string;
  owner: Owner;
  entries: Entry[];
}

export const KINDS: Kind[] = ["person", "studio", "channel", "book", "work"];

export function newProfile(owner: Owner): Profile {
  return { formatVersion: "1.1", owner, entries: [] };
}

// "Lantern & Loom" -> "lantern-loom"
export function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "");
}

// An id made from the name that no entry in the profile uses yet.
export function freeId(profile: Profile, name: string): string {
  const base = slug(name) || "entry";
  const used = new Set(profile.entries.map((e) => e.id));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base.slice(0, 60)}-${n}`;
    if (!used.has(id)) return id;
  }
}

export function today(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

// Drop empty optional fields, and the inspiration fields of a taste reference,
// so a saved file holds only what the format allows.
export function tidy(entry: Entry): Entry {
  const out: Entry = {
    id: entry.id,
    name: entry.name.trim(),
    kind: entry.kind,
    relation: entry.relation,
    sameAs: entry.sameAs,
    ...(entry.tags && entry.tags.length > 0 ? { tags: entry.tags } : {}),
    ...(entry.notes && entry.notes.trim() !== "" ? { notes: entry.notes.trim() } : {}),
    added: entry.added,
  };
  if (entry.relation === "inspiration") {
    out.gave = (entry.gave ?? "").trim();
    out.creditedIn = entry.creditedIn ?? [];
  }
  return out;
}

export function addEntry(profile: Profile, entry: Entry): Profile {
  return { ...profile, entries: [...profile.entries, tidy(entry)] };
}

export function updateEntry(profile: Profile, id: string, entry: Entry): Profile {
  return {
    ...profile,
    entries: profile.entries.map((e) => (e.id === id ? tidy(entry) : e)),
  };
}

export function removeEntry(profile: Profile, id: string): Profile {
  return { ...profile, entries: profile.entries.filter((e) => e.id !== id) };
}

// Move a taste reference to inspiration. It keeps its id and its date.
export function moveToInspiration(
  profile: Profile,
  id: string,
  gave: string,
  creditedIn: Credit[],
): Profile {
  const entry = profile.entries.find((e) => e.id === id);
  if (!entry) return profile;
  return updateEntry(profile, id, { ...entry, relation: "inspiration", gave, creditedIn });
}

export function setOwner(profile: Profile, owner: Owner): Profile {
  const out: Owner = { type: owner.type, name: owner.name.trim() };
  if (owner.sameAs && owner.sameAs.length > 0) out.sameAs = owner.sameAs;
  return { ...profile, owner: out };
}

export function byRelation(profile: Profile, relation: Relation): Entry[] {
  return profile.entries.filter((e) => e.relation === relation);
}

// The text of the file the app saves.
export function toFileText(profile: Profile): string {
  return JSON.stringify(profile, null, 2) + "\n";
}

// --- Reading what a person types into the form -------------------------------

export function parseLinks(text: string): string[] {
  return [...new Set(text.split(/\s+/).map((s) => s.trim()).filter(Boolean))];
}

export function parseTags(text: string): string[] {
  return [...new Set(text.split(",").map(slug).filter(Boolean))];
}

// One work per line: "Name" or "Name | https://link".
export function parseCredits(text: string): Credit[] {
  const credits: Credit[] = [];
  for (const line of text.split("\n")) {
    const [name, url] = line.split("|").map((s) => s.trim());
    if (!name) continue;
    credits.push(url ? { name, url } : { name });
  }
  return credits;
}

export function formatCredits(credits: Credit[] | undefined): string {
  return (credits ?? []).map((c) => (c.url ? `${c.name} | ${c.url}` : c.name)).join("\n");
}
