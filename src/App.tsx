import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import Home from './pages/Home';
import Vault from './pages/Vault';
import Library from './pages/Library';
import BotanicalLab from './pages/BotanicalLab';
import Market from './pages/Market';
import Profile from './pages/Profile';
import PlantDetail from './pages/PlantDetail';
import Assistant from './pages/Assistant';
import FloatingAssistant from './components/FloatingAssistant';
import Auth from './pages/Auth';
import NotFound from './pages/NotFound';
import Clinic from './pages/Clinic';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import { CaseStudy } from './components/CaseStudy';
import SystemAudit from './components/SystemAudit';
import RequireAuth from './components/RequireAuth';
import ErrorBoundary from './components/ErrorBoundary';
import OnboardingTour from './components/OnboardingTour';
import HelpPage from './pages/HelpPage';


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
          <Routes location={location}>




            {/* Authentication */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/help" element={<HelpPage />} />

            {/* Main Command Center */}
            <Route path="/" element={<Home />} />
            <Route path="/audit" element={<RequireAuth><SystemAudit /></RequireAuth>} />

            {/* Specimen Archives */}
            <Route path="/collection" element={<RequireAuth><Vault /></RequireAuth>} />

            {/* Diagnosis & Treatment */}
            <Route path="/lab" element={<RequireAuth><BotanicalLab /></RequireAuth>} />
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
      </motion.div>
    </AnimatePresence>
  );
}
