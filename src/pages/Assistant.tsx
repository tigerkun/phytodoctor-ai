import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Bot, Loader2, Mic, ArrowLeft, ShieldCheck, RefreshCw, BookmarkPlus, Check, Sparkles } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { chatWithBotanist, type Message } from '../services/chatService';
import { useToast } from '../components/Toast';
import { triggerHaptic, playAudio } from '../utils/hapticAudio';
import { db } from '../db/database';
import PageWrapper from '../components/home/PageWrapper';

const STORAGE_KEY = 'phytodoctor_assistant_history';
const SAVED_NOTES_KEY = 'phytodoctor_assistant_saved_notes';

const safeDecode = (val: string | null | undefined): string => {
  if (!val) return '';
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
};

const DEFAULT_WELCOME_MESSAGE: Message = {
  role: 'model',
  content: "Greetings! I am PhytoDoctor AI's Chief Master Botanist and Plant Pathologist. How can I assist you with your botanical specimens, soil chemistry, or pathology today?"
};

const QUICK_TOPICS = [
  "🌿 Why are my plant's leaves turning yellow?",
  "💧 How do I tell if I am overwatering or underwatering?",
  "🪲 Best organic remedy for fungus gnats or spider mites",
  "🧪 How to balance soil pH for indoor tropicals",
  "🌱 Optimal humidity and light calibration"
];

