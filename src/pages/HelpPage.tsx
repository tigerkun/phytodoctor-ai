import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HelpCircle, RefreshCw, Search } from 'lucide-react';
import { restartOnboardingTour } from '@/components/OnboardingTour';

interface Faq {
  q: string;
  a: string;
}

interface FaqCategory {
  title: string;
  /** Chip label for the category bar. The titles run long
   *  ("PhytoCards, the Vault & Check-ins") and eight of them side by side
   *  would need a bar wider than any phone. */
  short: string;
  items: Faq[];
}

const FAQS: FaqCategory[] = [
  {
    title: 'Getting Started',
    short: 'Getting Started',
    items: [
      {
        q: 'What is PhytoDoctor AI?',
        a: 'A botanical clinic in your pocket. Photograph a plant and the AI identifies the species, detects disease or stress, and writes a treatment plan. Care actions earn Seeds, grow collectible PhytoCards, and unlock Pro perks.',
      },
      {
        q: 'Do I need an account to use it?',
        a: 'You can explore the landing page without one, but scanning, Seeds, and the Vault require signing in — with Google or an email/password. Your progress is tied to your account.',
      },
      {
        q: 'Is it free?',
        a: 'Yes. Scans, check-ins, quizzes, the market and the Vault are free with sensible daily AI limits. Pro (₹99/month, or 1,000 earned Seeds) raises those limits and adds a 1.5× Seed multiplier.',
      },
      {
        q: 'Does it work offline?',
        a: 'Partially. Your plants, cards and Seed balance live on your device, so the app opens and shows your sanctuary without a network. AI features need internet. Seed changes made offline sync automatically when you reconnect.',
      },
      {
        q: 'I skipped the intro tour. Can I see it again?',
        a: 'Yes — open Profile and choose "Replay guided tour", or use the button at the top of this page.',
      },
    ],
  },
  {
    title: 'Seeds & the Economy',
    short: 'Seeds',
    items: [
      {
        q: 'What are Seeds?',
        a: 'Seeds are the in-app currency. They are earned through activity — never bought directly — and spent on Pro and marketplace perks.',
      },
      {
        q: 'How do I earn Seeds?',
        a: 'Daily check-ins on your plants, scanning new specimens, discovery rewards for rare species, Library quizzes, and care streaks. Pro members earn 1.5× on most rewards.',
      },
      {
        q: 'Is there a limit to how many Seeds I can earn per day?',
        a: 'Yes. To keep the economy fair, server-side daily earning caps apply (roughly 2,000/day). Regular play stays far below this. If you ever hit it, the app tells you and the cap resets the next day.',
      },
      {
        q: 'How do I spend Seeds?',
        a: 'The main use is Pro membership: 1,000 Seeds grants Pro without paying money. Marketplace activity also earns Seed refunds on real orders.',
      },
      {
        q: 'My Seed balance looks different from what I remember. Why?',
        a: 'For signed-in accounts the server is the source of truth. If the app was offline, changes you made locally sync up when you reconnect and the balance reconciles. If you believe Seeds went missing, replay the sync: open Profile, then come back to Home.',
      },
    ],
  },
  {
    title: 'Scanning & Diagnosis',
    short: 'Scanning',
    items: [
      {
        q: 'How do I scan a plant?',
        a: 'Open the Wet Lab (Lab tab), photograph or upload one leaf, and submit. The AI returns the species, a health status with severity, likely causes, a treatment timeline, and care parameters.',
      },
      {
        q: 'How do I get the most accurate diagnosis?',
        a: 'One leaf filling the frame, in indirect natural light, in focus. Avoid harsh shadows, artificial filters, and whole-room shots. Photos are compressed automatically before analysis.',
      },
      {
        q: 'What exactly comes back in a diagnosis?',
        a: 'Species identification, health status (Healthy / Stressed / Diseased / Infested) with severity 1–5, a diagnosis paragraph, differential diagnoses with confidence, a treatment timeline, step-by-step treatment, watering/light/soil/temperature parameters, and care tips.',
      },
      {
        q: 'The scan is taking a long time. Is that normal?',
        a: 'Expect 15–30 seconds for a scan; the Lab shows the elapsed time counting up while it works, so you can see it is moving. During periods of very high AI demand it can take longer; the app automatically retries across multiple AI models before giving up. If it fails, wait a moment and scan again — your photo is not lost.',
      },
      {
        q: 'The AI said my plant is something unlikely, or failed to identify it.',
        a: 'The AI refuses to invent a species it cannot see clearly. Retake the photo closer and better lit. For rare or variegated cultivars, the species suggestion is a best guess — treat the health assessment as the reliable part.',
      },
      {
        q: 'Do you store my photos?',
        a: 'Photos you attach to plants are uploaded to your account\'s plant records so they display across devices and back up your sanctuary. Scan-only images (identified but not saved as a plant) are processed for the diagnosis.',
      },
    ],
  },
  {
    title: 'PhytoCards, the Vault & Check-ins',
    short: 'Cards & Vault',
    items: [
      {
        q: 'What are PhytoCards?',
        a: 'Every plant you scan earns a collectible card with rarity (common → mythic), stats, level and growth stage. The card is the companion record of that plant\'s life.',
      },
      {
        q: 'How do cards level up?',
        a: 'Check-ins. Each healthy check-in grants XP; enough XP raises the card\'s level and growth stage. Neglect does the opposite.',
      },
      {
        q: 'What are Battle Scars?',
        a: 'If your plant drifts into trouble (an alert) and then recovers to stable, the card records that crisis as a Battle Scar — proof of resilience, capped at the six most recent.',
      },
      {
        q: 'What is a check-in?',
        a: 'A quick record that you visited the plant: its condition, what you changed, optionally a photo. Check-ins drive XP, streaks, and the drift detector that watches for slow decline.',
      },
    ],
  },
  {
    title: 'Market & Payments',
    short: 'Market',
    items: [
      {
        q: 'How does the Garden Market work?',
        a: 'Real gardening products, linked out to the seller. Confirming a claim earns a Seed refund per item, and cart checkout mirrors that flow with a summary before you confirm.',
      },
      {
        q: 'How do I pay for Pro?',
        a: 'Two ways: 1,000 earned Seeds (no money involved), or ₹99/month through secure Razorpay checkout (card, UPI, netbanking). Both grant the same Pro tier.',
      },
      {
        q: 'Is my payment information safe?',
        a: 'Payments are processed by Razorpay on their secure page. The app never sees or stores your card details, and Pro is granted by our server only after Razorpay\'s signed confirmation.',
      },
      {
        q: 'My payment succeeded but Pro did not activate. What now?',
        a: 'Granting is automatic and usually instant. If it has not appeared after a few minutes, sign out and back in to refresh your tier. If it still shows Free, use the Assistant to report it with your payment ID so it can be reconciled.',
      },
      {
        q: 'Where do I find my claim and refund codes?',
        a: 'In the Market\'s Tickets tab. Codes are generated per confirmed order and stay claimable there.',
      },
    ],
  },
  {
    title: 'Account & Profile',
    short: 'Account',
    items: [
      {
        q: 'How do I sign in?',
        a: 'Google one-tap, or email and password. Google is recommended — it is one tap and cannot be forgotten.',
      },
      {
        q: 'I forgot my password.',
        a: 'Use "Forgot password?" on the sign-in screen; a reset link is emailed to you. Note this applies to email accounts — if you originally created an offline local account on an old version, that account lives only on that device and cannot be recovered.',
      },
      {
        q: 'What is the difference between a cloud account and a local account?',
        a: 'Cloud accounts (Google or email) sync plants, Seeds and tier to the server and can sign in on any device. Legacy offline accounts live only in the original device\'s storage. You can migrate a local sanctuary\'s plants to the cloud from Profile → Sync to Cloud.',
      },
      {
        q: 'What happens when I sign out?',
        a: 'Your identity is cleared from the session. Plants and cards stored in this device\'s local database remain here (not on anyone else\'s device), and everything reappears when you sign back in.',
      },
      {
        q: 'Can I use it on more than one device?',
        a: 'Yes with a cloud account — sign in and your plants, Seeds and tier follow you. The local Dexie cache rebuilds on first load.',
      },
    ],
  },
  {
    title: 'Privacy & Data',
    short: 'Privacy',
    items: [
      {
        q: 'What data does the app collect?',
        a: 'Your account identity, the plants and check-ins you create, photos you attach, Seed/economy activity, and anonymous daily usage counters that enforce free-tier AI limits. No advertising trackers.',
      },
      {
        q: 'Who can see my plants and photos?',
        a: 'Only you. Records are protected by per-user database rules; plant photos are stored under your account\'s namespace with unguessable locations.',
      },
      {
        q: 'How do I delete my data?',
        a: 'Removing a plant in the app deletes it and its records. For full account deletion, use the Assistant to request it and the account can be removed server-side.',
      },
      {
        q: 'Are the AI diagnoses medical or professional advice?',
        a: 'No. They are educational plant-care guidance generated from your photo. For valuable or irreplaceable specimens, consult a professional horticulturist for anything beyond routine care.',
      },
    ],
  },
  {
    title: 'Troubleshooting',
    short: 'Troubleshooting',
    items: [
      {
        q: 'The AI says it is busy or unavailable.',
        a: 'The app automatically retries across several AI models. Persistent failures during peak times usually clear within minutes — try again shortly.',
      },
      {
        q: 'Seed changes I made offline disappeared from the queue.',
        a: 'They did not. Changes sync when connectivity returns; if a change cannot ever be applied (for example it would overdraw the server balance), the app drops just that entry and reconciles your balance rather than retrying forever.',
      },
      {
        q: 'The app looks broken or blank.',
        a: 'A safety screen should appear with Reload and Home buttons — use Reload first. If the app ever shows a raw white page, hard-refresh; your local data is not affected by reloads.',
      },
      {
        q: 'Nothing here answers my question.',
        a: 'Use the Assistant for product questions, or reach the developer through the contact links in Privacy and Terms.',
      },
    ],
  },
];

