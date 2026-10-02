import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

/**
 * Every form control must have an accessible name.
 *
 * WCAG 2.1 AA 1.3.1 (Info and Relationships) and 3.3.2 (Labels or
 * Instructions) both require it, and it is the accessibility failure that is
 * easiest to ship without noticing: the control looks labelled, because there
 * is grey placeholder text sitting in it or a styled <label> right above it,
 * and neither of those is actually connected to the input.
 *
 * That is exactly how the auth form worked. It had visible <label> elements
 * reading "Email" and "Passphrase" -- with no htmlFor and no matching id, so
 * the association the browser exposes is empty and a screen reader announces
 * an anonymous text field. A sighted user saw a labelled form; a
 * screen-reader user got five unnamed inputs on the login screen.
 *
 * Three things satisfy this test:
 *
 *   - a <label htmlFor="x"> whose value matches the control's id;
 *   - a <label> that wraps the control (implicit association, equally valid);
 *   - an explicit aria-label / aria-labelledby on the control itself.
 *
 * Placeholder never counts. It disappears on the first keystroke and is not
 * reliably announced, which is the whole reason it is not enough.
 */

const files = globSync('src/**/*.tsx').filter(f => !f.includes('__tests__'));

interface Offender {
  file: string;
  line: number;
  tag: string;
  placeholder: string | null;
  /** Visible label text sitting immediately above, if any -- the tell that
      this was *meant* to be labelled but never wired up. */
  strayLabel: string | null;
}

/**
 * The attributes of one control's opening tag.
 *
 * Reading a JSX tag with a regex to the first `>` does not work: every
 * onChange handler contains an arrow function, so the tag appears to end at
 * the `=>` and the real attributes -- including any aria-label sitting after
 * it -- are never seen. A first pass of this test did exactly that and
 * reported the help-centre search box as unlabelled when it already carried
 * aria-label="Search help articles".
 *
 * So the tag is scanned by hand: brace depth tracks JSX expression containers,
 * and only a `>` at depth zero actually closes the tag.
 */
function readTag(source: string, open: number): { tag: string; attrs: string; end: number } | null {
  const tag = source.slice(open + 1).match(/^[a-z]+/)?.[0] ?? '';
  let depth = 0;
  for (let i = open + 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) {
      const raw = source.slice(open, i + 1);
      return { tag, attrs: raw.slice(tag.length + 2, -1).replace(/\/$/, ''), end: i };
    }
  }
  return null;
}

function findOffenders(source: string, file: string): Offender[] {
  const out: Offender[] = [];

  // Every <label htmlFor="..."> target in the file.
  const targets = new Set<string>();
  for (const labelled of source.matchAll(/<label[^>]*\bhtmlFor="([^"]+)"/g)) {
    targets.add(labelled[1]);
  }

  for (const open of source.matchAll(/<(input|select|textarea)\b/g)) {
    const parsed = readTag(source, open.index);
    if (!parsed) continue;

    const { tag, attrs, end } = parsed;
    // `hidden` and `className="hidden"` are both off-screen to everyone,
    // including a screen reader, so neither needs a name.
    if (/\btype="hidden"/.test(attrs)) continue;
    if (/\bclassName="[^"]*\bhidden\b[^"]*"/.test(attrs)) continue;

    // Named on itself. Matched on the attribute's presence rather than its
    // value: the value can be a string or a JSX template expression -- an
    // earlier version required `"..."` and so reported a checkbox labelled
    // with `` aria-label={`Mark "${treatment.step}" as done`} `` as nameless.
    if (/\baria-label(?:ledby)?=/.test(attrs)) continue;

    // Named by an explicit label.
    const id = attrs.match(/\bid="([^"]+)"/)?.[1];
    if (id && targets.has(id)) continue;

    // Named implicitly by a <label> wrapping it.
    const before = source.slice(0, open.index);
    const labelOpen = before.lastIndexOf('<label');
    const labelClose = before.lastIndexOf('</label>');
    if (labelOpen > labelClose) continue; // wrapped -- associated

    const stray = before
      .slice(Math.max(0, labelClose + 8))
      .match(/<label[^>]*>([^<]*)<\/label>\s*$/);
    out.push({
      file,
      line: source.slice(0, open.index).split('\n').length,
      tag,
      placeholder: attrs.match(/\bplaceholder="([^"]*)"/)?.[1] ?? null,
      strayLabel: stray ? stray[1].trim() : null,
    });
    void end;
  }
  return out;
}

const offenders = files.flatMap(f => findOffenders(readFileSync(f, 'utf8'), f));

describe('every form control has an accessible name', () => {
  it('the scan found controls to check', () => {
    // Without this, a regex that stops matching makes the whole file pass
    // vacuously -- which is the failure mode this test exists to prevent.
    expect(files.length).toBeGreaterThan(30);
  });

  it('no control is left nameless', () => {
    const report = offenders.map(
      o =>
        `${o.file}:${o.line} <${o.tag}> placeholder=${JSON.stringify(o.placeholder)}` +
        (o.strayLabel ? ` — unassociated label "${o.strayLabel}" is right above it` : '')
    );
    expect(report).toEqual([]);
  });
});