export default function Assistant() {
  const { success, warning, info } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const plantName = searchParams.get('plantName');
  const species = searchParams.get('species');
  const initialQuery = searchParams.get('query');

  // Load persistent conversation history from localStorage
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fall back to default
    }
    return [DEFAULT_WELCOME_MESSAGE];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [savedNotes, setSavedNotes] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem(SAVED_NOTES_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const initialSentRef = useRef(false);

  // Sync messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Storage quota or disabled
    }
  }, [messages]);

  // Sync saved dispatches state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_NOTES_KEY, JSON.stringify(savedNotes));
    } catch {
      // Storage quota or disabled
    }
  }, [savedNotes]);

  // Auto-send query if supplied via URL
  useEffect(() => {
    if (initialSentRef.current) return;
    if (plantName || initialQuery) {
      initialSentRef.current = true;
      const nameDecoded = safeDecode(plantName);
      const speciesDecoded = safeDecode(species);
      const queryPrompt = initialQuery
        ? safeDecode(initialQuery)
        : `Hello Master Botanist! I would love expert guidance on caring for my ${nameDecoded}${speciesDecoded ? ` (${speciesDecoded})` : ''}. What are the primary care rules and health risk indicators I should know?`;

      const userMessage: Message = { role: 'user', content: queryPrompt };
      setMessages(prev => [...prev, userMessage]);
      setLoading(true);
      triggerHaptic('medium');
      playAudio('chime');

      chatWithBotanist([
        DEFAULT_WELCOME_MESSAGE,
        userMessage
      ]).then(response => {
        setMessages(prev => [...prev, { role: 'model', content: response }]);
        playAudio('leaf-rustle');
        triggerHaptic('light');
      }).catch((_err: any) => {
        setMessages(prev => [...prev, {
          role: 'model',
          content: "I am having a momentary connection delay with the Royal Botanical archives. Please verify your connection and transmit your inquiry again."
        }]);
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [plantName, species, initialQuery]);

  // Speech Recognition setup with fallback handling and cleanup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        triggerHaptic('light');
      };
      rec.onend = () => setIsListening(false);
      rec.onerror = () => {
        setIsListening(false);
        warning("Voice dictation encountered an audio capture issue. Please verify microphone permissions.");
      };
      rec.onresult = (e: any) => {
        const transcript = e.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput(prev => (prev ? prev + ' ' + transcript : transcript));
          triggerHaptic('light');
        }
      };
      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [warning]);

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      warning("Telegraph voice dictation is not supported in this browser. Google Chrome or Edge is recommended.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
      }
    }
  };

  const handleSend = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || loading) return;

    triggerHaptic('medium');
    playAudio('chime');

    const userMessage: Message = { role: 'user', content: messageText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const response = await chatWithBotanist(updatedMessages);
      setMessages(prev => [...prev, { role: 'model', content: response }]);
      playAudio('leaf-rustle');
      triggerHaptic('light');
    } catch (_err: any) {
      setMessages(prev => [...prev, {
        role: 'model',
        content: "I am having difficulty retrieving botanical pathology records right now. Please try transmitting your inquiry again in a moment."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    triggerHaptic('medium');
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setSavedNotes({});
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SAVED_NOTES_KEY);
    } catch {
      // ignore
    }
    info("Correspondence desk transcript cleared.");
  };

  // File Chief Botanist directive into Dexie Plant Notes
  const handleSaveToNotes = async (content: string, index: number) => {
    try {
      triggerHaptic('light');
      const decodedPlant = safeDecode(plantName);
      const plantSlug = decodedPlant
        ? decodedPlant.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : 'botanical-consultation';

      await db.notes.add({
        id: `dispatch-${Date.now()}-${index}`,
        plantId: plantSlug || 'botanical-consultation',
        userId: 'local-gardener',
        content: content.replace(/<[^>]*>?/gm, ''),
        category: 'observation',
        tags: ['botanist-dispatch', 'kew-consultation', decodedPlant || 'botanical-advice'],
        createdAt: new Date()
      });
      setSavedNotes(prev => ({ ...prev, [index]: true }));
      playAudio('leaf-rustle');
      success("Botanical communiqué filed into Field Log & Notes!");
    } catch (e) {
      warning("Unable to file dispatch to local database.");
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Formatter for markdown, numbered directives and lists
  const formatMessage = useCallback((text: string) => {
    if (!text || typeof text !== 'string') return { __html: '' };
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const escaped = cleanText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-moss-dark dark:text-[#a8d5a8]">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic opacity-90">$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px]">$1</code>');
    
    const lines = html.split('\n');
    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      // Numbered care directives
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return `<div class="flex items-start gap-2 my-1.5 pl-1"><span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-moss/20 text-moss text-[10px] font-mono font-bold shrink-0 mt-0.5 border border-moss/30">${numMatch[1]}</span><span class="flex-1">${numMatch[2]}</span></div>`;
      }
      // Bullet lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return `<li class="ml-5 list-disc mb-1 leading-snug">${trimmed.substring(2)}</li>`;
      }
      return line;
    });

    const joined = formattedLines.join('<br />').replace(/(<\/div>|<\/li>)<br \/>/g, '$1');
    return { __html: joined };
  }, []);

  return (
    <PageWrapper className="min-h-screen skin-consult text-text-bark font-sans pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        
        {/* Header Masthead */}
        <div className="flex items-center justify-between gap-4 mb-6 pb-5 border-b-2 border-[#3d5a3d]/25">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-md bg-[#2b3d2b] hover:bg-[#1f2d1f] text-[#f4ecd8] border border-[#4a634a]/40 shadow-sm transition-all active:scale-95"
              title="Return to Conservatory"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-moss dark:text-[#8fb58f]">
                Correspondence Bureau
              </p>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1f2f21] dark:text-[#e4ede4] tracking-tight">
                Chief Botanist's Study
              </h1>
              <p className="text-xs text-text-stone font-medium">
                Telegram correspondence desk · pathology, soil chemistry &amp; care directives
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {plantName && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-600/30 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                <Sparkles size={13} /> Specimen: {safeDecode(plantName)}
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-moss/10 border border-moss/20 text-moss text-xs font-bold">
              <ShieldCheck size={14} /> Botanical Guardrails Active
            </div>
          </div>
        </div>

        {/* Hunter-Green Leather Desk Blotter */}
        <div className="desk-blotter relative flex flex-col h-[670px] max-h-[78vh] overflow-hidden">
          
          {/* Four Ornate Brass Corner Brackets */}
          <div className="tactile-brass-corner tactile-brass-corner-tl" aria-hidden="true" />
          <div className="tactile-brass-corner tactile-brass-corner-tr" aria-hidden="true" />
          <div className="tactile-brass-corner tactile-brass-corner-bl" aria-hidden="true" />
          <div className="tactile-brass-corner tactile-brass-corner-br" aria-hidden="true" />

          {/* Blotter Chrome Header */}
          <div className="relative z-10 px-5 sm:px-7 py-3.5 bg-[#172b1d] border-b border-[#2d4d35] text-[#f4ecd8] flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-moss/30 border border-moss/50 flex items-center justify-center text-[#d4af37] shadow-inner">
                <Bot size={19} />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm sm:text-base leading-tight tracking-wide text-[#fdf8ed]">
                  Chief Master Botanist
                </h3>
                <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#9ec49e] opacity-90">
                  Royal Botanic Observatory Dispatch · Verified
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Circular Postal Franking Stamp */}
              <div 
                className="tactile-postal-stamp flex shrink-0" 
                aria-label="Kew Station Botanic Dispatch Verified Postmark"
              >
                <span className="leading-none text-[5.5px] tracking-wider opacity-85">KEW STATION</span>
                <span className="font-mono text-[6.5px] font-black my-0.5 tracking-wider">BOTANIC DISPATCH</span>
                <span className="text-[6px] tracking-tight font-extrabold leading-none">★ VERIFIED ★</span>
                <span className="text-[5px] mt-0.5 opacity-75 font-mono">EST. 1840</span>
              </div>

              <button
                onClick={handleClearChat}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#f4ecd8] transition-all text-xs font-semibold flex items-center gap-1.5 border border-white/15 active:scale-95"
                title="Clear correspondence desk"
              >
                <RefreshCw size={13} /> Clear
              </button>
            </div>
          </div>

          {/* Messages Stream Area */}
          <div 
            ref={scrollRef} 
            className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth"
            style={{ scrollbarWidth: 'thin' }}
          >
            {messages.map((m, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Author Avatar Key */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm border ${
                  m.role === 'user' 
                    ? 'bg-[#c17f59] border-[#9c5f3b] text-[#fbf7ee]' 
                    : 'bg-[#2b4c34] border-[#4a7255] text-[#f4ecd8]'
                }`}>
                  {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
                </div>

                {/* Message Container */}
                <div className={`max-w-[88%] sm:max-w-[80%] ${
                  m.role === 'user' ? 'vellum-slip p-4 text-xs sm:text-sm leading-relaxed' : 'observatory-letter p-4 sm:p-5 text-xs sm:text-sm leading-relaxed'
                }`}>
                  {/* Observatory Letter Header for Model */}
                  {m.role === 'model' && (
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#a89476]/30 dark:border-[#4a634d]/40 text-[10px] uppercase font-mono tracking-wider text-moss dark:text-[#88c988] font-bold">
                      <span>Botanical Observatory Communiqué</span>
                      <span>No. {idx + 1}</span>
                    </div>
                  )}

                  {/* User folded slip stamp header */}
                  {m.role === 'user' && (
                    <div className="pb-1.5 mb-2 border-b border-[#c2aa82]/30 dark:border-[#b89535]/30 text-[9px] uppercase font-mono tracking-wider text-[#8a6845] dark:text-[#d4af37] font-bold">
                      Inquirer Telegram Dispatch
                    </div>
                  )}

                  <div 
                    className="font-serif leading-relaxed" 
                    dangerouslySetInnerHTML={formatMessage(m.content)} 
                  />

                  {/* Model Action: File to Field Notes */}
                  {m.role === 'model' && m.content !== DEFAULT_WELCOME_MESSAGE.content && (
                    <div className="mt-3 pt-2.5 border-t border-[#a89476]/25 dark:border-[#4a634d]/30 flex items-center justify-end">
                      <button
                        onClick={() => handleSaveToNotes(m.content, idx)}
                        disabled={savedNotes[idx]}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                          savedNotes[idx]
                            ? 'bg-moss/20 text-moss font-bold cursor-default'
                            : 'bg-[#a89476]/15 hover:bg-[#a89476]/25 text-[#55402c] dark:text-[#d0c2ad] active:scale-95'
                        }`}
                        title="File into Specimen Notes in Dexie"
                      >
                        {savedNotes[idx] ? (
                          <>
                            <Check size={12} /> Filed to Field Notes
                          </>
                        ) : (
                          <>
                            <BookmarkPlus size={12} /> File Dispatch to Field Notes
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Transmitting / Thinking State */}
            {loading && (
              <motion.div 
                initial={{ opacity: 0, y: 6 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-[#2b4c34] border border-[#4a7255] text-[#f4ecd8] flex items-center justify-center shrink-0 shadow-sm">
                  <Loader2 className="animate-spin" size={15} />
                </div>
                <div className="observatory-letter p-4 rounded-md flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2 h-2 bg-moss rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-moss rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-moss rounded-full animate-bounce" />
                  </div>
                  <span className="text-xs text-[#55402c] dark:text-[#c7dac7] font-mono">
                    Telegraph key active · consulting botanical archives...
                  </span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Quick Inquiry Telegraph Slips */}
          {messages.length <= 2 && (
            <div className="relative z-10 px-4 sm:px-6 py-2.5 bg-[#142419] border-t border-[#26402d] flex gap-2 overflow-x-auto scrollbar-none shrink-0">
              {QUICK_TOPICS.map((topic, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(topic)}
                  className="px-3 py-1.5 shrink-0 bg-[#1c3324] hover:bg-[#254230] border border-[#3b5e43] rounded-md text-[11px] font-serif text-[#d8e6d8] hover:text-[#fff6df] transition-all shadow-xs active:scale-95"
                >
                  {topic}
                </button>
              ))}
            </div>
          )}

          {/* Telegraph Dispatch Input Area */}
          <div className="relative z-10 p-3.5 sm:p-5 bg-[#172b1d] border-t border-[#284832] shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Transmit inquiry on plant symptoms, watering, chemistry, light, or pests..."
                className="flex-grow pl-4 pr-24 py-3 bg-[#fbf8f1] dark:bg-[#1c241e] border border-[#a89476]/50 dark:border-[#38533e] rounded-xl text-xs sm:text-sm text-text-bark dark:text-[#f0f6f0] placeholder:text-text-muted focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 transition-all shadow-inner"
              />
              
              {/* Vintage Brass Telegraph Microphone Key */}
              <button
                type="button"
                onClick={handleMicClick}
                className={`absolute right-[58px] top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center telegraph-key-mic ${
                  isListening ? 'is-listening' : ''
                }`}
                title={isListening ? "Listening... click to end dictation" : "Voice Dictation (Vintage Telegraph Mic)"}
              >
                <Mic size={15} />
              </button>

              {/* Vintage Brass Telegraph Send Key */}
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-11 h-11 shrink-0 telegraph-key-send flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                title="Transmit Dispatch (Send)"
              >
                <Send size={16} />
              </button>
            </form>
          </div>

        </div>

      </div>
    </PageWrapper>
  );
}
