// The stored format of the field: a small, documented Markdown subset.
//
//   A paragraph. A line break inside it
//   is kept.
//
//   **bold**, _italic_, and a [link](https://example.com/).
//
//   - a bullet list
//   - one line for each item
//
// Nothing else is Markdown here: a "#" is a "#". The characters \ * _ [ ] and
// a "-" at the start of a line are written with a backslash before them when
// they are meant as themselves.
//
// These functions turn that text into the editor's document (ProseMirror
// JSON) and back. They need no browser.

export interface Mark {
  type: "bold" | "italic" | "link";
  attrs?: { href: string };
}

export interface Inline {
  type: "text" | "hardBreak";
  text?: string;
  marks?: Mark[];
}

export interface Block {
  type: "paragraph" | "bulletList" | "listItem";
  content?: (Block | Inline)[];
}

export interface Doc {
  type: "doc";
  content: Block[];
}

const ESCAPABLE = "\\*_[]-";
const isLink = (href: string) => /^https?:\/\/[^\s]+$/.test(href);

// --- Markdown to document ------------------------------------------------------

// The index of the next `marker` at or after `from` that no backslash escapes.
function findClose(text: string, from: number, marker: string): number {
  for (let k = from; k < text.length; k++) {
    if (text[k] === "\\") k++;
    else if (text.startsWith(marker, k)) return k;
  }
  return -1;
}

function parseInline(text: string, marks: Mark[] = []): Inline[] {
  const out: Inline[] = [];
  let plain = "";
  const flush = () => {
    if (plain === "") return;
    const node: Inline = { type: "text", text: plain };
    if (marks.length > 0) node.marks = marks;
    out.push(node);
    plain = "";
  };
  const nest = (inner: string, mark: Mark) => {
    flush();
    out.push(...parseInline(inner, [...marks, mark]));
  };
  const has = (type: Mark["type"]) => marks.some((m) => m.type === type);

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length && ESCAPABLE.includes(text[i + 1])) {
      plain += text[i + 1];
      i += 2;
      continue;
    }
    if (text.startsWith("**", i) && !has("bold")) {
      const end = findClose(text, i + 2, "**");
      if (end > i + 2) {
        nest(text.slice(i + 2, end), { type: "bold" });
        i = end + 2;
        continue;
      }
    }
    if (ch === "_" && !has("italic")) {
      const end = findClose(text, i + 1, "_");
      if (end > i + 1) {
        nest(text.slice(i + 1, end), { type: "italic" });
        i = end + 1;
        continue;
      }
    }
    if (ch === "[" && !has("link")) {
      const end = findClose(text, i + 1, "]");
      if (end > i + 1 && text[end + 1] === "(") {
        const close = text.indexOf(")", end + 2);
        const href = close > 0 ? text.slice(end + 2, close) : "";
        if (isLink(href)) {
          nest(text.slice(i + 1, end), { type: "link", attrs: { href } });
          i = close + 1;
          continue;
        }
      }
    }
    plain += ch;
    i++;
  }
  flush();
  return out;
}

export function fromMarkdown(markdown: string): Doc {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];

  const endParagraph = () => {
    if (paragraph.length === 0) return;
    const content: Inline[] = [];
    paragraph.forEach((line, n) => {
      if (n > 0) content.push({ type: "hardBreak" });
      content.push(...parseInline(line));
    });
    blocks.push({ type: "paragraph", content });
    paragraph = [];
  };
  const endList = () => {
    if (items.length === 0) return;
    blocks.push({
      type: "bulletList",
      content: items.map((item) => {
        const content = parseInline(item);
        return {
          type: "listItem",
          content: [content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" }],
        };
      }),
    });
    items = [];
  };

  for (const line of lines) {
    if (line.trim() === "") {
      endParagraph();
      endList();
    } else if (/^- /.test(line) || line === "-") {
      endParagraph();
      items.push(line.slice(2).trim());
    } else {
      endList();
      paragraph.push(line.trim());
    }
  }
  endParagraph();
  endList();
  return { type: "doc", content: blocks.length > 0 ? blocks : [{ type: "paragraph" }] };
}

// --- Document to Markdown ------------------------------------------------------

const escapeText = (text: string) => text.replace(/[\\*_[\]]/g, "\\$&");

// Marks open and close in one fixed order, link outside bold outside italic,
// so the text that comes out reads back as the same marks.
const ORDER: Mark["type"][] = ["link", "bold", "italic"];
const OPEN = { link: () => "[", bold: () => "**", italic: () => "_" };
const CLOSE = {
  link: (href: string) => `](${href.replace(/\)/g, "%29").replace(/\s/g, "%20")})`,
  bold: () => "**",
  italic: () => "_",
};

function serializeInline(nodes: (Block | Inline)[] | undefined, breakAs: string): string {
  let out = "";
  let open: Mark[] = [];
  const closeFrom = (depth: number) => {
    for (let k = open.length - 1; k >= depth; k--) {
      out += CLOSE[open[k].type](open[k].attrs?.href ?? "");
    }
    open = open.slice(0, depth);
  };

  for (const node of (nodes ?? []) as Inline[]) {
    if (node.type === "hardBreak") {
      closeFrom(0);
      out += breakAs;
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const wanted = ORDER.flatMap((type) => {
      const mark = (node.marks ?? []).find((m) => m.type === type);
      if (!mark) return [];
      // A link that is not http or https is written as plain text.
      if (type === "link" && !isLink(mark.attrs?.href ?? "")) return [];
      return [mark];
    });
    // Keep the marks that stay the same from the outside in; close the rest.
    let same = 0;
    while (
      same < open.length &&
      same < wanted.length &&
      open[same].type === wanted[same].type &&
      open[same].attrs?.href === wanted[same].attrs?.href
    ) {
      same++;
    }
    closeFrom(same);
    for (const mark of wanted.slice(same)) {
      out += OPEN[mark.type]();
      open.push(mark);
    }
    out += escapeText(node.text);
  }
  closeFrom(0);
  return out;
}

const escapeLineStart = (line: string) => line.replace(/^-(?= |$)/, "\\-");

export function toMarkdown(doc: Doc): string {
  const blocks: string[] = [];
  for (const block of doc.content ?? []) {
    if (block.type === "paragraph") {
      const text = serializeInline(block.content, "\n")
        .split("\n")
        .map((line) => escapeLineStart(line.trim()))
        .filter((line) => line !== "")
        .join("\n");
      if (text !== "") blocks.push(text);
    } else if (block.type === "bulletList") {
      const items = (block.content ?? [])
        .map((item) =>
          ((item as Block).content ?? [])
            .map((child) => serializeInline((child as Block).content, " ").trim())
            .filter(Boolean)
            .join(" "),
        )
        .filter((line) => line !== "");
      if (items.length > 0) blocks.push(items.map((line) => `- ${line}`).join("\n"));
    }
  }
  return blocks.join("\n\n");
}

// The text with no marks, for search, counts or a one-line preview.
export function toPlainText(markdown: string): string {
  const inline = (nodes: (Block | Inline)[] | undefined): string =>
    ((nodes ?? []) as Inline[]).map((n) => (n.type === "hardBreak" ? "\n" : n.text ?? "")).join("");
  return fromMarkdown(markdown)
    .content.map((block) =>
      block.type === "bulletList"
        ? (block.content ?? [])
            .map((item) => inline(((item as Block).content?.[0] as Block | undefined)?.content))
            .join("\n")
        : inline(block.content),
    )
    .join("\n\n");
}
