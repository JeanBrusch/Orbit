"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Sparkles, CheckCircle2, AlertTriangle, MessageSquare, Heart, Bookmark, History, LayoutPanelLeft } from "lucide-react"
import { computeMatch } from "@/lib/atlas-utils"

interface CognitiveDrawerProps {
  property: any
  lead: any
  isOpen: boolean
  onClose: () => void
  isDark: boolean
}

export const CognitiveDrawer = ({ property, lead, isOpen, onClose, isDark }: CognitiveDrawerProps) => {
  const match = lead ? computeMatch(property, lead) : null
  const score = match?.scorePercentage || 0

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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
          />

          {/* Drawer Surface — Responsive: Side on Desktop, Bottom Sheet on Mobile */}
          <motion.div
            initial={{ y: "100%", x: 0 }}
            animate={{ 
               y: 0, 
               x: 0,
               transition: { type: "spring", damping: 30, stiffness: 300 } 
            }}
            exit={{ y: "100%" }}
            className={`fixed bottom-0 md:top-0 md:right-0 h-[85vh] md:h-screen w-full md:max-w-[360px] z-[100] border-t md:border-t-0 md:border-l shadow-2xl flex flex-col rounded-t-[32px] md:rounded-t-none ${
              isDark ? 'bg-[#0A0A0B] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            {/* Mobile Handle */}
            <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
               <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
            </div>

            {/* Header / Cognitive Identity */}
            <div className={`p-6 border-b shrink-0 flex items-center justify-between ${isDark ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#C9A84C]/20 text-[#C9A84C]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Intelligence Ops</h3>
                  <p className={`text-[10px] uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Core Resonance</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className={`p-2 rounded-full hover:bg-black/10 transition-colors ${isDark ? 'text-white/40' : 'text-slate-400'}`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar">
              
              {/* Match Score Architecture */}
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                   <span className={`text-[10px] font-mono uppercase tracking-widest ${isDark ? 'text-white/30' : 'text-slate-400'}`}>Resonance Score</span>
                   <span className="text-3xl font-mono font-bold" style={{ color: "#C9A84C" }}>{score}%</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="h-full bg-[#C9A84C]" 
                  />
                </div>
              </div>

              {/* Cognitive Reasons (Matches) */}
              <div className="space-y-4">
                <h4 className={`text-[10px] font-mono uppercase tracking-[0.2em] font-bold ${isDark ? 'text-white/60' : 'text-slate-500'}`}>Pontos de Ressonância</h4>
                <div className="space-y-3">
                  {match?.reasons && match.reasons.length > 0 ? (
                    match.reasons.map((reason, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-3"
                      >
                         <CheckCircle2 size={14} className="text-[#C9A84C] mt-0.5 shrink-0" />
                         <span className={`text-[12px] leading-tight ${isDark ? 'text-white/80' : 'text-slate-700'}`}>{reason}</span>
                      </motion.div>
                    ))
                  ) : (
                    <div className={`p-4 rounded-xl border border-dashed text-center text-[11px] ${isDark ? 'border-white/10 text-white/20' : 'border-slate-200 text-slate-400'}`}>
                      Nenhum match específico encontrado
                    </div>
                  )}
                </div>
              </div>

              {/* Cognitive Warnings */}
              {match?.warnings && match.warnings.length > 0 && (
                <div className="space-y-4">
                  <h4 className={`text-[10px] font-mono uppercase tracking-[0.2em] font-bold ${isDark ? 'text-orange-400/60' : 'text-orange-500'}`}>Desvios / Bloqueios</h4>
                  <div className="space-y-3">
                    {match.warnings.map((warning, i) => (
                      <div key={i} className="flex items-start gap-3">
                         <AlertTriangle size={14} className="text-orange-400 mt-0.5 shrink-0" />
                         <span className={`text-[12px] leading-tight ${isDark ? 'text-orange-200/60' : 'text-slate-700'}`}>{warning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lead Focus UI */}
              <div className={`p-5 rounded-3xl border ${isDark ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                 <h4 className={`text-[9px] font-mono uppercase tracking-widest opacity-40 mb-4 ${isDark ? 'text-white' : 'text-black'}`}>Operational Context</h4>
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#C9A84C] to-[#E8A030] flex items-center justify-center text-black font-bold shadow-xl">
                       {lead?.name?.charAt(0) || "L"}
                    </div>
                    <div>
                       <p className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{lead?.name || "Lead Anônimo"}</p>
                       <p className="text-[10px] opacity-50 uppercase tracking-tighter">Budget {lead?.budget ? `R$ ${(lead.budget/1000).toFixed(0)}k` : "N/A"}</p>
                    </div>
                 </div>
                 <button className={`w-full py-3 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-2 transition-all ${
                   isDark ? 'border-white/10 text-white hover:bg-white/5 shadow-2xl' : 'border-slate-200 text-slate-700 hover:bg-slate-100 shadow-md'
                 }`}>
                    <MessageSquare size={14} />
                    Ver Ficha do Lead
                 </button>
              </div>

              {/* Action Grid — One row on mobile for space */}
              <div className="grid grid-cols-2 gap-3 pb-6 md:pb-0">
                 <button className={`flex flex-col items-center justify-center gap-2 p-4 rounded-3xl border transition-all ${
                   isDark ? 'bg-white/2 border-white/5 hover:border-[#C9A84C]/40 text-white/60 hover:text-white' : 'bg-white border-slate-200 hover:border-[#C9A84C] text-slate-500 hover:text-slate-900'
                 }`}>
                    <Heart size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Acervo</span>
                 </button>
                 <button className={`flex flex-col items-center justify-center gap-2 p-4 rounded-3xl border transition-all ${
                   isDark ? 'bg-white/2 border-white/5 hover:border-[#C9A84C]/40 text-white/60 hover:text-white' : 'bg-white border-slate-200 hover:border-[#C9A84C] text-slate-500 hover:text-slate-900'
                 }`}>
                    <Bookmark size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Propor</span>
                 </button>
              </div>

            </div>

            {/* Operational Footer */}
            <div className={`p-6 border-t md:mt-auto ${isDark ? 'bg-black border-white/5' : 'bg-white border-slate-100'}`}>
               <div className="flex items-center justify-between text-[10px] font-mono opacity-40 uppercase tracking-widest">
                  <div className="flex items-center gap-2 text-[#C9A84C]">
                     <History size={12} />
                     <span>Sync: Active</span>
                  </div>
                  <span>Agent v4.2</span>
               </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
