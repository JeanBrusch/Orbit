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
            className="fixed bottom-0 left-0 right-0 h-[85vh] bg-[#FBFBFB] border-t border-gray-100 rounded-t-[32px] z-[101] flex flex-col overflow-hidden shadow-2xl shadow-black/20"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white/50 backdrop-blur-sm">
              <div>
                <h3 className="text-[#1A1A1A] font-bold text-lg leading-tight">Discussão</h3>
                <p className="text-[#A1A1A1] text-xs mt-1 font-medium truncate max-w-[200px]">{propertyTitle}</p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-[#A1A1A1] hover:text-[#1A1A1A] transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FBFBFB]"
            >
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#C9A84C] animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col h-full items-center justify-center text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-6">
                    <MessageSquare className="w-8 h-8 text-[#DEDDDA]" />
                  </div>
                  <p className="text-[#A1A1A1] text-sm font-medium leading-relaxed">
                    Nenhuma mensagem ainda.<br />
                    Tire suas dúvidas técnicas ou comerciais aqui.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex ${msg.sender_type === 'lead' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-[20px] p-4 shadow-sm ${
                      msg.sender_type === 'lead' 
                        ? 'bg-[#1A1A1A] text-white font-medium' 
                        : 'bg-white border border-gray-100 text-[#444]'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <span className={`text-[9px] mt-2 block font-bold uppercase tracking-wider opacity-40 ${
                        msg.sender_type === 'lead' ? 'text-gray-400' : 'text-gray-400'
                      }`}>
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="p-6 bg-white border-t border-gray-100 pb-10">
              <div className="relative flex items-center gap-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Escreva sua dúvida..."
                  className="flex-1 bg-gray-50 border border-[#EDEDED] rounded-[20px] py-4 px-5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C9A84C]/50 resize-none max-h-32 placeholder:text-[#A1A1A1]"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="w-14 h-14 rounded-[20px] bg-[#C9A84C] flex items-center justify-center text-white disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-[#C9A84C]/20"
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
