import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Bot, Loader2, MessageCircle, X, Mic } from 'lucide-react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { chatWithGardener, type Message } from '../services/chatService';
import { useToast } from '../components/Toast';

export default function FloatingAssistant() {
  const { warning } = useToast();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const plantName = searchParams.get('plantName');
  const species = searchParams.get('species');

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Greetings. I am PhytoDoctor's Master Gardener. How can I assist you?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // If a plant query is passed in the URL, automatically open and send
  useEffect(() => {
    const queryParam = searchParams.get('query');
    if (plantName || queryParam) {
      setIsOpen(true);
      const nameDecoded = plantName ? decodeURIComponent(plantName) : '';
      const speciesDecoded = species ? decodeURIComponent(species) : '';
      const initialPrompt = queryParam 
        ? decodeURIComponent(queryParam)
        : `Hello Master Gardener! I would love some specific advice on caring for my plant, ${nameDecoded}${speciesDecoded ? ` (${speciesDecoded})` : ''}. Can you check its status and suggest any premium care recipes?`;
      
      const userMessage: Message = { role: 'user', content: initialPrompt };
      setMessages(prev => [...prev, userMessage]);
      setLoading(true);

      chatWithGardener([
        { role: 'model', content: "Greetings. I am PhytoDoctor's Master Gardener. How can I assist you with your botanical specimens today?" },
        userMessage
      ]).then(response => {
        setMessages(prev => [...prev, { role: 'model', content: response }]);
      }).catch((err: any) => {
        setMessages(prev => [...prev, { role: 'model', content: "I'm having trouble connecting to my botanical knowledge base right now. Please try again later." }]);
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [plantName, species, searchParams]);

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

  const handleSuggestionClick = async (suggestion: string) => {
    if (loading) return;
    const userMessage: Message = { role: 'user', content: suggestion };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    try {
      const response = await chatWithGardener([...messages, userMessage]);
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', content: "I'm having trouble connecting right now." }]);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await chatWithGardener([...messages, userMessage]);
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', content: "I'm having trouble connecting right now." }]);
    } finally {
      setLoading(false);
    }
  };

  // Only show on home page if requested specifically, but typical convention is global.
  // We'll show it globally unless explicitly asked to hide.
  if (location.pathname === '/auth') return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-20 right-0 w-[380px] max-w-[90vw] h-[500px] max-h-[70vh] bg-bg-glass backdrop-blur-xl rounded-[2rem] border border-border-light shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-moss text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Master Gardener</h3>
                  <p className="text-[10px] font-medium opacity-80 uppercase tracking-widest">AI Assistant</p>
                </div>
              </div>
              <button 
                aria-label="Close assistant"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chat Body */}
            <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4 scroll-smooth">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                    m.role === 'user' ? 'bg-terracotta text-white' : 'bg-moss text-white'
                  }`}>
                    {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  
                  <div 
                    className={`max-w-[75%] p-3 rounded-2xl text-xs leading-relaxed ${
                      m.role === 'user' 
                      ? 'bg-bg-tertiary text-text-bark rounded-tr-none' 
                      : 'bg-bg-secondary border border-border-light shadow-sm rounded-tl-none font-medium text-text-stone'
                    }`}
                    dangerouslySetInnerHTML={formatMessage(m.content)}
                  />
                </div>
              ))}
              
              {loading && (
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-xl bg-moss text-white flex items-center justify-center shrink-0">
                    <Loader2 className="animate-spin" size={14} />
                  </div>
                  <div className="bg-moss/10 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <div className="flex gap-1">
                        <span className="w-1 h-1 bg-moss rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1 h-1 bg-moss rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1 h-1 bg-moss rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Input */}
            <div className="p-4 bg-bg-secondary/50 border-t border-border-light shrink-0">
              {messages.length < 3 && (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {["Monstera Care", "Repotting", "Pest Control"].map((suggestion, i) => (
                    <button 
                      key={i}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-3 py-1 shrink-0 bg-bg-primary border border-border-medium rounded-full text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-moss hover:border-moss transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask the gardener..."
                  className="flex-grow pl-4 pr-10 py-3 bg-bg-glass border border-border-medium rounded-xl text-xs text-text-bark placeholder:text-text-muted focus:outline-none focus:border-moss focus:ring-2 focus:ring-moss/20 transition-all"
                />
                <button 
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  type="button"
                  onClick={handleMicClick}
                  className={`absolute right-[3.25rem] w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    isListening ? 'text-rose-500 bg-rose-500/10 animate-pulse' : 'text-text-muted hover:text-moss'
                  }`}
                >
                  <Mic size={14} />
                </button>
                <button 
                  aria-label="Send message"
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 shrink-0 bg-moss text-white rounded-xl flex items-center justify-center hover:bg-moss-dark transition-all disabled:opacity-30 active:scale-95"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-moss text-white rounded-full shadow-2xl flex items-center justify-center relative border-2 border-white/20"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle size={24} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
