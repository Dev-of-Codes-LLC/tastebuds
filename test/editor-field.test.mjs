import { test } from "node:test";
import assert from "node:assert/strict";
import { fromMarkdown, toMarkdown, toPlainText } from "tastebuds-editor-field/markdown";

const round = (markdown) => toMarkdown(fromMarkdown(markdown));
const text = (value, ...marks) =>
  marks.length > 0 ? { type: "text", text: value, marks } : { type: "text", text: value };
const p = (...content) => ({ type: "paragraph", content });

test("plain notes from format 1.0 read as paragraphs and line breaks", () => {
  const doc = fromMarkdown("Plates that look simple.\nAnd never are.\n\nA second thought.");
  assert.deepEqual(doc.content, [
    p(text("Plates that look simple."), { type: "hardBreak" }, text("And never are.")),
    p(text("A second thought.")),
  ]);
  assert.equal(toMarkdown(doc), "Plates that look simple.\nAnd never are.\n\nA second thought.");
});

test("bold, italic and links read as marks", () => {
  const doc = fromMarkdown("**Slow** and _patient_, see [the film](https://films.example/dawn).");
  assert.deepEqual(doc.content, [
    p(
      text("Slow", { type: "bold" }),
      text(" and "),
      text("patient", { type: "italic" }),
      text(", see "),
      text("the film", { type: "link", attrs: { href: "https://films.example/dawn" } }),
      text("."),
    ),
  ]);
});

test("a bullet list reads as a list, one line for each item", () => {
  const doc = fromMarkdown("To try:\n- brown butter\n- **more** salt\n\nDone.");
  assert.equal(doc.content.length, 3);
  assert.equal(doc.content[1].type, "bulletList");
  assert.deepEqual(doc.content[1].content[1], {
    type: "listItem",
    content: [p(text("more", { type: "bold" }), text(" salt"))],
  });
});

test("every part of the subset reads back as the same text", () => {
  for (const markdown of [
    "One paragraph.",
    "Two lines\nin one paragraph.",
    "First.\n\nSecond.",
    "**bold** then _italic_ then **_both_**",
    "[a link](https://example.com/a_b) and [**a bold link**](https://example.com/)",
    "- one\n- two\n- _three_",
    "Before.\n\n- one\n- two\n\nAfter.",
    "snake\\_case, 2 \\* 3, \\[brackets\\] and a \\\\ backslash",
    "\\- not a list",
  ]) {
    assert.equal(round(markdown), markdown, markdown);
  }
});

test("marks that overlap read back as the same marks", () => {
  const doc = {
    type: "doc",
    content: [
      p(
        text("a", { type: "bold" }),
        text("b", { type: "bold" }, { type: "italic" }),
        text("c", { type: "italic" }),
        text("d", { type: "italic" }, { type: "link", attrs: { href: "https://example.com/" } }),
      ),
    ],
  };
  const markdown = toMarkdown(doc);
  assert.equal(markdown, "**a_b_**_c_[_d_](https://example.com/)");
  const marksOf = (d) => d.content[0].content.map((n) => [n.text, (n.marks ?? []).map((m) => m.type).sort()]);
  assert.deepEqual(marksOf(fromMarkdown(markdown)), marksOf(doc));
});

test("markers with no partner are plain text", () => {
  assert.deepEqual(fromMarkdown("2 * 3 and a_b and [x] and **").content, [
    p(text("2 * 3 and a_b and [x] and **")),
  ]);
});

test("only http and https links are links", () => {
  assert.deepEqual(fromMarkdown("[click](javascript:alert(1))").content, [
    p(text("[click](javascript:alert(1))")),
  ]);
  const doc = { type: "doc", content: [p(text("x", { type: "link", attrs: { href: "javascript:alert(1)" } }))] };
  assert.equal(toMarkdown(doc), "x");
});

test("a link's address cannot break out of its brackets", () => {
  const doc = { type: "doc", content: [p(text("x", { type: "link", attrs: { href: "https://example.com/a)b" } }))] };
  const markdown = toMarkdown(doc);
  assert.equal(markdown, "[x](https://example.com/a%29b)");
  assert.equal(fromMarkdown(markdown).content[0].content[0].marks[0].attrs.href, "https://example.com/a%29b");
});

test("headings and other Markdown stay as typed", () => {
  assert.equal(round("# Not a heading\n> not a quote\n1. not a numbered list"), "# Not a heading\n> not a quote\n1. not a numbered list");
});

test("empty notes are one empty paragraph, and write back as nothing", () => {
  assert.deepEqual(fromMarkdown("").content, [{ type: "paragraph" }]);
  assert.equal(round(""), "");
  assert.equal(round("  \n\n  "), "");
  assert.equal(toMarkdown({ type: "doc", content: [{ type: "paragraph" }, p(text("x")), { type: "paragraph" }] }), "x");
});

test("plain text drops the marks", () => {
  assert.equal(toPlainText("**Slow** and [patient](https://example.com/).\n\n- one\n- _two_"), "Slow and patient.\n\none\ntwo");
});

test("the field imports where there is no browser", async () => {
  const field = await import("tastebuds-editor-field");
  assert.equal(typeof field.createEditor, "function");
  assert.throws(() => field.createEditor({}), /mount/);
});
