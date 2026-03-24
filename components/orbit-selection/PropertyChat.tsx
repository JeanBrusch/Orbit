"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, MessageSquare, Loader2, X, Plus } from 'lucide-react';

interface Message {
  id: string;
  sender_type: 'broker' | 'lead';
  content: string;
  created_at: string;
  metadata?: any;
}

interface PropertyChatProps {
  leadId: string;
  propertyId: string;
  propertyTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PropertyChat({ leadId, propertyId, propertyTitle, isOpen, onClose }: PropertyChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && leadId && propertyId) {
      fetchMessages();
    }
  }, [isOpen, leadId, propertyId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/selection-chat?leadId=${leadId}&propertyId=${propertyId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Error fetching chat:", err);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);

    try {
      const res = await fetch('/api/selection-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          propertyId,
          senderType: 'lead',
          content: newMessage
        })
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setNewMessage("");
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
    setSending(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 h-[85vh] bg-[#0c0c0c] border-t border-white/10 rounded-t-[32px] z-[101] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg leading-tight">Discussão</h3>
                <p className="text-white/40 text-xs mt-0.5 truncate max-w-[200px]">{propertyTitle}</p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#d4af35] animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col h-full items-center justify-center text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-white/10" />
                  </div>
                  <p className="text-white/40 text-sm">Nenhuma mensagem ainda.<br />Tire suas dúvidas sobre este imóvel aqui.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex ${msg.sender_type === 'lead' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl p-4 ${
                      msg.sender_type === 'lead' 
                        ? 'bg-[#d4af35] text-black font-medium' 
                        : 'bg-white/5 text-white/80'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <span className={`text-[10px] mt-2 block opacity-40 ${
                        msg.sender_type === 'lead' ? 'text-black' : 'text-white'
                      }`}>
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="p-6 bg-[#121212] border-t border-white/5 pb-10">
              <div className="relative flex items-center gap-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escreva sua dúvida..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#d4af35]/50 resize-none max-h-32"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="w-12 h-12 rounded-2xl bg-[#d4af35] flex items-center justify-center text-black disabled:opacity-50 transition-all active:scale-90"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
