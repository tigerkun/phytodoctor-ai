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
            <Route path="/audit" element={<SystemAudit />} />

            {/* Specimen Archives */}
            <Route path="/collection" element={<Vault />} />

            {/* Diagnosis & Treatment */}
            <Route path="/lab" element={<BotanicalLab />} />
            <Route path="/clinic" element={<Clinic />} />
            <Route path="/clinic/case-study" element={<CaseStudy />} />
            <Route path="/assistant" element={<Assistant />} />

            {/* Market & Resources */}
            <Route path="/market" element={<Market />} />

            {/* Knowledge Base */}
            <Route path="/library" element={<Library />} />

            {/* Legal */}
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />

            {/* Specialist Profile */}
            <Route path="/profile" element={<Profile />} />

            {/* Deep-Tissue Specimen Analytics */}
            <Route path="/plant/:id" element={<PlantDetail />} />

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </BrowserRouter>
  );
}
