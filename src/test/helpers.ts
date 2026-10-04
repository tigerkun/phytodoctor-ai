import { expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Shared helpers for the source-level regression tests. There is no DOM test
 * environment (see AGENTS.md), so the suite reads shipped source and asserts
 * on what the code actually does — which means every test file needs the same
 * comment-stripping and JSX-tag scanning. They used to be re-implemented per
 * file, which is exactly the kind of drift a shared helper exists to prevent.
 */

/** Read a project file relative to the repo root. */
export function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

/** Remove JS and JSX comments. Block comments (`/* ... *\/` and `{/* ... *\/}`)
 *  go first, then line comments — leaving a `//` directly after a `:` alone,
 *  so a URL inside a string literal does not truncate its line. Tests quote
 *  the very class names and code they assert on, and without this they match
 *  their own explanations as violations. */
export function stripJsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** The class name written on a JSX opening tag, with any `${...}`
 *  interpolation removed so a conditional class does not hide the static
 *  half. Handles plain strings, template literals and brace expressions. */
export function classNameOf(tag: string): string {
  const found = tag.match(/className=(?:"([^"]*)"|\{`([\s\S]*?)`\}|\{'([^']*)'\})/);
  return (found?.[1] ?? found?.[2] ?? found?.[3] ?? '').replace(/\$\{[^}]*\}/g, '');
}

/** Every opening tag of the given kinds, with its start offset.
 *
 *  A naive `/<button\b[^>]*>/` stops at the first `>`, which inside
 *  `onClick={(e) => {` is the arrow — so any button with an inline handler
 *  and a template-literal className comes back with no className on it and
 *  tag-based assertions silently skip it. This tracks brace and paren depth,
 *  skips string literals, and reads the `>` of an `=>` as an arrow rather
 *  than the end of the tag. */
export function openingTags(
  source: string,
  tagNames: string[] = ['<button'],
): { start: number; tag: string }[] {
  const tags: { start: number; tag: string }[] = [];
  for (const name of tagNames) {
    for (let at = source.indexOf(name); at !== -1; at = source.indexOf(name, at + 1)) {
      // '<a' must not match '<article': the tag name has to end here.
      const after = source[at + name.length];
      if (after && !/[\s>]/.test(after)) continue;
      let depth = 0;
      let quote = '';
      for (let i = at; i < source.length; i++) {
        const ch = source[i];
        if (quote) {
          if (ch === quote) quote = '';
        } else if (ch === '"' || ch === "'" || ch === '`') {
          quote = ch;
        } else if (ch === '{' || ch === '(') {
          depth++;
        } else if (ch === '}' || ch === ')') {
          depth--;
        } else if (ch === '>' && depth === 0 && source[i - 1] !== '=') {
          tags.push({ start: at, tag: source.slice(at, i + 1) });
          break;
        }
      }
    }
  }
  return tags;
}

/** Every `<button>` and `<a>` opening tag. */
export function interactiveTagsOf(source: string): { start: number; tag: string }[] {
  return openingTags(source, ['<button', '<a']);
}

/** The opening tag that owns `marker` — the last one opening before it, which
 *  also holds when the marker is the element's own label and therefore sits
 *  after the tag closes. Fails the test when the marker is missing or matched
 *  outside any tag (e.g. in an import). */
export function tagAround(
  source: string,
  marker: string,
  tagNames: string[] = ['<button'],
): string {
  const at = source.indexOf(marker);
  expect(at, `"${marker}" was not found`).toBeGreaterThan(-1);
  const open = source.lastIndexOf(tagNames[0], at);
  expect(open, `"${marker}" matched outside any ${tagNames[0]}`).toBeGreaterThan(-1);
  const owner = openingTags(source, tagNames).find((t) => t.start === open);
  if (!owner) throw new Error(`unterminated ${tagNames[0]} tag opened at ${open}`);
  return owner.tag;
}
