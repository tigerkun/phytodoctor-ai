import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Bot, Loader2, Sprout, Sparkles, AlertCircle, Mic } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { chatWithGardener, type Message } from '../services/chatService';
import PageWrapper from '../components/home/PageWrapper';
import { useToast } from '../components/Toast';

export default function Chat() {
  const { warning } = useToast();
  const [searchParams] = useSearchParams();
  const plantName = searchParams.get('plantName');
  const species = searchParams.get('species');

  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Greetings. I am PhytoDoctor's Master Gardener. How can I assist you with your botanical specimens today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Parse plant context on mount
  useEffect(() => {
    const queryParam = searchParams.get('query');
    if (plantName || queryParam) {
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
      }).catch(() => {
        setMessages(prev => [...prev, { role: 'model', content: "The AI Assistant needs a Gemini API key to work. Add GEMINI_API_KEY to your .env file and restart the server." }]);
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

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onend = () => {
        setIsListening(false);
      };

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

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
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
      setMessages(prev => [...prev, { role: 'model', content: "The AI Assistant needs a Gemini API key to work. Add GEMINI_API_KEY to your .env file and restart the server." }]);
    } finally {
      setLoading(false);
    }
  };

  const formatMessage = (text: string) => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
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
  }, [messages, loading]);

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
      setMessages(prev => [...prev, { role: 'model', content: "The AI Assistant needs a Gemini API key to work. Add GEMINI_API_KEY to your .env file and restart the server." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper className="max-w-4xl mx-auto px-6 py-8 md:py-12 min-h-[600px] h-[80vh] flex flex-col">
      <div className="mb-8 flex items-center justify-between shrink-0">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-moss mb-2 block">Live Lab Consultation</span>
          <h1 className="font-serif text-4xl font-bold text-text-bark">Botanical Assistant</h1>
        </div>
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-moss/10 rounded-full border border-moss/20">
          <div className="w-2 h-2 rounded-full bg-moss animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-moss">Master Gardener Online</span>
        </div>
      </div>

      <div className="flex-grow overflow-hidden bg-bg-glass rounded-[3rem] border border-border-light shadow-2xl flex flex-col relative">
        <div 
          ref={scrollRef}
          className="flex-grow overflow-y-auto p-6 md:p-10 space-y-8 scroll-smooth"
        >
          {messages.map((m, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                m.role === 'user' ? 'bg-terracotta text-white' : 'bg-moss text-white'
              }`}>
                {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              
              <div 
                className={`max-w-[80%] p-6 rounded-3xl text-sm leading-relaxed ${
                  m.role === 'user' 
                  ? 'bg-bg-tertiary text-text-bark rounded-tr-none' 
                  : 'bg-bg-secondary border border-border-light shadow-sm rounded-tl-none font-medium text-text-stone'
                }`}
                dangerouslySetInnerHTML={formatMessage(m.content)}
              />
            </motion.div>
          ))}
          
          {loading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-2xl bg-moss text-white flex items-center justify-center shrink-0">
                <Loader2 className="animate-spin" size={18} />
              </div>
              <div className="bg-moss/10 p-6 rounded-3xl rounded-tl-none flex items-center gap-3">
                <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-moss rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-moss rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-moss rounded-full animate-bounce" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-moss/60">Gardener is typing...</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8 bg-bg-secondary/50 border-t border-border-light">
          <form onSubmit={handleSubmit} className="relative group">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about propagation, soil pH, or seasonal care..."
              className="w-full pl-6 pr-28 py-5 bg-bg-glass border border-border-medium rounded-[2rem] text-sm text-text-bark placeholder:text-text-muted focus:outline-none focus:border-moss focus:ring-4 focus:ring-moss/10 shadow-lg transition-all group-hover:border-moss/30"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button 
                type="button"
                onClick={handleMicClick}
                className={`w-10 h-10 transition-colors flex items-center justify-center rounded-xl ${
                  isListening ? 'text-rose-500 bg-rose-500/10 animate-pulse' : 'text-text-muted hover:text-moss'
                }`}
                title={isListening ? "Listening... Click to stop" : "Start voice input"}
              >
                <Mic size={18} />
              </button>
              <button 
                type="submit"
                disabled={loading || !input.trim()}
                className="w-12 h-12 bg-moss text-white rounded-2xl flex items-center justify-center hover:bg-moss-dark transition-all disabled:opacity-30 active:scale-90"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
            {["Propagating Succulents", "Monstera Care", "Natural Pesticides"].map((suggestion, i) => (
              <button 
                key={i}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-4 py-1.5 bg-bg-secondary border border-border-medium rounded-full text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-moss hover:border-moss transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
