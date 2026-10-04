import { describe, it, expect } from 'vitest';
import {
  readSource,
  stripJsComments,
  classNameOf,
  openingTags,
  interactiveTagsOf,
  tagAround,
} from '../../test/helpers';

/**
 * The interface was typeset for a desktop canvas and inherited unchanged to
 * phones. Measured at 390px, the landing page rendered six 9px labels, eight
 * 10px labels and five 12px paragraphs with nothing between 12px and 16px, and
 * the footer links came out 38px tall -- under the 44px touch minimum.
 *
 * The fixes live in CSS and at a handful of call sites rather than at the
 * several hundred places that use these sizes. That makes them invisible to
 * review, so these tests pin them: a well-meaning tidy-up that deletes the
 * media query or shrinks a control would otherwise put the whole app back
 * without turning anything red.
 */

const indexCss = readSource('src/index.css');
const skinsCss = readSource('src/styles/page-skins.css');

/** The whole phone media query, brace-matched. Slicing to the first `}` would
 *  cut the block off after a single rule and quietly pass the rest. */
function phoneBlock(css: string): string {
  const clean = stripJsComments(css);
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
  const home = stripJsComments(readSource('src/pages/Home.tsx'));

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
    // reveal when scrolled to rather than the instant they mount.
    const card = cardBlock();
    expect(card, 'the feature cards lost their scroll reveal').toContain('whileInView');
    expect(card, 'the reveal should fire once, not on every pass')
      .toMatch(/viewport=\{\{[^}]*once:\s*true/);
  });
});