const TOTAL = FAQS.reduce((n, c) => n + c.items.length, 0);

/** Sentinel for "no category chosen" — a title, not an index, so the bar and
 *  the data cannot fall out of step if a category is ever reordered. */
export const ALL_CATEGORIES = 'All';

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Measured at 390px the centre was 3461px — 4.1 phone screens — for 38
  // answers in 8 categories, with no way to reach a category except scrolling
  // or already knowing a word to search for. The category bar below makes each
  // one a tap away.
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  // Category and search compose rather than replace: choosing "Market" and then
  // typing narrows within Market, so a visitor who has half-remembered a
  // category is never stuck with the wrong one.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS
      .filter(c => category === ALL_CATEGORIES || c.title === category)
      .map(c => ({
        title: c.title,
        items: q
          ? c.items.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
          : c.items,
      }))
      .filter(c => c.items.length > 0);
  }, [query, category]);

  const resultCount = filtered.reduce((n, c) => n + c.items.length, 0);

  const toggle = (key: string) => setOpenKey(k => (k === key ? null : key));

  return (
    <div className="min-h-screen px-4 py-10 sm:px-8" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#5A9E6F]/15 text-[#5A9E6F]">
            <HelpCircle size={20} />
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold">Help &amp; FAQ</h1>
        </div>
        <p className="text-sm opacity-70 mb-6">
          Everything about Seeds, scanning, PhytoCards, payments and your data — {TOTAL} answers.
        </p>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the help centre… (e.g. seeds, password, photo)"
            aria-label="Search help articles"
            className="w-full rounded-xl border border-white/15 bg-black/10 px-10 py-3 text-sm outline-none focus:border-[#5A9E6F]/60"
          />
        </div>
        {/* Category bar — the way into a category without scrolling past the
            other seven. Same bazaar-tab idiom as the Market and Profile bars,
            so the app has one tab shape rather than three. */}
        <nav aria-label="Help categories" className="-mx-4 mb-3 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategory(ALL_CATEGORIES)}
              aria-current={category === ALL_CATEGORIES ? 'page' : undefined}
              className={`bazaar-tab shrink-0 ${category === ALL_CATEGORIES ? 'is-on' : ''}`}
            >
              All
            </button>
            {FAQS.map(c => (
              <button
                key={c.title}
                onClick={() => setCategory(c.title)}
                aria-current={category === c.title ? 'page' : undefined}
                className={`bazaar-tab shrink-0 ${category === c.title ? 'is-on' : ''}`}
              >
                {c.short}
              </button>
            ))}
          </div>
        </nav>
        <p className="text-[11px] uppercase tracking-widest opacity-50 mb-6">
          {resultCount} answer{resultCount === 1 ? '' : 's'} {query ? 'matching' : 'available'}
        </p>

        {resultCount === 0 && (
          <div className="rounded-xl border border-white/10 p-6 text-sm opacity-80 mb-6">
            {query ? (
              <>
                Nothing matches “{query}”
                {category !== ALL_CATEGORIES && <> in {category}</>}. Try a broader word
                {category !== ALL_CATEGORIES && (
                  <>
                    , or tap <b className="opacity-100">All</b> to search every category
                  </>
                )}{' '}
                — or ask the Assistant inside the app.
              </>
            ) : (
              'No answers in this category yet.'
            )}
          </div>
        )}

        <div className="space-y-8">
          {filtered.map(cat => (
            <section key={cat.title}>
              <h2 className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-3">{cat.title}</h2>
              <div className="rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
                {cat.items.map(faq => {
                  const key = cat.title + '|' + faq.q;
                  const isOpen = openKey === key;
                  return (
                    <div key={key}>
                      <button
                        onClick={() => toggle(key)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium hover:bg-white/5 transition-colors"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown
                          size={16}
                          className={`shrink-0 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 text-sm leading-relaxed opacity-85">{faq.a}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-[#5A9E6F]/30 bg-[#5A9E6F]/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">New here, or feeling lost?</p>
            <p className="text-xs opacity-70 mt-1">Replay the 60-second guided tour of every feature.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => restartOnboardingTour()}
              className="inline-flex items-center min-h-[44px] gap-2 px-4 py-2.5 rounded-lg bg-[#3E5C3A] hover:bg-[#4a6d46] text-white text-sm font-semibold transition-colors"
            >
              <RefreshCw size={14} /> Replay the tour
            </button>
            <Link to="/" className="inline-flex items-center min-h-[44px] px-4 py-2.5 rounded-lg border border-white/15 text-sm hover:bg-white/5 transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
