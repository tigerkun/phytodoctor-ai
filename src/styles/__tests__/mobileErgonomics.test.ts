import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The interface was typeset for a desktop canvas and inherited unchanged to
 * phones. Measured at 390px, the landing page rendered six 9px labels, eight
 * 10px labels and five 12px paragraphs with nothing between 12px and 16px, and
 * the footer links came out 38px tall -- under the 44px touch minimum.
 *
 * The floor lives in CSS rather than at the several hundred call sites that use
 * these sizes. That makes it invisible to review, so these tests pin it: a
 * well-meaning tidy-up that deletes the media query would otherwise put the
 * whole app back to unreadable type on phones without turning anything red.
 */

const indexCss = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
const skinsCss = readFileSync(join(process.cwd(), 'src/styles/page-skins.css'), 'utf8');

/** Comments are stripped before anything else, in both languages. Several
 *  places here are commented with the measurement that motivated them, and those
 *  comments quote the very class names, props and pixel sizes the assertions
 *  look for -- so a test that reads raw source matches its own explanation as a
 *  violation. JSX uses `{/* ... *\/}` for the same reason; those are block
 *  comments and have to go too, or a tag search lands inside one. */
function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Line comments only, and a `//` directly after a `:` is left alone so that a
 *  URL inside a string literal does not truncate the line. */
