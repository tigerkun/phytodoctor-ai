import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import Home from './pages/Home';
import FloatingAssistant from './components/FloatingAssistant';
import RequireAuth from './components/RequireAuth';
import ErrorBoundary from './components/ErrorBoundary';
import OnboardingTour from './components/OnboardingTour';

// Everything past the landing page ships on demand. Auth and Home stay in the
// entry chunk because they are the two routes a first-time visitor hits; the
// rest were previously forcing ~1.5 MB onto every visitor regardless of use.
const Vault = lazy(() => import('./pages/Vault'));
const Library = lazy(() => import('./pages/Library'));
const BotanicalLab = lazy(() => import('./pages/BotanicalLab'));
const Market = lazy(() => import('./pages/Market'));
const Profile = lazy(() => import('./pages/Profile'));
const PlantDetail = lazy(() => import('./pages/PlantDetail'));
const Assistant = lazy(() => import('./pages/Assistant'));
const Auth = lazy(() => import('./pages/Auth'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Clinic = lazy(() => import('./pages/Clinic'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const CaseStudy = lazy(() => import('./components/CaseStudy').then(m => ({ default: m.CaseStudy })));
const SystemAudit = lazy(() => import('./components/SystemAudit'));

function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      className="flex items-center justify-center py-32"
    >
      <div className="w-6 h-6 rounded-full border-2 border-border-light border-t-moss animate-spin" />
    </div>
  );
}


/**

 * PhytoDoctor Application Entry

 * Orchestrates the routing architecture and system-wide providers.
 * Optimized for high-fidelity transitions and precise pathing.
 */


export default function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
      <ToastProvider>
        <ErrorBoundary>
        <Layout>
          <FloatingAssistant />
          <OnboardingTour />
          <RoutedContent />
        </Layout>
        </ErrorBoundary>
      </ToastProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}

function RoutedContent() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [location.pathname, shouldReduceMotion]);

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: 'easeOut' as const };

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={location.pathname}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0 }}
        transition={transition}
        className="min-w-0"
      >
          <Suspense fallback={<RouteFallback />}>
          <Routes location={location}>




            {/* Authentication */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/help" element={<HelpPage />} />

            {/* Main Command Center */}
            <Route path="/" element={<Home />} />
            <Route path="/audit" element={<RequireAuth><SystemAudit /></RequireAuth>} />

            {/* Specimen Archives */}
            <Route path="/collection" element={<RequireAuth><Vault /></RequireAuth>} />

            {/* Diagnosis & Treatment. The Lab is deliberately public: the scan
                is the product, and a visitor gets one before the sign-up. The
                conversion ask lives at the save moment inside BotanicalLab. */}
            <Route path="/lab" element={<BotanicalLab />} />
            <Route path="/clinic" element={<RequireAuth><Clinic /></RequireAuth>} />
            <Route path="/clinic/case-study" element={<RequireAuth><CaseStudy /></RequireAuth>} />
            <Route path="/assistant" element={<RequireAuth><Assistant /></RequireAuth>} />

            {/* Market & Resources */}
            <Route path="/market" element={<RequireAuth><Market /></RequireAuth>} />

            {/* Knowledge Base */}
            <Route path="/library" element={<RequireAuth><Library /></RequireAuth>} />

            {/* Legal */}
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />

            {/* Specialist Profile */}
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

            {/* Deep-Tissue Specimen Analytics */}
            <Route path="/plant/:id" element={<RequireAuth><PlantDetail /></RequireAuth>} />

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
