import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Bot, Loader2, Mic, Sparkles, Sprout, ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { chatWithGardener, type Message } from '../services/chatService';
import { useToast } from '../components/Toast';
import PageWrapper from '../components/home/PageWrapper';

export default function Assistant() {
  const { warning } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const plantName = searchParams.get('plantName');
  const species = searchParams.get('species');
  const initialQuery = searchParams.get('query');

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: "Greetings! I am PhytoDoctor AI's Chief Master Botanist and Plant Pathologist. How can I assist you with your botanical specimens today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const initialSentRef = useRef(false);

  // Auto-send query if supplied via URL
  useEffect(() => {
    if (initialSentRef.current) return;
    if (plantName || initialQuery) {
      initialSentRef.current = true;
      const nameDecoded = plantName ? decodeURIComponent(plantName) : '';
      const speciesDecoded = species ? decodeURIComponent(species) : '';
      const queryPrompt = initialQuery
        ? decodeURIComponent(initialQuery)
        : `Hello Master Botanist! I would love expert guidance on caring for my ${nameDecoded}${speciesDecoded ? ` (${speciesDecoded})` : ''}. What are the primary care rules and health risk indicators I should know?`;

      const userMessage: Message = { role: 'user', content: queryPrompt };
      setMessages(prev => [...prev, userMessage]);
      setLoading(true);

      chatWithGardener([
        {
          role: 'model',
          content: "Greetings! I am PhytoDoctor AI's Chief Master Botanist and Plant Pathologist. How can I assist you with your botanical specimens today?"
        },
        userMessage
      ]).then(response => {
        setMessages(prev => [...prev, { role: 'model', content: response }]);
      }).catch((_err: any) => {
        setMessages(prev => [...prev, {
          role: 'model',
          content: "I'm having a momentary connection delay with the botanical database. Please verify your connection or try again."
        }]);
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [plantName, species, initialQuery]);

  // Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInput(prev => (prev ? prev + ' ' + transcript : transcript));
      };
      recognitionRef.current = rec;
    }
  }, []);

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      warning("Speech recognition is not supported in this browser. Please use Google Chrome.");
      return;
    }
    if (isListening) recognitionRef.current.stop();
    else recognitionRef.current.start();
  };

  const handleSend = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || loading) return;

    const userMessage: Message = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const response = await chatWithGardener([...messages, userMessage]);
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (_err: any) {
      setMessages(prev => [...prev, {
        role: 'model',
        content: "I am having difficulty retrieving botanical data right now. Please try asking again in a moment."
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const formatMessage = (text: string) => {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return `<li class="ml-4 list-disc mb-1">${trimmed.substring(2)}</li>`;
      }
      return line;
    }).join('<br />');
    return { __html: html };
  };

  const QUICK_TOPICS = [
    "🌿 Why are my plant's leaves turning yellow?",
    "💧 How do I tell if I am overwatering or underwatering?",
    "🪲 Best organic remedy for fungus gnats or spider mites",
    "🧪 How to balance soil pH for indoor tropicals"
  ];

  return (
    <PageWrapper className="min-h-screen text-text-bark font-sans pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between gap-4 mb-6 border-b border-border-light pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-xl bg-bg-secondary hover:bg-bg-tertiary border border-border-light text-text-bark transition-all"
              title="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-black text-text-bark flex items-center gap-2">
                Botanical AI Specialist <Sparkles size={20} className="text-moss" />
              </h1>
              <p className="text-xs text-text-stone font-medium">
                Clinical diagnosis, soil chemistry, and precision horticulture advice
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-moss/10 border border-moss/20 text-moss text-xs font-bold">
            <ShieldCheck size={14} /> Botanical Guardrails Active
          </div>
        </div>

        {/* Chat Container */}
        <div className="bg-bg-glass backdrop-blur-xl border border-border-medium rounded-3xl shadow-xl flex flex-col h-[640px] max-h-[75vh] overflow-hidden">
          
          {/* Top Bar inside Card */}
          <div className="px-6 py-3.5 bg-moss text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">Master Botanist & Pathologist</h3>
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-80">PhytoDoctor Clinical Engine</p>
              </div>
            </div>

            <button
              onClick={() => setMessages([{
                role: 'model',
                content: "Greetings! I am PhytoDoctor AI's Chief Master Botanist and Plant Pathologist. How can I assist you with your botanical specimens today?"
              }])}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all text-xs flex items-center gap-1.5"
              title="Reset Chat"
            >
              <RefreshCw size={13} /> Clear
            </button>
          </div>

          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((m, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  m.role === 'user' ? 'bg-terracotta text-white' : 'bg-moss text-white'
                }`}>
                  {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
                </div>

                <div className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-moss/10 text-text-bark font-medium rounded-tr-none border border-moss/20'
                    : 'bg-bg-secondary text-text-bark border border-border-light shadow-xs rounded-tl-none font-sans font-medium'
                }`}>
                  <div dangerouslySetInnerHTML={formatMessage(m.content)} />
                </div>
              </motion.div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-moss text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Loader2 className="animate-spin" size={15} />
                </div>
                <div className="bg-bg-secondary border border-border-light p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2 h-2 bg-moss rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-moss rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-moss rounded-full animate-bounce" />
                  </div>
                  <span className="text-xs text-text-muted font-medium ml-2">Consulting botanical pathologist...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          {messages.length <= 2 && (
            <div className="px-4 sm:px-6 py-2 bg-bg-secondary/40 border-t border-border-light flex gap-2 overflow-x-auto scrollbar-hide">
              {QUICK_TOPICS.map((topic, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(topic)}
                  className="px-3 py-1.5 shrink-0 bg-bg-primary hover:bg-moss/10 hover:border-moss border border-border-light rounded-full text-[11px] font-semibold text-text-stone hover:text-moss transition-all"
                >
                  {topic}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 sm:p-5 bg-bg-secondary/80 border-t border-border-light">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about plant symptoms, watering, light, soil chemistry, pests..."
                className="flex-grow pl-4 pr-12 py-3.5 bg-bg-primary border border-border-medium rounded-2xl text-xs sm:text-sm text-text-bark placeholder:text-text-muted focus:outline-none focus:border-moss focus:ring-2 focus:ring-moss/20 transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={handleMicClick}
                className={`absolute right-14 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                  isListening ? 'text-rose-500 bg-rose-500/10 animate-pulse' : 'text-text-muted hover:text-moss'
                }`}
                title="Voice Dictation"
              >
                <Mic size={16} />
              </button>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-11 h-11 shrink-0 bg-moss text-white rounded-2xl flex items-center justify-center hover:bg-moss-dark transition-all disabled:opacity-30 active:scale-95 shadow-md"
                title="Send Message"
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
