import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Calendar, ShieldCheck, Activity, AlertCircle, Droplets, Sun, TrendingUp, Sparkles, Box, Camera, Clock, Star, Sprout, Crown, Zap, Plus, Loader2, Book, Bookmark, Send } from 'lucide-react';
import { db, type PlantNote } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import GuardianScoreRing from '../components/GuardianScoreRing';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { GameService } from '../services/gameService';
import { getPlantPhoto } from '../utils/plantImage';
import PageWrapper from '../components/home/PageWrapper';
import { usePageTransition } from '../components/home/PageTransitionContext';
import { useToast } from '../components/Toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as any }
  }
};

export default function PlantDetail() {
  const { id } = useParams();
  const { transitionTo } = usePageTransition();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<'timeline' | 'journal' | 'alerts' | 'notebook'>('timeline');
  const [propagating, setPropagating] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [artStyle, setArtStyle] = useState<'neo' | 'cyber' | 'ink' | 'soft'>('neo');
  const [useHybrid, setUseHybrid] = useState(false);
  const [propCount, setPropCount] = useState(0);
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState<PlantNote['category']>('observation');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PlantNote['category'] | 'all'>('all');

  const plant = useLiveQuery(() => id ? db.plants.get(id) : undefined, [id]);
  const history = useLiveQuery(() => id ? db.checkins.where('plantId').equals(id).sortBy('timestamp') : [], [id]);
  const predictions = useLiveQuery(() => id ? db.predictions.where('plantId').equals(id).sortBy('predictedAt') : [], [id]);
  const notes = useLiveQuery(() => id ? db.notes.where('plantId').equals(id).reverse().sortBy('createdAt') : [], [id]);
  const profile = useLiveQuery(() => GameService.getProfile());

  useEffect(() => {
    const loadProps = async () => {
      const count = await GameService.getPropagationsThisMonth();
      setPropCount(count);
    };
    loadProps();
  }, []);

  const card = useLiveQuery(() => id ? db.cards.where('plantId').equals(id).first() : undefined, [id]);

  if (!plant) return <div className="p-20 text-center font-serif text-2xl">Loading specimen dossier...</div>;

  const handleSynthesizeArt = async () => {
    if (!card) return;
    setSynthesizing(true);
    
    // Simulate AI synthesis by applying a high-quality stylized filter seed based on selected style
    setTimeout(async () => {
       try {
          const styleSeeds = {
            neo: 'vibrant_botanical',
            cyber: 'neon_glitch_plant',
            ink: 'da_vinci_sketch',
            soft: 'ethereal_glow'
          };
          await db.cards.update(card.id, { 
             altArt: `https://picsum.photos/seed/${card.id}_${styleSeeds[artStyle]}/800/1000?blur=1` 
          });
          success(`AI ${artStyle.toUpperCase()} Synthesis Complete: Genetic profile re-mapped into consistent stylized art.`);
       } finally {
          setSynthesizing(false);
       }
    }, 2000);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !id) return;
    
    await db.notes.add({
      id: crypto.randomUUID(),
      plantId: id,
      userId: 'local_user',
      content: newNote,
      category: noteCategory,
      tags: noteTags,
      createdAt: new Date()
    });
    
    setNewNote('');
    setNoteTags([]);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!noteTags.includes(tagInput.trim())) {
        setNoteTags([...noteTags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setNoteTags(noteTags.filter(t => t !== tag));
  };

  const toggleSelectedTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const allTags = Array.from(new Set(notes?.flatMap(n => n.tags || []) || []));

  const filteredNotes = notes?.filter(note => {
    const matchesSearch = note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    const matchesTags = selectedTags.length === 0 || selectedTags.every(t => note.tags?.includes(t));
    return matchesSearch && matchesCategory && matchesTags;
  }) || [];

  const handlePropagate = async () => {
    if (!card) return;
    setPropagating(true);
    try {
      const result = await GameService.propagate(card.id, useHybrid);
      if (result.success) {
        success('Success! A new sprout has been registered in your Vault.');
      } else {
        error('Propagation failed. The genetic lineage was too weak this time.');
      }
      const count = await GameService.getPropagationsThisMonth();
      setPropCount(count);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Propagation failed');
    } finally {
      setPropagating(false);
    }
  };

  const chartData = history?.map(h => ({
    day: h.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: h.guardianScore
  })) || [];

  const propLimit = profile?.tier === 'pro' ? 5 : 1;

  return (
    <PageWrapper className="min-h-screen skin-specimen pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Navigation & Accession Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <button 
            onClick={() => transitionTo('/', 'Home')} 
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-[#c4b193] hover:text-white transition-colors group px-3 py-1.5 rounded-lg bg-black/20 border border-[#c4b193]/20"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform text-[#c5a059]" /> 
            <span>Return to Conservatory Bench</span>
          </button>
          
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-md bg-black/40 border border-[#c5a059]/30 text-[10px] font-mono tracking-widest text-[#d8bc78] shadow-inner">
            <span className="w-2 h-2 rounded-full bg-[#52b788] animate-pulse" />
            <span>ACCESSION FILE #{id ? id.slice(0, 8).toUpperCase() : 'UNKNOWN'} // HERBARIUM DOSSIER</span>
          </div>
        </div>

        {/* Outer Manila Field Binder Cover */}
        <div className="dossier-binder-cover rounded-[2rem] md:rounded-[2.5rem] p-6 sm:p-10 md:p-14 relative shadow-2xl">
          {/* Top Brass Fastener Prongs */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-20 pointer-events-none z-20">
            <div className="w-12 h-6 dossier-prong dossier-prong-left" title="Binder Fastener" />
            <div className="w-12 h-6 dossier-prong dossier-prong-right" title="Binder Fastener" />
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-12"
          >
            {/* Specimen Header & Physical Field Plate */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
              {/* Left Column: Framed Archival Specimen Plate */}
              <div className="lg:col-span-5">
                <div className="dossier-specimen-mat rounded-[1.5rem] p-3 md:p-4 relative group">
                  {/* Brass Photo Corner Mounts */}
                  <div className="photo-corner-mount photo-corner-mount-tl" />
                  <div className="photo-corner-mount photo-corner-mount-tr" />
                  <div className="photo-corner-mount photo-corner-mount-bl" />
                  <div className="photo-corner-mount photo-corner-mount-br" />

                  <div className="relative h-[380px] sm:h-[440px] rounded-[1rem] overflow-hidden bg-[#241d16]">
                    <img 
                      src={getPlantPhoto(plant.photoUrl, plant.species)} 
                      alt={plant.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 filter contrast-[1.02]" 
                      onError={(e) => { (e.target as HTMLImageElement).src = getPlantPhoto(null, plant.species); }} 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a140f]/90 via-transparent to-black/20" />
                    
                    {/* Accession Seal Overlay */}
                    <div className="absolute top-4 left-4">
                      <div className="px-3 py-1.5 bg-[#fbf8f0]/95 backdrop-blur-md rounded-md text-[9px] font-mono uppercase tracking-widest text-[#4a3525] border border-[#c5a059]/50 shadow-md flex items-center gap-1.5">
                        <Calendar size={11} className="text-[#c5a059]" />
                        <span>Acquired: {new Date(plant.acquiredAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Binomial Plate at Bottom */}
                    <div className="absolute bottom-4 left-4 right-4 p-3 bg-[#fdfbf7]/90 backdrop-blur-md rounded-lg border border-[#cbb898] shadow-lg text-center">
                      <p className="text-[11px] font-serif font-black tracking-wide text-[#2e2117] italic">{plant.species}</p>
                      <p className="text-[9px] font-mono uppercase tracking-widest text-[#7c6953]">Living Specimen Herbarium Index</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Specimen Metrics & Workbenches */}
              <div className="lg:col-span-7 space-y-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-[#c5a059]" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#8c7355]">Living Specimen Dossier</span>
                  </div>
                  <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-black text-[#2e2117] tracking-tight mb-2">
                    {plant.name}
                  </h1>
                  <p className="text-xl sm:text-2xl text-[#6b5843] italic font-serif">
                    {plant.species}
                  </p>
                </div>

                {/* Score & Status Plate */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#fbf9f4] p-5 rounded-2xl border-2 border-[#d8ccb8] flex items-center gap-5 shadow-sm">
                    <GuardianScoreRing score={plant.guardianScore} size={72} />
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-widest text-[#8c765c]">Vigor & Stability</p>
                      <p className="text-lg font-serif font-bold text-[#2e2117]">
                        {plant.guardianScore >= 80 ? 'Optimal Vitality' : plant.guardianScore >= 50 ? 'Stable Condition' : 'Requires Attention'}
                      </p>
                      <p className="text-[10px] text-[#7a6855] italic">Score: {plant.guardianScore}/100</p>
                    </div>
                  </div>

                  <div className="bg-[#2a2017] p-5 rounded-2xl border-2 border-[#5a422e] text-[#f7f0e4] flex flex-col justify-center items-start gap-1.5 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-[#c4a574]">Clinical Status</span>
                      <ShieldCheck size={16} className="text-[#52b788]" />
                    </div>
                    <div className="mt-1 px-3 py-1 bg-[#52b788]/20 border border-[#52b788]/50 rounded text-[11px] font-mono font-bold uppercase tracking-wider text-[#7ae0aa]">
                      {plant.status || 'Active Guardian'}
                    </div>
                    <p className="text-[9px] text-[#c4b193]/70 font-mono tracking-wide mt-1">Telemetry synchronized daily</p>
                  </div>
                </div>

                {/* Telemetry Strip */}
                <div className="grid grid-cols-3 gap-3">
                  <DetailStat icon={<Droplets size={16} />} label="Soil Moisture" value={history?.[history.length-1]?.soilMoisture || 'Normal'} />
                  <DetailStat icon={<Sun size={16} />} label="Photoperiod" value={history?.[history.length-1]?.lightLevel || 'Filtered'} />
                  <DetailStat icon={<Clock size={16} />} label="Intake Cycle" value="Daily Review" />
                </div>

                {/* Art Synthesis Station */}
                <div className="p-6 bg-[#f4ece0] rounded-2xl border border-[#cfbe9f] relative overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-[#3d2d1d] flex items-center gap-2">
                      <Sparkles size={14} className="text-[#c5a059]" /> Botanical Camera Lucida (Art Synthesis)
                    </h4>
                    <span className="text-[9px] font-mono text-[#7a654c] uppercase tracking-wider">
                      Neural Stylization
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex bg-[#e8decc] p-1 rounded-xl border border-[#cfbe9f]">
                      {(['neo', 'cyber', 'ink', 'soft'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setArtStyle(s)}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-widest transition-all ${
                            artStyle === s 
                              ? 'bg-[#3d2d1d] text-[#f7f0e4] shadow-sm' 
                              : 'text-[#6b5843] hover:bg-black/5'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={handleSynthesizeArt}
                      disabled={synthesizing || !card}
                      className="px-5 py-2.5 bg-[#3d2d1d] text-[#f7f0e4] rounded-xl font-mono font-bold uppercase tracking-widest text-[10px] shadow hover:bg-[#5a422e] transition-all flex items-center gap-2 disabled:opacity-40"
                    >
                      {synthesizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-[#c5a059]" />}
                      <span>{card?.altArt ? 'Re-Synthesize Plate' : 'Synthesize Card Art'}</span>
                    </button>
                  </div>
                </div>

                {/* Genetic Propagation Bench */}
                <div className="p-6 bg-[#eef4ee] rounded-2xl border border-[#b8d5b8] relative overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-[#1e3f20] flex items-center gap-2">
                      <Sprout size={14} className="text-[#3b7a40]" /> Cutting Cloche & Genetic Propagation
                    </h4>
                    <span className="text-[9px] font-mono text-[#3b7a40] uppercase tracking-wider">
                      Monthly Quota: <strong className={propCount >= propLimit ? 'text-red-600' : ''}>{propCount} / {propLimit}</strong>
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 items-center">
                    <button 
                      onClick={handlePropagate}
                      disabled={propagating || propCount >= propLimit || !card}
                      className="px-5 py-2.5 bg-[#2d5a30] text-white rounded-xl font-mono font-bold uppercase tracking-widest text-[10px] shadow hover:bg-[#1e3f20] transition-all flex items-center gap-2 disabled:opacity-40"
                    >
                      {propagating ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} className="text-yellow-300" />}
                      <span>Propagate Cutting (🌱 500 Seeds)</span>
                    </button>

                    {profile?.tier === 'pro' && (
                      <label className="flex items-center gap-2 cursor-pointer select-none bg-white/70 px-3 py-2 rounded-xl border border-[#b8d5b8]">
                        <input 
                          type="checkbox" 
                          checked={useHybrid} 
                          onChange={(e) => setUseHybrid(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-[#3b7a40] text-[#2d5a30] focus:ring-[#2d5a30]"
                        />
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#1e3f20] flex items-center gap-1">
                          <Crown size={11} className="text-amber-500" /> Hybrid Mode Enabled
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Folder Index Tabs (Protruding Manila Dividers) */}
            <motion.div variants={itemVariants} className="pt-6">
              <div className="flex flex-wrap gap-2 border-b-2 border-[#b8a27e] mb-8">
                <button 
                  onClick={() => setActiveTab('timeline')} 
                  className={`dossier-tab-button px-5 py-3 text-[11px] font-mono uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === 'timeline' ? 'active' : ''
                  }`}
                >
                  <TrendingUp size={14} className={activeTab === 'timeline' ? 'text-[#c5a059]' : 'opacity-60'} />
                  <span>01 Health Timeline</span>
                </button>

                <button 
                  onClick={() => setActiveTab('journal')} 
                  className={`dossier-tab-button px-5 py-3 text-[11px] font-mono uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === 'journal' ? 'active' : ''
                  }`}
                >
                  <Camera size={14} className={activeTab === 'journal' ? 'text-[#c5a059]' : 'opacity-60'} />
                  <span>02 Photo Records</span>
                </button>

                <button 
                  onClick={() => setActiveTab('notebook')} 
                  className={`dossier-tab-button px-5 py-3 text-[11px] font-mono uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === 'notebook' ? 'active' : ''
                  }`}
                >
                  <Book size={14} className={activeTab === 'notebook' ? 'text-[#c5a059]' : 'opacity-60'} />
                  <span>03 Field Notebook</span>
                </button>

                <button 
                  onClick={() => setActiveTab('alerts')} 
                  className={`dossier-tab-button px-5 py-3 text-[11px] font-mono uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === 'alerts' ? 'active' : ''
                  }`}
                >
                  <AlertCircle size={14} className={activeTab === 'alerts' ? 'text-[#c5a059]' : 'opacity-60'} />
                  <span>04 Diagnostic Alerts</span>
                </button>
              </div>

              {/* Tab Contents */}
              <AnimatePresence mode="wait">
                {/* 01 Health Timeline */}
                {activeTab === 'timeline' && (
                  <motion.div 
                    key="timeline"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="bg-[#fcfaf5] p-6 sm:p-10 rounded-2xl border-2 border-[#dcd0bd] shadow-md space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4d7c3] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#52b788]" />
                        <h3 className="font-serif font-bold text-lg text-[#2e2117]">Physiological Recovery & Score Telemetry</h3>
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-[#8c765c]">
                        Plot: 30-Day Chronological Check-Ins
                      </span>
                    </div>

                    <div className="h-[320px] sm:h-[380px] w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#52b788" stopOpacity={0.35}/>
                              <stop offset="95%" stopColor="#52b788" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dcd0bd" />
                          <XAxis 
                            dataKey="day" 
                            axisLine={{ stroke: '#b8a27e' }} 
                            tickLine={{ stroke: '#b8a27e' }} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#7c6953', fontFamily: 'monospace' }} 
                          />
                          <YAxis 
                            domain={[0, 100]} 
                            axisLine={{ stroke: '#b8a27e' }} 
                            tickLine={{ stroke: '#b8a27e' }} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#7c6953', fontFamily: 'monospace' }} 
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#2e2117', 
                              borderRadius: '8px', 
                              border: '1px solid #c5a059', 
                              color: '#fdfbf7',
                              fontSize: '11px',
                              fontFamily: 'monospace'
                            }} 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#34784d" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorScore)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )}

                {/* 02 Photo Records */}
                {activeTab === 'journal' && (
                  <motion.div 
                    key="journal"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6"
                  >
                    {history?.filter(h => h.photoUrl).map((h, i) => (
                      <div key={h.id || i} className="bg-[#fdfbf7] p-3 rounded-xl border-2 border-[#dcd0bd] shadow-sm relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-black/10 relative">
                          <img 
                            src={getPlantPhoto(h.photoUrl, plant.species)} 
                            alt="checkin" 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[9px] font-mono uppercase tracking-widest text-white px-2 py-1 bg-black/60 rounded">
                              Score: {h.guardianScore}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          <span className="text-[10px] font-mono text-[#6b5843] uppercase tracking-wider block">
                            {h.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {(!history || history.filter(h => h.photoUrl).length === 0) && (
                      <div className="col-span-full py-16 text-center bg-[#fcfaf5] rounded-2xl border-2 border-dashed border-[#dcd0bd]">
                        <Camera size={36} className="mx-auto mb-3 text-[#b8a27e] opacity-40" />
                        <p className="text-xs font-mono uppercase tracking-widest text-[#8c765c]">No photographic specimen records on file</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 03 Field Notebook */}
                {activeTab === 'notebook' && (
                  <motion.div 
                    key="notebook"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="space-y-8"
                  >
                    {/* Search & Filter Bar */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-[#fbf9f4] p-4 sm:p-6 rounded-2xl border border-[#dcd0bd]">
                      <div className="relative w-full sm:w-80">
                        <Box className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a89578]" size={16} />
                        <input 
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search field notes..."
                          className="w-full pl-11 pr-4 py-2.5 bg-white rounded-xl border border-[#dcd0bd] text-[#2e2117] placeholder:text-[#a89578] focus:outline-none focus:ring-2 focus:ring-[#c5a059]/40 text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 items-center">
                        <select 
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value as any)}
                          className="px-3 py-2 bg-white rounded-xl border border-[#dcd0bd] text-[#2e2117] text-[10px] font-mono font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#c5a059]/40"
                        >
                          <option value="all">All Archetypes</option>
                          <option value="observation">Observation</option>
                          <option value="action">Action Taken</option>
                          <option value="milestone">Milestone</option>
                        </select>
                        
                        <div className="flex gap-1.5">
                          {allTags.slice(0, 4).map(tag => (
                            <button
                              key={tag}
                              onClick={() => toggleSelectedTag(tag)}
                              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all ${
                                selectedTags.includes(tag) 
                                  ? 'bg-[#2e2117] text-[#f7f0e4]' 
                                  : 'bg-white text-[#6b5843] hover:bg-[#f4ece0] border border-[#dcd0bd]'
                              }`}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Add Note Entry Card */}
                    <div className="dossier-notebook-ruled p-6 sm:p-8 rounded-2xl shadow-sm space-y-6">
                      <div className="flex items-center gap-3 border-b border-[#e4d7c3] pb-3">
                        <div className="w-8 h-8 rounded-lg bg-[#c5a059]/20 text-[#8c7234] flex items-center justify-center">
                          <Plus size={18} />
                        </div>
                        <div>
                          <h3 className="font-serif text-xl font-bold text-[#2e2117]">Record Naturalist Observation</h3>
                          <p className="text-[10px] font-mono text-[#7c6953] uppercase tracking-wider">Field Log / Soil & Foliage Telemetry</p>
                        </div>
                      </div>

                      <textarea 
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Log observations, feeding regimens, pruning cuts, or fenestrations..."
                        className="w-full p-4 bg-white/80 rounded-xl border border-[#dcd0bd] text-[#2e2117] placeholder:text-[#a89578] focus:outline-none focus:ring-2 focus:ring-[#c5a059]/40 min-h-[120px] text-sm leading-relaxed"
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                          <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#7c6953]">Archetype Stamp</label>
                          <div className="flex gap-2">
                            {(['observation', 'action', 'milestone'] as const).map(cat => (
                              <button 
                                key={cat}
                                onClick={() => setNoteCategory(cat)}
                                className={`archetype-stamp transition-all ${
                                  noteCategory === cat ? `is-${cat} ring-2 ring-current` : 'opacity-50 hover:opacity-100'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#7c6953]">Taxonomic Tags (Enter to add)</label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={handleAddTag}
                              placeholder="e.g. repotted, growth..."
                              className="w-full px-3 py-1.5 bg-white/80 rounded-lg border border-[#dcd0bd] text-xs font-mono focus:outline-none"
                            />
                          </div>
                          {noteTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {noteTags.map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-[#2e2117]/10 rounded text-[9px] font-mono font-bold flex items-center gap-1 text-[#2e2117]">
                                  #{tag}
                                  <button onClick={() => removeTag(tag)} className="hover:text-red-500 font-bold">×</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button 
                          onClick={handleAddNote}
                          disabled={!newNote.trim()}
                          className="px-6 py-3 bg-[#2e2117] text-[#f7f0e4] rounded-xl font-mono font-bold uppercase tracking-widest text-[10px] shadow hover:bg-[#4a3825] transition-all flex items-center gap-2 disabled:opacity-40"
                        >
                          <Send size={13} className="text-[#c5a059]" />
                          <span>Affix Entry to Dossier</span>
                        </button>
                      </div>
                    </div>

                    {/* Archived Notes List */}
                    <div className="space-y-4">
                      {filteredNotes.map(note => (
                        <motion.div 
                          key={note.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-[#fdfbf7] p-5 sm:p-6 rounded-2xl border-2 border-[#dcd0bd] shadow-sm flex flex-col gap-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8decb] pb-2">
                            <div className="flex items-center gap-2">
                              <span className={`archetype-stamp is-${note.category}`}>
                                {note.category}
                              </span>
                              <span className="text-[10px] font-mono text-[#8c765c]">
                                {note.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>

                            {note.tags && note.tags.length > 0 && (
                              <div className="flex gap-1.5">
                                {note.tags.map(t => (
                                  <span key={t} className="text-[9px] font-mono text-[#8c765c]">#{t}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          <p className="text-[#2e2117] font-serif text-base sm:text-lg leading-relaxed italic">
                            "{note.content}"
                          </p>
                        </motion.div>
                      ))}

                      {filteredNotes.length === 0 && (
                        <div className="py-16 text-center bg-[#fcfaf5] rounded-2xl border-2 border-dashed border-[#dcd0bd]">
                          <Book size={32} className="mx-auto mb-2 text-[#b8a27e] opacity-40" />
                          <p className="text-xs font-mono uppercase tracking-widest text-[#8c765c]">No matching dossier entries found</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 04 Diagnostic Alerts */}
                {activeTab === 'alerts' && (
                  <motion.div 
                    key="alerts"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="space-y-4"
                  >
                    {predictions?.filter(a => a.triggeredAlert).map((alert, i) => (
                      <div key={alert.id || i} className="bg-[#fff9f0] p-6 rounded-2xl border-2 border-[#f0c890] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-500/20 text-amber-800 rounded-xl flex items-center justify-center flex-shrink-0">
                            <AlertCircle size={22} />
                          </div>
                          <div>
                            <h4 className="font-serif text-lg font-bold text-[#3d2a1c]">Clinical Stress Alert: {alert.primaryStressor}</h4>
                            <p className="text-xs text-[#7c6953] italic">Outcome Assessment: {alert.outcome}</p>
                          </div>
                        </div>

                        <div className="px-4 py-1.5 bg-[#f5e6d0] border border-[#e0c098] rounded-md text-[10px] font-mono font-bold uppercase tracking-wider text-[#6a4825]">
                          Risk Factor: {alert.riskScore}%
                        </div>
                      </div>
                    ))}

                    {(!predictions || predictions.filter(a => a.triggeredAlert).length === 0) && (
                      <div className="py-16 text-center bg-[#fcfaf5] rounded-2xl border-2 border-dashed border-[#dcd0bd]">
                        <ShieldCheck size={36} className="mx-auto mb-2 text-[#52b788]" />
                        <p className="text-xs font-mono uppercase tracking-widest text-[#52b788]">Dossier Clear · Zero Active Clinical Alerts</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Field Deed & Dispatch Actions */}
            <motion.div variants={itemVariants} className="bg-[#241a12] p-8 sm:p-12 rounded-[2rem] border-2 border-[#4a3828] text-[#f7f0e4] relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <Sprout size={200} />
              </div>

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-8 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#c5a059]/20 border border-[#c5a059]/40 text-[#e4caa0] text-[9px] font-mono tracking-widest uppercase">
                    <span>Archival Recommendation</span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold leading-snug">
                    Specimen Preservation & <span className="text-[#c5a059] italic">Naturalist Lineage</span>
                  </h2>
                  <p className="text-[#d8cdbd] text-sm sm:text-base leading-relaxed max-w-2xl font-serif">
                    Guardian score of {plant.guardianScore} marks this specimen in the upper percentile of recorded {plant.species} cultivars. Continue daily telemetry logging to maintain vigor.
                  </p>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button 
                      onClick={() => transitionTo(`/assistant?plantName=${encodeURIComponent(plant.name)}&species=${encodeURIComponent(plant.species)}`, 'AI Assistant')}
                      className="px-6 py-3 bg-[#c5a059] text-[#241a12] font-mono font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-[#deb66c] transition-colors flex items-center gap-2 shadow-md"
                    >
                      <span>💬 Consult Chief Botanist</span>
                    </button>
                    <button 
                      onClick={() => transitionTo(`/pedigree/${plant.id}`, 'Specimen Lineage')}
                      className="px-6 py-3 bg-white/10 text-[#f7f0e4] font-mono font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/20 transition-colors border border-white/10"
                    >
                      <span>View Family Pedigree</span>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-black/30 backdrop-blur-sm p-6 rounded-xl border border-white/10 space-y-3 font-mono text-[10px]">
                  <p className="text-[#c5a059] font-bold uppercase tracking-wider">Specimen Telemetry Stamp</p>
                  <div className="space-y-2 text-[#d4c7b5]">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span>Neural Stability</span>
                      <span className="text-[#52b788] font-bold">OPTIMAL</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span>Genomic Lineage</span>
                      <span className="text-[#52b788] font-bold">VERIFIED</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span>Vitality Vector</span>
                      <span className="text-[#52b788] font-bold">ASCENDING</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Archival Deed</span>
                      <span className="text-[#c5a059] font-bold">SEALED</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </PageWrapper>
  );
}

function DetailStat({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="bg-[#fbf9f4] p-4 rounded-xl border-2 border-[#dcd0bd] shadow-sm">
      <div className="text-[#8c7234] mb-2">{icon}</div>
      <p className="text-[8px] font-mono uppercase tracking-widest text-[#8c765c] mb-0.5">{label}</p>
      <p className="text-sm sm:text-base font-serif font-bold text-[#2e2117] truncate">{value}</p>
    </div>
  );
}