function stripJsComments(source: string): string {
  return stripCssComments(source).replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** The whole phone media query, brace-matched. Slicing to the first `}` would
 *  cut the block off after a single rule and quietly pass the rest. */
function phoneBlock(css: string): string {
  const clean = stripCssComments(css);
  const start = clean.indexOf('@media (max-width: 480px)');
  expect(start, 'expected a phone-width media query').toBeGreaterThan(-1);
  let depth = 0;
  for (let i = clean.indexOf('{', start); i < clean.length; i++) {
    if (clean[i] === '{') depth++;
    else if (clean[i] === '}' && --depth === 0) return clean.slice(start, i + 1);
  }
  throw new Error('unclosed media query');
}

/** The font-size a selector resolves to inside `block`, or null. */
function fontSizeIn(block: string, selector: string): number | null {
  const at = block.indexOf(selector);
  if (at === -1) return null;
  const body = block.slice(block.indexOf('{', at) + 1, block.indexOf('}', at));
  const declared = body.match(/font-size:\s*([\d.]+)px/);
  return declared ? Number(declared[1]) : null;
}

/** The class as it is actually written in CSS, with the brackets escaped. */
function textUtility(size: string): string {
  return `.text-\\[${size}\\]`;
}

const FLOOR_SIZES: [string, number][] = [
  ['7px', 7], ['8px', 8], ['9px', 9], ['10px', 10], ['11px', 11], ['12px', 12],
];

describe('the phone type floor', () => {
  const block = phoneBlock(indexCss);

  it('reads the stylesheets it means to check', () => {
    expect(indexCss.length).toBeGreaterThan(1000);
    expect(skinsCss.length).toBeGreaterThan(1000);
    expect(block).toContain('max-width: 480px');
  });

  it('lifts every sub-10px utility off the desktop scale', () => {
    for (const [size] of FLOOR_SIZES) {
      const raised = fontSizeIn(block, textUtility(size));
      expect(raised, `no rule for ${textUtility(size)} in the phone floor`).not.toBeNull();
      expect(raised!, `${textUtility(size)} was not raised`).toBeGreaterThanOrEqual(10);
    }
  });

  it('never lets a utility shrink below what it was', () => {
    for (const [size, original] of FLOOR_SIZES) {
      const raised = fontSizeIn(block, textUtility(size));
      expect(raised, `no rule for ${textUtility(size)}`).not.toBeNull();
      expect(raised!, `${textUtility(size)} shrank on phones`).toBeGreaterThan(original);
    }
  });

  it('gives footer links the 44px touch minimum', () => {
    expect(block).toMatch(/footer\s+a\s*\{[^}]*min-height:\s*44px/);
  });

  it('leaves the postmark alone', () => {
    // The Assistant's 5-6.5px "Kew Station Botanic Dispatch" is letterpress
    // texture: four lines of tiny caps *are* the stamp. Sizing it up would
    // flatten the effect it exists to create, so it is deliberately outside
    // the floor.
    for (const size of ['5px', '5\\.5px', '6px', '6\\.5px']) {
      expect(block, `${textUtility(size)} should not be in the phone floor`).not.toContain(textUtility(size));
    }
  });

  it('covers the Lab kicker, which is a hand-written class rather than a utility', () => {
    // page-skins.css is a separate file, so the index.css floor cannot reach
    // it -- and the Lab kicker measured 9px on a phone until it was added.
    const block = phoneBlock(skinsCss);
    expect(block).toMatch(/\.skin-lab\s+\.lab-kicker\s*\{[^}]*font-size:\s*11px/);
  });
});

describe('phone motion', () => {
  const home = stripJsComments(readFileSync(join(process.cwd(), 'src/pages/Home.tsx'), 'utf8'));

  it('reads the landing page it means to check', () => {
    expect(home.length).toBeGreaterThan(1000);
  });

  it('links the crest to scroll rather than to a one-shot mount', () => {
    // Every animation on the landing used to fire once and leave the page
    // static, which is what read as dead rather than calm.
    expect(home).toContain('useScroll');
    expect(home).toContain('useTransform');
  });

  it('does not put scroll values on an element an entrance animation already owns', () => {
    // Two owners writing the same transform silently lose: the entrance won and
    // the scroll values were discarded, which is what happened the first time
    // this was written on the crest wrapper.
    const styled = home.match(/style=\{\{\s*y:\s*crestY[^}]*\}\}/);
    expect(styled, 'crest MotionValues not found').not.toBeNull();
    const between = home.slice(home.lastIndexOf('<motion.div', styled!.index), styled!.index);
    expect(
      between,
      'a motion wrapper between the crest style and its element also animates y or opacity',
    ).not.toMatch(/animate=\{\{[^}]*(opacity|\by:)/);
  });

  // The whole `{FEATURES.map(...)}` expression. Sliced to the closing `})}` of
  // the map rather than to a fixed length, so a longer explanation comment
  // cannot push the assertions past the end of the block they are about.
  const cardBlock = () => {
    const start = home.indexOf('{FEATURES.map(');
    expect(start, 'the feature card map was not found').toBeGreaterThan(-1);
    return home.slice(start, home.indexOf('})}', start) + 3);
  };

  it('gives the feature cards touch feedback, not just hover', () => {
    // whileHover never fires on a touchscreen.
    const card = cardBlock();
    expect(card).toContain('whileTap');
    expect(card).toContain('whileHover');
  });

  it('gates the below-fold cards on scroll arriving', () => {
    // These cards sit ~950px down, below the fold on any phone, so they should
    // reveal when scrolled to rather than the instant they mount. This was
    // previously asserted the other way round, as a documented dead end: see
    // `does not suppress the initial state of every page below it`.
    const card = cardBlock();
    expect(card, 'the feature cards lost their scroll reveal').toContain('whileInView');
    expect(card, 'the reveal should fire once, not on every pass')
      .toMatch(/viewport=\{\{[^}]*once:\s*true/);
  });
});

describe('the route wrapper', () => {
  const app = stripJsComments(readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8'));

  it('does not suppress the initial state of every page below it', () => {
    // This was `<AnimatePresence initial={false} ...>`, which reads like "don't
    // animate on first load" but actually means "suppress the `initial` state of
    // every descendant motion component", not just the one it wraps.
    //
    // Consequence, measured at 390px: every below-the-fold element on the
    // landing page had `style=""` -- framer never painted it -- and sat at
    // computed opacity 1. All eleven `whileInView` call sites across five files
    // were rendering already-visible and had no reveal left to perform, which is
    // what made the page read as dead. Eleven components, one flag.
    expect(app, 'AnimatePresence initial={false} suppresses every nested reveal')
      .not.toMatch(/<AnimatePresence[^>]*\binitial=\{false\}/);
  });

  it('still skips the transition on a cold start, scoped to the wrapper', () => {
    // Dropping the flag outright would fade the entire app in from nothing on
    // every load, so the intent behind it is kept -- on the one element that
    // actually wanted it.
    expect(app).toMatch(/isFirstRender\s*\|\|\s*shouldReduceMotion\s*\?\s*false/);
  });

  it('keeps the route transition itself', () => {
    expect(app).toContain('<AnimatePresence');
    expect(app).toMatch(/mode="wait"/);
  });
});