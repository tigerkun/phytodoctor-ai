import React from 'react';
import { ShieldCheck } from 'lucide-react';
import PageWrapper from '../components/home/PageWrapper';

export default function Privacy() {
  return (
    <PageWrapper className="min-h-screen px-4 sm:px-6 md:px-10 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck size={28} className="text-moss" />
          <h1 className="font-serif text-4xl font-bold text-text-bark">Privacy Policy</h1>
        </div>
        <p className="text-xs uppercase tracking-widest text-text-stone mb-8">Last updated: September 2026 · PhytoDoctor AI</p>

        <div className="space-y-6 text-sm leading-relaxed text-text-stone font-sans">
          <section>
            <h2 className="font-serif text-xl font-bold text-text-bark mb-2">What we store, and where</h2>
            <p>
              PhytoDoctor AI is local-first. Your plant records, diagnosis history, seeds, streaks, and market activity
              are stored <strong>on your device</strong> (IndexedDB and localStorage in your browser). We do not operate a
              user database of plant records. If you sign in with Supabase (when enabled), your account email and
              authentication are handled by Supabase under <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" className="text-moss underline">Supabase's privacy policy</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold text-text-bark mb-2">Plant photos and AI analysis</h2>
            <p>
              When you scan a plant, the photo is sent to our server and forwarded to the Google Gemini API solely to
              produce your diagnosis. Photos are used to answer your request and are not sold, shared, or used for
              advertising. Location data (city or coordinates) is optional and only attached to a scan to personalise
              climate advice; you can decline the permission and type a city instead.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold text-text-bark mb-2">What we collect implicitly</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Approximate IP address, for rate limiting and abuse prevention.</li>
              <li>Aggregate API usage counts (e.g. how many diagnoses were requested), to keep the service free and stable.</li>
              <li>Weather lookups for your chosen city, via a third-party weather API, to power care guidance.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold text-text-bark mb-2">The Garden Market</h2>
            <p>
              Market purchases happen on Amazon. We are a participant in the Amazon Associates programme and earn a
              commission from qualifying purchases made through stall links. Seed discounts are in-app records only —
              seeds are not cash and never leave the app. We receive no payment data; Amazon's own privacy policy
              governs checkout.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold text-text-bark mb-2">Your controls</h2>
            <p>
              Because your data lives on your device, you can erase everything at any time by signing out and clearing
              the site's browser data (or uninstalling the installed PWA). Email us at
              <span className="text-text-bark font-bold"> privacy@phytodoctor.app </span>
              for any privacy question.
            </p>
          </section>
        </div>
      </div>
    </PageWrapper>
  );
}