describe('the route wrapper', () => {
  const app = stripJsComments(readSource('src/App.tsx'));

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

describe('Lab tap targets', () => {
  const lab = stripJsComments(readSource('src/pages/BotanicalLab.tsx'));
  const MIN_44 = 'min-h-[44px]';

  it('finds each control by its own markup', () => {
    // Guards the slicing in tagAround. If a marker stopped existing, the
    // assertions below would quietly become assertions about the wrong tag.
    expect(tagAround(lab, '← Back to the Estate')).toContain('className');
    expect(tagAround(lab, 'Sign up free')).toContain('className');
    expect(tagAround(lab, 'setMagnification(mag)')).toContain('className');
  });

  it.each([
    ['the back control', '← Back to the Estate'],
    ['the sign-up call to action', 'Sign up free'],
    ['the magnification selectors', 'setMagnification(mag)'],
  ])('gives %s the 44px touch minimum', (_label, marker) => {
    // Padding does not reach it. The type floor raises these labels to 11px,
    // which is a 16.5px line box, so `py-2` tops out around 32.5px -- and the
    // back control measured 17px before this, on the only way out of the page
    // for a signed-out visitor. The height has to be asked for explicitly.
    expect(tagAround(lab, marker)).toContain(MIN_44);
  });

  it('sets no Lab control height below the touch minimum', () => {
    // The general form of the rule, so the next `min-h-[40px]` added around
    // here turns the suite red instead of shipping another small target.
    const tooSmall = openingTags(lab)
      .map((t) => classNameOf(t.tag))
      .flatMap((cls) => [...cls.matchAll(/min-h-\[(\d+)px\]/g)].map((m) => m[0]))
      .filter((declared) => Number(declared.match(/\d+/)![0]) < 44);
    expect(tooSmall, `under-sized Lab controls: ${tooSmall.join(', ')}`).toEqual([]);
  });

  it('asks for 44px on every Lab control that is sized by its padding', () => {
    // This is the check that would have caught the two controls a route-level
    // audit misses. Both render only after a scan -- the "Scan a Plant" primary
    // and the provenance release that unlocks a held seed -- so they are absent
    // from every Lab tab URL, and measuring the pages found neither. Reading
    // the source does find them.
    //
    // Only buttons whose height actually comes from padding are considered: an
    // icon button sized by `w-* h-*` is already explicit, and the field
    // selectors use a conditional class, so the interpolated part is removed
    // before matching rather than pattern-matched around.
    const undersized = openingTags(lab)
      .filter((t) => /\bpy-|\bmin-h-|\bh-/.test(t.tag))
      .map((t) => classNameOf(t.tag))
      .filter((cls) => cls.trim().length > 0 && !cls.includes(MIN_44));

    expect(undersized, `Lab controls left to their padding: ${undersized.join(' | ')}`)
      .toEqual([]);
  });
});

describe('market tap targets', () => {
  const market = stripJsComments(readSource('src/pages/Market.tsx'));
  const MIN_44 = 'min-h-[44px]';

  it('gives the pin-crate button a real touch area', () => {
    // Pinning is a primary card action, and the button measured 32x32 at
    // 390px -- 12px under the touch minimum, on every card of every stall.
    // It is sized by h-11/w-11 rather than min-h because it is absolutely
    // positioned over the image and must be exactly the box it declares.
    const tag = tagAround(market, "aria-label={wished ? 'Unpin crate' : 'Pin crate'}");
    expect(tag).toMatch(/\bh-11\b/);
    expect(tag).toMatch(/\bw-11\b/);
  });

  it('draws the hero dots on an inner bar inside a 44px button', () => {
    // The dots used to be the animated elements themselves -- 8px-tall
    // buttons, unpickable with a thumb. The animation now lives on an inner
    // span and the button is the hit area.
    const tag = tagAround(market, 'Go to stall slide');
    expect(tag).toContain(MIN_44);
    const at = market.indexOf('Go to stall slide');
    expect(market.slice(at, market.indexOf('</button>', at))).toMatch(/<motion\.span/);
  });

  it('keeps the digital goods buttons at the touch minimum', () => {
    // Both buy and equip measured 40px, four under.
    expect(tagAround(market, "'Buy with seeds'")).toContain(MIN_44);
    expect(tagAround(market, "'Equip'")).toContain(MIN_44);
  });

  it('raises the bazaar kicker on phones, which the utility floor cannot reach', () => {
    // `.bazaar-kicker` is a hand-written 9px class in page-skins.css, the same
    // case as the lab kicker: index.css floors utilities, not hand-written
    // classes. Measured 9px at 390px -- the smallest text in the app.
    const block = phoneBlock(skinsCss);
    expect(block).toMatch(/\.bazaar-kicker\s*\{[^}]*font-size:\s*10px/);
  });
});

describe('app-wide tap targets', () => {
  /** The pages swept at 390px in the app-wide audit. A `min-h-[NNpx]` under
   *  44 in any of them is a control the sweep would have measured short. */
  const SWEPT_PAGES = [
    'src/pages/Clinic.tsx',
    'src/pages/Vault.tsx',
    'src/pages/Profile.tsx',
    'src/pages/Library.tsx',
    'src/pages/Assistant.tsx',
    'src/pages/HelpPage.tsx',
    'src/pages/Privacy.tsx',
  ];

  const sources = Object.fromEntries(SWEPT_PAGES.map((p) => [p, stripJsComments(readSource(p))]));

  it('every swept page is free of explicit minimums under 44px', () => {
    // The audit found min-h-[40px] controls on Profile, Library (via its
    // error state) and Assistant, plus padding-sized controls. Explicit
    // minimums below 44 are how the small ones came back last time.
    //
    // Scoped to interactive opening tags on purpose: Library lays out a card
    // row with `min-h-[28px]` on a div, which is spacing, not a touch target.
    for (const [path, src] of Object.entries(sources)) {
      const small = interactiveTagsOf(src)
        .map((t) => classNameOf(t.tag))
        .flatMap((cls) => [...cls.matchAll(/min-h-\[(\d+)px\]/g)].map((m) => m[0]))
        .filter((declared) => Number(declared.match(/\d+/)![0]) < 44);
      expect(small, `${path} declares under-sized minimums: ${small.join(', ')}`).toEqual([]);
    }
  });

  it('keeps the Clinic breadcrumbs reachable', () => {
    // They are the only way back from the dispensary and measured 16px tall.
    const clinic = sources['src/pages/Clinic.tsx'];
    for (const label of ['Command Center</Link>', 'Botanical Lab</Link>']) {
      expect(tagAround(clinic, label, ['<Link'])).toContain('min-h-[44px]');
    }
  });

  it('keeps the Privacy policy link a real target', () => {
    // An inline link inside a paragraph measured 18px tall; min-h makes the
    // box 44px and the negative margin keeps the paragraph line intact.
    const tag = tagAround(sources['src/pages/Privacy.tsx'], 'supabase.com/privacy', ['<a']);
    expect(tag).toContain('min-h-[44px]');
    expect(tag).toContain('-my-3');
  });

  it('keeps the Library record link a real target', () => {
    const library = sources['src/pages/Library.tsx'];
    expect(tagAround(library, 'Open Record', ['<a'])).toContain('min-h-[44px]');
  });

  it('the passport toggles keep their invisible 44px hit area', () => {
    // The switch draws 24px tall, which the browser audit flags -- but its
    // ::after overlay extends the tappable band to 44px. That overlay is the
    // difference between a violation and a false positive, so pin it.
    expect(skinsCss).toMatch(/\.passport-toggle-switch::after\s*\{[^}]*inset:\s*-10px 0[^}]*pointer-events:\s*auto/);
  });

  it('the Assistant mic key is a 44px box, not a 32px one', () => {
    const assistant = sources['src/pages/Assistant.tsx'];
    const tag = tagAround(assistant, 'telegraph-key-mic');
    expect(tag).toMatch(/\bw-11 h-11\b/);
  });
});
