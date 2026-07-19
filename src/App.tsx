import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import Home from './pages/Home';
import Vault from './pages/Vault';
import Library from './pages/Library';
import Arena from './pages/Arena';
import BotanicalLab from './pages/BotanicalLab';
import Market from './pages/Market';
import Profile from './pages/Profile';
import PlantDetail from './pages/PlantDetail';
import Pedigree from './pages/Pedigree';
import Chat from './pages/Chat';
import Auth from './pages/Auth';
import NotFound from './pages/NotFound';
import { CaseStudy } from './components/CaseStudy';
import SystemAudit from './components/SystemAudit';
import Leafify from './components/Leafify';

/**

 * PhytoGuard Application Entry

 * Orchestrates the routing architecture and system-wide providers.
 * Optimized for high-fidelity transitions and precise pathing.
 */


export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Layout>
          <Leafify />
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
            <Route path="/clinic/case-study" element={<CaseStudy />} />
            
            {/* Market & Resources */}
            <Route path="/market" element={<Market />} />
            
            {/* Knowledge Base */}
            <Route path="/library" element={<Library />} />
            
            {/* Competitive Standings */}
            <Route path="/arena" element={<Arena />} />
            
            {/* Specialized Tracking */}
            <Route path="/pedigree/:id" element={<Pedigree />} />
            
            {/* Specialized Consulting */}
            <Route path="/assistant" element={<Chat />} />
            
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
