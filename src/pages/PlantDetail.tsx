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
    <PageWrapper className="max-w-7xl mx-auto px-6 py-12">
      <button 
        onClick={() => transitionTo('/', 'Home')} 
        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-garden-earth/40 hover:text-garden-sage mb-12 transition-colors group"
      >
         <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Guardian Home
      </button>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-16"
      >
        {/* Header Section */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
           <div className="relative h-[500px] rounded-[4rem] overflow-hidden group shadow-2xl shadow-garden-earth/20 border border-garden-olive/10">
              <img src={getPlantPhoto(plant.photoUrl, plant.species)} alt={plant.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" onError={(e) => { (e.target as HTMLImageElement).src = getPlantPhoto(null, plant.species); }} />
              <div className="absolute inset-0 bg-gradient-to-t from-garden-earth/80 via-transparent to-transparent" />
              <div className="absolute top-8 left-8">
                 <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/20">
                    Acquired: {new Date(plant.acquiredAt).toLocaleDateString()}
                 </div>
              </div>
           </div>

           <div className="space-y-10">
              <div>
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] text-garden-sage mb-2 block">Specimen Profile</span>
                 <h1 className="font-serif text-6xl font-bold text-garden-earth mb-4">{plant.name}</h1>
                 <p className="text-2xl text-garden-sage italic font-medium">{plant.species}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div className="bg-white p-8 rounded-[2.5rem] border border-garden-olive/10 flex items-center gap-6 shadow-xl shadow-garden-earth/5">
                    <GuardianScoreRing score={plant.guardianScore} size={80} />
                    <div>
                       <p className="text-[8px] font-black uppercase tracking-widest text-garden-earth/30">Stability</p>
                       <p className="text-xl font-black text-garden-earth">Optimized</p>
                    </div>
                 </div>
                 <div className="bg-garden-earth p-8 rounded-[2.5rem] text-white flex flex-col justify-center items-center gap-2">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Status Badge</span>
                    <div className="px-4 py-1 bg-garden-sage rounded-full text-[10px] font-black uppercase tracking-widest">
                       {plant.status}
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                 <DetailStat icon={<Droplets size={16} />} label="Hydration" value={history?.[history.length-1]?.soilMoisture || 'N/A'} />
                 <DetailStat icon={<Sun size={16} />} label="Light Lux" value={history?.[history.length-1]?.lightLevel || 'N/A'} />
                 <DetailStat icon={<Clock size={16} />} label="Check-In" value="Daily" />
              </div>

              {/* Art Synthesis Lab */}
               <div className="p-8 bg-garden-earth/5 rounded-[3rem] border border-garden-earth/10 relative overflow-hidden group mb-8">
                  <div className="absolute top-0 right-0 p-8 opacity-5 -translate-y-4 group-hover:scale-110 transition-transform">
                     <Sparkles size={80} className="text-garden-earth" />
                  </div>
                  <div className="relative z-10">
                     <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-black uppercase tracking-widest text-garden-earth flex items-center gap-2">
                           <Sparkles size={16} /> Art Synthesis Lab
                        </h4>
                        <span className="text-[10px] font-bold text-garden-earth/60 uppercase tracking-widest text-right">
                           Neural Generative Re-mapping
                        </span>
                     </div>
                     
                     <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex bg-white/10 p-1 rounded-xl border border-white/10">
                           {(['neo', 'cyber', 'ink', 'soft'] as const).map(s => (
                             <button
                               key={s}
                               onClick={() => setArtStyle(s)}
                               className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                                 artStyle === s ? 'bg-garden-earth text-white' : 'text-garden-earth/40 hover:bg-white/10'
                               }`}
                             >
                               {s}
                             </button>
                           ))}
                        </div>
                        <button 
                          onClick={handleSynthesizeArt}
                          disabled={synthesizing || !card}
                          className="px-8 py-4 bg-garden-earth text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-garden-earth/20 hover:bg-garden-olive transition-all flex items-center gap-2 disabled:opacity-30"
                        >
                          {synthesizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          {card?.altArt ? 'Re-Synthesize Image' : 'Synthesize Card Art'}
                        </button>
                        <p className="max-w-[250px] text-[8px] font-bold text-garden-earth/40 italic leading-tight uppercase tracking-tighter">
                           Process: Photo-to-Art re-mapping via local node.
                        </p>
                     </div>
                  </div>
               </div>

               {/* Propagation Widget */}
              <div className="p-8 bg-garden-sage/5 rounded-[3rem] border border-garden-sage/10 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5 -translate-y-4 group-hover:scale-110 transition-transform">
                    <Plus size={80} className="text-garden-sage" />
                 </div>
                 <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                       <h4 className="text-sm font-black uppercase tracking-widest text-garden-sage flex items-center gap-2">
                          <Sprout size={16} /> Genetic Propagation
                       </h4>
                       <span className="text-[10px] font-bold text-garden-sage/60 uppercase tracking-widest">
                          Monthly Use: <span className={propCount >= propLimit ? 'text-red-500' : ''}>{propCount} / {propLimit}</span>
                       </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 items-center">
                       <button 
                         onClick={handlePropagate}
                         disabled={propagating || propCount >= propLimit || !card}
                         className="px-8 py-4 bg-garden-sage text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-garden-sage/20 hover:bg-garden-olive transition-all flex items-center gap-2 disabled:opacity-30"
                       >
                         {propagating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                         Start Cutting (🌱 500)
                       </button>

                       {profile?.tier === 'pro' && (
                         <label className="flex items-center gap-2 cursor-pointer group">
                           <input 
                             type="checkbox" 
                             checked={useHybrid} 
                             onChange={(e) => setUseHybrid(e.target.checked)}
                             className="w-4 h-4 rounded border-garden-sage/30 text-garden-sage focus:ring-garden-sage"
                           />
                           <span className="text-[10px] font-black uppercase tracking-widest text-garden-sage/60 flex items-center gap-1 group-hover:text-garden-sage transition-colors">
                             <Crown size={12} className="text-yellow-400" /> Hybrid Mode
                           </span>
                         </label>
                       )}
                    </div>
                 </div>
              </div>
           </div>
        </motion.div>

        {/* longitudinal tabs */}
        <motion.div variants={itemVariants}>
           <div className="flex gap-4 border-b border-garden-olive/10 mb-12">
              <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} label="Health Timeline" icon={<TrendingUp size={14} />} />
              <TabButton active={activeTab === 'journal'} onClick={() => setActiveTab('journal')} label="Photo Journal" icon={<Camera size={14} />} />
              <TabButton active={activeTab === 'notebook'} onClick={() => setActiveTab('notebook')} label="Notebook" icon={<Book size={14} />} />
              <TabButton active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} label="Alert History" icon={<AlertCircle size={14} />} />
           </div>

           <AnimatePresence mode="wait">
              {activeTab === 'timeline' && (
                <motion.div 
                  key="timeline"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white p-12 rounded-[4rem] border border-garden-olive/10 shadow-xl shadow-garden-earth/5 h-[400px]"
                >
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--moss-light)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--moss-light)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                        <XAxis 
                          dataKey="day" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontWeight: 900, fill: 'var(--text-stone)' }} 
                        />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'var(--moss-dark)', 
                            borderRadius: '16px', 
                            border: 'none', 
                            color: 'var(--text-inverse)',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="score" 
                          stroke="var(--moss)" 
                          strokeWidth={4}
                          fillOpacity={1} 
                          fill="url(#colorScore)" 
                        />
                      </AreaChart>
                   </ResponsiveContainer>
                </motion.div>
              )}

              {activeTab === 'journal' && (
                <motion.div 
                  key="journal"
                  className="grid grid-cols-2 md:grid-cols-4 gap-6"
                >
                   {history?.filter(h => h.photoUrl).map(h => (
                     <div key={h.id} className="aspect-square bg-white rounded-[2rem] border border-garden-olive/10 overflow-hidden relative group">
                        <img src={getPlantPhoto(h.photoUrl, plant.species)} alt="checkin" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        <div className="absolute inset-0 bg-garden-earth/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <span className="text-[10px] font-black uppercase tracking-widest text-white">{h.timestamp.toLocaleDateString()}</span>
                        </div>
                     </div>
                   ))}
                   {(!history || history.filter(h => h.photoUrl).length === 0) && (
                     <div className="col-span-full py-20 text-center text-[10px] font-black uppercase tracking-widest text-garden-earth/20">No photo records found</div>
                   )}
                </motion.div>
              )}

              {activeTab === 'notebook' && (
                <motion.div 
                  key="notebook"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-12"
                >
                   {/* Search & Filter Bar */}
                   <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-garden-cream/20 p-8 rounded-[2.5rem] border border-garden-olive/10">
                      <div className="relative w-full md:w-96 group">
                         <Box className="absolute left-6 top-1/2 -translate-y-1/2 text-garden-earth/30 group-focus-within:text-garden-sage transition-colors" size={18} />
                         <input 
                           type="text"
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           placeholder="Search observations..."
                           className="w-full pl-16 pr-6 py-4 bg-white rounded-2xl border border-garden-olive/10 text-garden-earth placeholder:text-garden-earth/20 focus:outline-none focus:ring-2 focus:ring-garden-sage/20 text-sm"
                         />
                      </div>

                      <div className="flex flex-wrap gap-3">
                         <select 
                           value={selectedCategory}
                           onChange={(e) => setSelectedCategory(e.target.value as any)}
                           className="px-6 py-4 bg-white rounded-2xl border border-garden-olive/10 text-garden-earth text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-garden-sage/20"
                         >
                            <option value="all">All Categories</option>
                            <option value="observation">Observations</option>
                            <option value="action">Actions</option>
                            <option value="milestone">Milestones</option>
                         </select>
                         
                         <div className="flex gap-2">
                           {allTags.slice(0, 3).map(tag => (
                             <button
                               key={tag}
                               onClick={() => toggleSelectedTag(tag)}
                               className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                                 selectedTags.includes(tag) 
                                 ? 'bg-garden-sage text-white' 
                                 : 'bg-white text-garden-earth/40 hover:bg-garden-cream border border-garden-olive/10'
                               }`}
                             >
                               #{tag}
                             </button>
                           ))}
                         </div>
                      </div>
                   </div>

                   {/* Add Note Card */}
                   <div className="bg-white p-8 md:p-12 rounded-[4rem] border border-garden-olive/10 shadow-2xl shadow-garden-earth/5">
                      <div className="flex items-center gap-6 mb-10">
                         <div className="w-14 h-14 bg-garden-sage/10 text-garden-sage rounded-[1.5rem] flex items-center justify-center">
                            <Plus size={28} />
                         </div>
                         <div>
                            <h3 className="font-serif text-3xl font-bold text-garden-earth">Add Gardener's Entry</h3>
                            <p className="text-sm text-garden-sage italic">Record growth patterns and maintenance actions</p>
                         </div>
                      </div>
                      
                      <div className="space-y-8">
                         <textarea 
                           value={newNote}
                           onChange={(e) => setNewNote(e.target.value)}
                           placeholder="What's happening with this specimen today?"
                           className="w-full p-8 bg-garden-cream/20 rounded-[2rem] border border-garden-olive/10 text-garden-earth placeholder:text-garden-earth/20 focus:outline-none focus:ring-2 focus:ring-garden-sage/20 min-h-[160px] text-lg font-medium leading-relaxed"
                         />
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                               <label className="text-[10px] font-black uppercase tracking-[0.2em] text-garden-earth/30 ml-2">Note Archetype</label>
                               <div className="flex gap-3">
                                  {(['observation', 'action', 'milestone'] as const).map(cat => (
                                    <button 
                                      key={cat}
                                      onClick={() => setNoteCategory(cat)}
                                      className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all scale-95 hover:scale-100 ${
                                        noteCategory === cat 
                                        ? 'bg-garden-earth text-white shadow-xl shadow-garden-earth/20' 
                                        : 'bg-garden-cream/40 text-garden-earth/40 hover:bg-garden-cream/60'
                                      }`}
                                    >
                                      {cat}
                                    </button>
                                  ))}
                               </div>
                            </div>

                            <div className="space-y-4">
                               <label className="text-[10px] font-black uppercase tracking-[0.2em] text-garden-earth/30 ml-2">Genetic Tags (Press Enter)</label>
                               <div className="space-y-3">
                                  <input 
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleAddTag}
                                    placeholder="Add tags (e.g. variegated, new_leaf)..."
                                    className="w-full px-6 py-3 bg-garden-cream/20 rounded-xl border border-garden-olive/10 text-sm focus:outline-none focus:ring-2 focus:ring-garden-sage/20"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                     {noteTags.map(tag => (
                                       <span key={tag} className="px-3 py-1 bg-garden-sage/10 text-garden-sage rounded-lg text-[10px] font-bold flex items-center gap-2 group">
                                          #{tag}
                                          <button onClick={() => removeTag(tag)} className="hover:text-red-500">×</button>
                                       </span>
                                     ))}
                                  </div>
                               </div>
                            </div>
                         </div>
                         
                         <div className="pt-4 flex justify-end">
                            <button 
                              onClick={handleAddNote}
                              disabled={!newNote.trim()}
                              className="px-12 py-5 bg-garden-sage text-white rounded-[2rem] font-black uppercase tracking-widest text-[12px] shadow-2xl shadow-garden-sage/30 hover:bg-garden-olive hover:-translate-y-1 active:translate-y-0 transition-all flex items-center gap-3 disabled:opacity-30 disabled:translate-y-0"
                            >
                              <Send size={18} /> Transmit Entry to Neural Log
                            </button>
                         </div>
                      </div>
                   </div>

                   {/* Note List */}
                   <div className="space-y-6">
                      <div className="flex items-center gap-4 px-8">
                         <div className="h-[1px] flex-grow bg-garden-olive/10" />
                         <span className="text-[10px] font-black uppercase tracking-[0.4em] text-garden-earth/20">Archived Specimen Intelligence</span>
                         <div className="h-[1px] flex-grow bg-garden-olive/10" />
                      </div>

                      {filteredNotes.map(note => (
                        <motion.div 
                          key={note.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white p-10 rounded-[3rem] border border-garden-olive/10 flex gap-8 items-start hover:shadow-2xl hover:shadow-garden-earth/5 transition-all group"
                        >
                           <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${
                             note.category === 'observation' ? 'bg-blue-50 text-blue-500 shadow-lg shadow-blue-500/10' :
                             note.category === 'action' ? 'bg-orange-50 text-orange-500 shadow-lg shadow-orange-500/10' :
                             'bg-purple-50 text-purple-500 shadow-lg shadow-purple-500/10'
                           }`}>
                              {note.category === 'observation' && <Activity size={28} />}
                              {note.category === 'action' && <Zap size={28} />}
                              {note.category === 'milestone' && <Bookmark size={28} />}
                           </div>
                           
                           <div className="flex-grow">
                              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                 <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-garden-earth/40 bg-garden-cream/50 px-3 py-1 rounded-full">
                                       {note.createdAt.toLocaleDateString()}
                                    </span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                      note.category === 'observation' ? 'bg-blue-50 text-blue-500' :
                                      note.category === 'action' ? 'bg-orange-50 text-orange-500' :
                                      'bg-purple-50 text-purple-500'
                                    }`}>
                                      {note.category}
                                    </span>
                                 </div>
                                 <div className="flex gap-2">
                                    {note.tags?.map(tag => (
                                      <span key={tag} className="text-[8px] font-black uppercase tracking-widest text-garden-earth/30">#{tag}</span>
                                    ))}
                                 </div>
                              </div>
                              <p className="text-garden-earth text-lg font-medium leading-relaxed italic">"{note.content}"</p>
                           </div>
                        </motion.div>
                      ))}
                      
                      {filteredNotes.length === 0 && (
                        <div className="py-32 text-center space-y-4">
                           <div className="w-20 h-20 bg-garden-cream rounded-[2.5rem] flex items-center justify-center mx-auto opacity-30">
                              <Book size={40} className="text-garden-earth" />
                           </div>
                           <p className="text-[12px] font-black uppercase tracking-[0.4em] text-garden-earth/20 italic">No matching intelligence found</p>
                        </div>
                      )}
                   </div>
                </motion.div>
              )}

              {activeTab === 'alerts' && (
                <motion.div 
                  key="alerts"
                  className="space-y-6"
                >
                   {predictions?.filter(a => a.triggeredAlert).map(alert => (
                     <div key={alert.id} className="bg-white p-8 rounded-[3rem] border border-garden-olive/10 shadow-xl shadow-garden-earth/5 flex justify-between items-center">
                        <div className="flex items-center gap-6">
                           <div className="w-16 h-16 bg-garden-amber/10 text-garden-amber rounded-[1.5rem] flex items-center justify-center">
                              <AlertCircle size={24} />
                           </div>
                           <div>
                              <h4 className="font-serif text-2xl font-bold text-garden-earth">Predicted Stress: {alert.primaryStressor}</h4>
                              <p className="text-sm text-garden-slate italic">Status: {alert.outcome}</p>
                           </div>
                        </div>
                        <div className="px-6 py-2 bg-garden-cream rounded-full text-[10px] font-black uppercase tracking-widest text-garden-earth/40">
                           Probability: {alert.riskScore}%
                        </div>
                     </div>
                   ))}
                   {(!predictions || predictions.filter(a => a.triggeredAlert).length === 0) && (
                     <div className="py-20 text-center text-[10px] font-black uppercase tracking-widest text-garden-earth/20">Clear clinical history</div>
                   )}
                </motion.div>
              )}
           </AnimatePresence>
        </motion.div>

        {/* Global Insight Section */}
        <motion.div variants={itemVariants} className="p-12 md:p-20 bg-garden-earth rounded-[5rem] text-white flex flex-col md:flex-row items-center gap-20 relative overflow-hidden group">
           <div className="absolute bottom-0 right-0 p-12 opacity-10 rotate-12 transition-transform group-hover:scale-110">
              <Sprout size={240} />
           </div>
           
           <div className="relative z-10 max-w-2xl space-y-8">
              <h2 className="font-serif text-5xl md:text-6xl font-bold leading-tight">Secure your <span className="text-garden-sage italic">Botanical Legacy</span></h2>
              <p className="text-white/70 text-xl leading-relaxed">
                Consistency is the primary driver of plant longevity. Your Guardian Score of {plant.guardianScore} is in the top 10% for {plant.species} owners worldwide.
              </p>
              <div className="flex flex-wrap gap-4">
                 <button className="px-10 py-5 bg-garden-sage text-white rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-garden-earth transition-all">Download Registry</button>
                 <button className="px-10 py-5 bg-white/10 text-white rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-white/20 transition-all border border-white/10">Share Status</button>
                 <button 
                   onClick={() => transitionTo(`/assistant?plantName=${encodeURIComponent(plant.name)}&species=${encodeURIComponent(plant.species)}`, 'AI Assistant')}
                   className="px-10 py-5 bg-white text-garden-earth rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-garden-sage hover:text-white transition-all border border-transparent shadow-sm flex items-center gap-2"
                 >
                   💬 Consult Assistant
                 </button>
              </div>
           </div>
           
           <div className="relative z-10 bg-white/5 backdrop-blur-xl p-10 rounded-[3rem] border border-white/10 space-y-6 flex-grow">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-garden-sage">System Health Logs</h4>
              <div className="space-y-4">
                 <LogEntry label="Neural Drift" value="Negligible" status="Pass" />
                 <LogEntry label="Phenotype" value="Consistent" status="Pass" />
                 <LogEntry label="Vitality" value="Ascending" status="High" />
                 <LogEntry label="Protocol" value="Compliant" status="Pass" />
              </div>
           </div>
        </motion.div>
      </motion.div>
    </PageWrapper>
  );
}

function DetailStat({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="bg-garden-cream/30 p-6 rounded-[2rem] border border-garden-olive/5">
       <div className="text-garden-sage mb-3">{icon}</div>
       <p className="text-[8px] font-black uppercase tracking-widest text-garden-earth/30 mb-1">{label}</p>
       <p className="text-lg font-black text-garden-earth">{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: any }) {
  return (
    <button 
      onClick={onClick}
      className={`pb-4 px-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
        active ? 'text-garden-earth' : 'text-garden-earth/30 hover:text-garden-earth/50'
      }`}
    >
      {active && (
        <motion.div 
          layoutId="tab-underline"
          className="absolute bottom-0 left-0 right-0 h-1 bg-garden-sage rounded-full"
        />
      )}
      {icon} {label}
    </button>
  );
}

function LogEntry({ label, value, status }: { label: string, value: string, status: string }) {
  return (
    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest overflow-hidden">
       <span className="text-white/40">{label}</span>
       <div className="flex items-center gap-3">
          <span className="italic">{value}</span>
          <span className={`px-2 py-0.5 rounded ${status === 'Pass' ? 'bg-garden-sage/20 text-garden-sage' : 'bg-garden-amber/20 text-garden-amber'}`}>{status}</span>
       </div>
    </div>
  );
}
