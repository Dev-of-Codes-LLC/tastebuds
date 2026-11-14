// Export a profile as schema.org JSON-LD.
//
// The graph holds the owner, one ItemList for each relation, and the owner's
// works that credit an inspiration. The two relations stay apart: a taste
// reference appears only in the "Taste references" list, with no claim that
// it shaped anything.

import type { Entry, Profile } from "./profile.ts";
import { kinds } from "./validate.ts";

type Node = Record<string, unknown>;

const entryId = (id: string) => `#entry-${id}`;

function entity(entry: Entry): Node {
  const node: Node = {
    "@type": (kinds as Record<string, string>)[entry.kind],
    "@id": entryId(entry.id),
    name: entry.name,
    url: entry.sameAs[0],
    sameAs: entry.sameAs,
  };
  if (entry.tags && entry.tags.length > 0) node.keywords = entry.tags.join(", ");
  return node;
}

function list(id: string, name: string, description: string, entries: Entry[]): Node {
  return {
    "@type": "ItemList",
    "@id": id,
    name,
    description,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, i) => {
      const item: Node = { "@type": "ListItem", position: i + 1, item: entity(entry) };
      // What the entity gave: only an inspiration has it.
      if (entry.relation === "inspiration" && entry.gave) item.description = entry.gave;
      return item;
    }),
  };
}

// The owner's works that credit an inspiration, each with the entries it credits.
function works(profile: Profile): Node[] {
  const byKey = new Map<string, Node & { mentions: Node[] }>();
  for (const entry of profile.entries) {
    if (entry.relation !== "inspiration") continue;
    for (const credit of entry.creditedIn ?? []) {
      const key = `${credit.name}\n${credit.url ?? ""}`;
      let work = byKey.get(key);
      if (!work) {
        work = {
          "@type": "CreativeWork",
          name: credit.name,
          ...(credit.url ? { url: credit.url } : {}),
          creator: { "@id": "#owner" },
          mentions: [],
        };
        byKey.set(key, work);
      }
      work.mentions.push({ "@id": entryId(entry.id) });
    }
  }
  return [...byKey.values()];
}

export function toJsonLd(profile: Profile): Node {
  const owner: Node = {
    "@type": profile.owner.type,
    "@id": "#owner",
    name: profile.owner.name,
  };
  if (profile.owner.sameAs && profile.owner.sameAs.length > 0) {
    owner.url = profile.owner.sameAs[0];
    owner.sameAs = profile.owner.sameAs;
  }
  const inspirations = profile.entries.filter((e) => e.relation === "inspiration");
  const references = profile.entries.filter((e) => e.relation === "tasteReference");
  return {
    "@context": "https://schema.org",
    "@graph": [
      owner,
      list(
        "#inspirations",
        "Inspirations",
        `People and work that gave something to the work of ${profile.owner.name}, credited by name.`,
        inspirations,
      ),
      list(
        "#taste-references",
        "Taste references",
        `People and work whose taste ${profile.owner.name} watches. Nothing was taken from them.`,
        references,
      ),
      ...works(profile),
    ],
  };
}

export function toJsonLdText(profile: Profile): string {
  return JSON.stringify(toJsonLd(profile), null, 2) + "\n";
}
