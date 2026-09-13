import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import Leafify from './components/Leafify';
import RequireAuth from './components/RequireAuth';


/**

 * PhytoDoctor Application Entry

 * Orchestrates the routing architecture and system-wide providers.
 * Optimized for high-fidelity transitions and precise pathing.
 */


export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Layout>
          <Leafify />
          <FloatingAssistant />
          <Routes>




            {/* Authentication */}
            <Route path="/auth" element={<Auth />} />

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
        </Layout>
      </ToastProvider>
    </BrowserRouter>
  );
}
