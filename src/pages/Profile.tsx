import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Award, Edit2, Check, Camera, Crown, Star, TrendingUp, Calendar, Zap, LogOut, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { GameService } from '../services/gameService';
import { RewardService } from '../services/rewardService';
import { clearDemoData } from '../demo/seedDemoGarden';
import LevelDisplay from '../components/game/LevelDisplay';
import StreakWidget from '../components/game/StreakWidget';
import PageWrapper from '../components/home/PageWrapper';
import { usePageTransition } from '../components/home/PageTransitionContext';

export default function Profile() {
  const navigate = useNavigate();
  const { transitionTo } = usePageTransition();
  const profile = useLiveQuery(() => GameService.getProfile());
  const cards = useLiveQuery(() => db.cards.where('userId').equals(GameService.getUserId()).toArray()) || [];
  const isDemo = localStorage.getItem('botanical_guardian_demo_mode') === 'true';

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const handleClearDemo = async () => {
    if (confirm('This will remove all demo data and return to your own garden. Continue?')) {
      await clearDemoData();
      window.location.reload();
    }
  };

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setAvatarUrl(profile.avatarUrl);
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    await db.userProfile.update(GameService.getUserId(), {
      username,
      avatarUrl
    });
    setIsEditing(false);
  };

  useEffect(() => {
    // Auto-create profile on first visit so the page isn't blank
    GameService.ensureProfile();
  }, []);

  if (!profile) return (
    <PageWrapper className="max-w-7xl mx-auto px-6 py-12 flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="inline-block text-4xl">🌿</motion.div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Setting up your guardian profile…</p>
      </div>
    </PageWrapper>
  );

  const totalCardXP = cards.reduce((sum, c) => sum + (c.level * 100 + c.xp), 0);
  const mythicCount = cards.filter(c => c.rarity === 'mythic').length;

  return (
    <PageWrapper className="max-w-7xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Basic Info */}
        <div className="space-y-8">
           <motion.div 
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             className="bg-white/90 backdrop-blur-xl p-10 rounded-[3.5rem] border border-white shadow-2xl shadow-garden-earth/5 relative overflow-hidden"
           >
              <div className="absolute top-0 right-0 p-8 text-garden-sage/5 -rotate-12">
                 <Shield size={160} />
              </div>
              
              <div className="relative z-10 flex flex-col items-center text-center">
                 <div className="relative group mb-8">
                    <div className="w-32 h-32 bg-garden-cream rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl">
                       <img 
                         src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.userId}`} 
                         alt="avatar" 
                         className="w-full h-full object-cover"
                       />
                    </div>
                    {isEditing && (
                      <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-garden-earth text-white rounded-xl flex items-center justify-center shadow-lg">
                        <Camera size={16} />
                      </button>
                    )}
                 </div>

                 {isEditing ? (
                   <div className="space-y-4 w-full">
                      <input 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-6 py-3 bg-garden-cream/50 rounded-xl border border-garden-olive/10 font-bold text-garden-earth text-center focus:outline-none focus:ring-2 focus:ring-garden-sage/20"
                        placeholder="Enter Username"
                      />
                      <button 
                        onClick={handleUpdateProfile}
                        className="w-full py-3 bg-garden-earth text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                      >
                        <Check size={14} /> Update Identity
                      </button>
                   </div>
                 ) : (
                   <div className="space-y-2">
                      <div className="flex items-center justify-center gap-3">
                         <h2 className="text-4xl font-black text-garden-earth font-serif">{profile.username}</h2>
                         <button onClick={() => setIsEditing(true)} className="text-garden-earth/20 hover:text-garden-sage transition-colors">
                            <Edit2 size={16} />
                         </button>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                         <span className="text-[10px] font-black uppercase tracking-widest text-garden-sage px-3 py-1 bg-garden-sage/10 rounded-full">
                            Guardian Level {Math.floor(totalCardXP / 500) + 1}
                         </span>
                         {profile.tier === 'pro' && (
                           <div className="bg-yellow-400 text-garden-sage px-2 py-0.5 rounded-full flex items-center gap-1 text-[8px] font-black">
                              <Crown size={10} /> PRO
                           </div>
                         )}
                      </div>
                   </div>
                 )}

                 {profile.equippedTitle && (
                   <div className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-garden-earth/30">
                      The {profile.equippedTitle}
                   </div>
                 )}
              </div>
           </motion.div>

           <div className="grid grid-cols-2 gap-4">
              <StatCard label="Seeds" value={profile.seeds.toLocaleString()} icon={<Star size={14} />} color="text-yellow-500" />
              <StatCard label="Vault Size" value={cards.length.toString()} icon={<Shield size={14} />} color="text-garden-sage" />
              <StatCard label="Mythics" value={mythicCount.toString()} icon={<Award size={14} />} color="text-purple-500" />
              <StatCard label="Streak" value={`${profile.currentStreak}d`} icon={<TrendingUp size={14} />} color="text-orange-500" />
           </div>

           {/* Guardian Logistics */}
           <motion.div 
             initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
             className="bg-white/90 backdrop-blur-xl p-8 rounded-[3rem] border border-white shadow-xl shadow-garden-earth/5"
           >
              <h3 className="font-serif text-xl font-bold text-garden-earth mb-6 flex items-center gap-2">
                 <User size={18} className="text-garden-sage" /> Guardian Logistics
              </h3>
              <div className="space-y-2">
                 <DetailRow label="Experience" value={profile.experienceLevel ? profile.experienceLevel.charAt(0).toUpperCase() + profile.experienceLevel.slice(1) : 'Not Specified'} />
                 <DetailRow label="Environment" value={profile.environment ? profile.environment.charAt(0).toUpperCase() + profile.environment.slice(1) : 'Not Specified'} />
                 <DetailRow label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : 'Not Specified'} />
              </div>
           </motion.div>
        </div>

        {/* Right Columns: Achievement & History */}
        <div className="lg:col-span-2 space-y-8">
           {/* Level & Streak Section */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <LevelDisplay compact={false} showUnlock={true} />
             <StreakWidget compact={false} />
           </div>

           <section className="bg-white/90 backdrop-blur-xl p-12 rounded-[4rem] border border-white shadow-xl shadow-garden-earth/5">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="font-serif text-3xl font-bold text-garden-earth">Distinctions</h3>
                 <span className="text-[10px] font-black uppercase tracking-widest text-garden-earth/20">Protocol Badges</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                 <Badge active={profile.currentStreak >= 7} label="Week One" description="Seven day stability" icon={<Calendar size={24} />} />
                 <Badge active={cards.length >= 5} label="Collector" description="5 unique specimens" icon={<Star size={24} />} />
                 <Badge active={profile.tier === 'pro'} label="Scholar" description="Pro subscription" icon={<Crown size={24} />} />
                 <Badge active={totalCardXP > 1000} label="Advancer" description="1000+ total XP" icon={<Zap size={24} />} />
              </div>
           </section>

           <section className="bg-white/90 backdrop-blur-xl p-12 rounded-[4rem] border border-white shadow-xl shadow-garden-earth/5">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="font-serif text-3xl font-bold text-garden-earth">Recent Activity</h3>
                 <button 
                   onClick={() => transitionTo('/lab', 'Botanical Lab')} 
                   className="text-[10px] font-black uppercase tracking-widest text-garden-sage hover:opacity-80 transition-opacity"
                 >
                   View Full Log
                 </button>
              </div>
              
              <div className="space-y-4 text-center">
                 <p className="text-sm text-garden-earth/50 italic py-4">No recent activity found. Start logging check-ins to build your history!</p>
              </div>

              {/* Settings & Danger Zone */}
              <div className="bg-white p-8 mt-8 rounded-[3rem] border border-garden-olive/10 shadow-xl relative overflow-hidden group">
                <div className="absolute -right-12 -top-12 w-32 h-32 bg-red-50 rounded-full blur-3xl opacity-50 transition-opacity" />
                <h3 className="font-serif text-xl font-bold text-garden-earth mb-6 flex items-center gap-2 relative z-10">
                   <LogOut className="text-red-400" /> Account Settings
                </h3>
                
                <button 
                  onClick={() => {
                    if (confirm('Are you sure you want to sign out?')) {
                      localStorage.removeItem('botanical_guardian_auth_token');
                      localStorage.removeItem('botanical_guardian_onboarded');
                      localStorage.removeItem('botanical_guardian_userId');
                      localStorage.removeItem('botanical_guardian_user_email');
                      localStorage.removeItem('botanical_guardian_user_name');
                      // We DO NOT clear the DB here because IndexedDB stores multi-user data.
                      window.location.href = '/auth';
                    }
                  }}
                  className="w-full py-4 px-6 bg-red-50 text-red-600 font-bold rounded-2xl flex items-center justify-between hover:bg-red-100 transition-colors"
                >
                  <span>Sign Out</span>
                  <LogOut size={18} />
                </button>
              </div>
           </section>
        </div>
     </div>
    </PageWrapper>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: string, icon: any, color: string }) {
  return (
    <div className="bg-white/90 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-xl shadow-garden-earth/5 transition-transform hover:-translate-y-1 hover:shadow-2xl">
       <div className={`${color} mb-3`}>{icon}</div>
       <div className="text-[8px] font-black uppercase tracking-widest text-garden-earth/40 mb-1">{label}</div>
       <div className="text-xl font-black text-garden-earth">{value}</div>
    </div>
  );
}

function Badge({ active, label, description, icon }: { active: boolean, label: string, description: string, icon: any }) {
  return (
    <div className={`p-8 rounded-[3rem] border flex flex-col items-center text-center transition-all ${
      active ? 'bg-garden-sage/5 border-garden-sage shadow-lg shadow-garden-sage/10' : 'bg-garden-cream/20 border-garden-olive/5 opacity-40 grayscale'
    }`}>
       <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${active ? 'bg-garden-sage text-white' : 'bg-garden-earth/10 text-garden-earth'}`}>
          {icon}
       </div>
       <h4 className="text-sm font-black uppercase tracking-widest text-garden-earth mb-2">{label}</h4>
       <p className="text-[10px] font-bold text-garden-earth/40 italic leading-tight">{description}</p>
    </div>
  );
}

function ActivityItem({ type, title, time, seeds }: { type: string, title: string, time: string, seeds: number }) {
  return (
    <div className="flex items-center justify-between p-6 bg-garden-cream/20 rounded-[2rem] border border-garden-olive/5">
       <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl border border-garden-olive/10 flex items-center justify-center text-garden-sage">
             <User size={18} />
          </div>
          <div>
             <h4 className="font-bold text-garden-earth text-sm">{title}</h4>
             <p className="text-[10px] font-black uppercase tracking-widest text-garden-earth/20">{time}</p>
          </div>
       </div>
       <div className={`font-black text-sm ${seeds > 0 ? 'text-garden-sage' : 'text-garden-coral'}`}>
          {seeds > 0 ? '+' : ''}{seeds} Seeds
       </div>
    </div>
  );
}
function DetailRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-garden-olive/10 last:border-0 hover:bg-garden-cream/20 px-4 -mx-4 rounded-2xl transition-colors">
      <span className="text-xs font-black uppercase tracking-widest text-garden-earth/40">{label}</span>
      <span className="text-sm font-bold text-garden-earth">{value}</span>
    </div>
  );
}
