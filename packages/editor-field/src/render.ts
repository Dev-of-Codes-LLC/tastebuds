// Show a stored document as read-only page elements, with no editor.
// It builds elements one by one and never parses HTML, so the text of a
// document cannot add markup of its own.

import { fromMarkdown } from "./markdown.ts";
import type { Block, Inline } from "./markdown.ts";

const TAG = { bold: "strong", italic: "em", link: "a" } as const;

function inline(nodes: (Block | Inline)[] | undefined, parent: HTMLElement, doc: Document): void {
  for (const node of (nodes ?? []) as Inline[]) {
    if (node.type === "hardBreak") {
      parent.append(doc.createElement("br"));
      continue;
    }
    let el: Node = doc.createTextNode(node.text ?? "");
    for (const mark of [...(node.marks ?? [])].reverse()) {
      const wrap = doc.createElement(TAG[mark.type]);
      if (mark.type === "link") {
        wrap.setAttribute("href", mark.attrs?.href ?? "");
        wrap.setAttribute("target", "_blank");
        wrap.setAttribute("rel", "noopener noreferrer");
      }
      wrap.append(el);
      el = wrap;
    }
    parent.append(el);
  }
}

export function renderMarkdown(markdown: string, doc: Document = document): DocumentFragment {
  const out = doc.createDocumentFragment();
  for (const block of fromMarkdown(markdown).content) {
    if (block.type === "bulletList") {
      const ul = doc.createElement("ul");
      for (const item of block.content ?? []) {
        const li = doc.createElement("li");
        inline(((item as Block).content?.[0] as Block | undefined)?.content, li, doc);
        ul.append(li);
      }
      out.append(ul);
    } else if (block.content && block.content.length > 0) {
      const p = doc.createElement("p");
      inline(block.content, p, doc);
      out.append(p);
    }
  }
  return out;
}
