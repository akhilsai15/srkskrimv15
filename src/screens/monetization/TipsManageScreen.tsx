import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Pencil } from 'lucide-react';
import { TIPS_CONFIG } from '../../lib/mock/monetizationMockData';
import { apiClient } from '../../lib/apiClient';

export default function TipsManageScreen() {
  const navigate = useNavigate();
  const [active, setActive] = useState(TIPS_CONFIG.active);
  const [amounts, setAmounts] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activeFlag = true;
    const fetchTips = async () => {
      setLoading(true);
      setError(null);
      try {
        await apiClient.get('/skrimchat-monetization/tips');
        if (activeFlag) {
          setActive(TIPS_CONFIG.active);
          setAmounts(TIPS_CONFIG.suggestedAmounts);
          setMessage(TIPS_CONFIG.message);
        }
      } catch (err: any) {
        console.warn("Real-time tips API is offline:", err);
        if (activeFlag) {
          setActive(TIPS_CONFIG.active);
          setAmounts(TIPS_CONFIG.suggestedAmounts);
          setMessage(TIPS_CONFIG.message);
        }
      } finally {
        if (activeFlag) setLoading(false);
      }
    };
    fetchTips();
    return () => { activeFlag = false; };
  }, []);

  const removeAmount = (i: number) => setAmounts((a) => a.filter((_, idx) => idx !== i));
  const addAmount = () => {
    if (amounts.length >= 5) return;
    setAmounts((a) => [...a, 25]);
  };
  const saveEdit = (i: number) => {
    const n = parseInt(editValue);
    if (!isNaN(n) && n > 0) setAmounts((a) => a.map((v, idx) => (idx === i ? n : v)));
    setEditingIdx(null);
  };

  return (
    <div className="w-full h-full flex flex-col bg-black text-white overflow-hidden">
      <header className="px-4 pt-6 pb-4 sticky top-0 bg-[#05050A]/95 backdrop-blur-md z-40 border-b border-white/5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/monetization')} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-white/60">
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold tracking-widest uppercase">⭐ Creator Tips</h1>
          <div className="w-9" />
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-neon-purple animate-spin mb-4" />
          <p className="text-sm text-gray-500 font-mono tracking-wider">RETRIEVING CREATOR TIPS CONFIG...</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-red-400 font-bold mb-2">Sync Error</p>
          <p className="text-white/60 text-xs mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-neon-purple text-white font-bold rounded-xl text-xs">Retry</button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-24 flex flex-col gap-6">
        {/* Master toggle */}
        <div className="bg-skrim-surface rounded-2xl border border-white/5 p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-sm">Creator Tips</p>
            <p className="text-[11px] text-gray-500">{active ? 'Fans can send you tips' : 'Tips are turned off'}</p>
          </div>
          <button
            onClick={() => setActive(!active)}
            className={`w-12 h-7 rounded-full p-1 transition-colors ${active ? 'bg-neon-purple' : 'bg-white/10'}`}
          >
            <motion.div animate={{ x: active ? 20 : 0 }} className="w-5 h-5 bg-white rounded-full" />
          </button>
        </div>

        {/* Suggested amounts */}
        <div>
          <h3 className="text-xs font-bold uppercase text-gray-400 mb-3">Suggested Tip Amounts</h3>
          <div className="flex flex-wrap gap-2">
            {amounts.map((amt, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-skrim-surface border border-white/10 rounded-full pl-3 pr-1.5 py-1.5">
                {editingIdx === i ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => saveEdit(i)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(i)}
                    className="w-12 bg-transparent text-sm font-bold text-white outline-none"
                  />
                ) : (
                  <button onClick={() => { setEditingIdx(i); setEditValue(String(amt)); }} className="text-sm font-bold text-white flex items-center gap-1">
                    ₹{amt} <Pencil className="w-3 h-3 text-gray-500" />
                  </button>
                )}
                <button onClick={() => removeAmount(i)} className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-gray-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {amounts.length < 5 && (
              <button onClick={addAmount} className="w-9 h-9 rounded-full bg-skrim-surface border border-white/10 flex items-center justify-center text-gray-400">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tip message */}
        <div>
          <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">Tip Message</h3>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Shown to fans before they tip you"
            className="w-full bg-skrim-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none"
            rows={2}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="This month" value={`₹${TIPS_CONFIG.monthEarned.toLocaleString()}`} />
          <Stat label="Tips" value={String(TIPS_CONFIG.monthCount)} />
          <Stat label="Avg tip" value={`₹${TIPS_CONFIG.avgTip}`} />
        </div>

        {/* Top tippers */}
        <div>
          <h3 className="text-xs font-bold uppercase text-gray-400 mb-3">Top Tippers</h3>
          <div className="bg-skrim-surface rounded-2xl border border-white/5 p-4 flex flex-col gap-3">
            {TIPS_CONFIG.topTippers.map((t) => (
              <div key={t.name} className="flex items-center gap-3">
                <img src={t.avatar || null} alt="" className="w-9 h-9 rounded-full object-cover" />
                <span className="flex-1 text-sm font-semibold text-white">{t.name}</span>
                <span className="text-sm font-bold text-[#D4AF37]">₹{t.total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent tips feed */}
        <div>
          <h3 className="text-xs font-bold uppercase text-gray-400 mb-3">Recent Tips</h3>
          <div className="flex flex-col gap-2">
            {TIPS_CONFIG.recentTips.map((t, i) => (
              <div key={i} className="bg-skrim-surface rounded-2xl border border-white/5 p-3 flex items-center gap-3">
                <img src={t.avatar || null} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white"><span className="font-bold">{t.name}</span> tipped ₹{t.amount}</p>
                  {t.message && <p className="text-[12px] text-gray-400 truncate">"{t.message}"</p>}
                </div>
                <span className="text-[11px] text-gray-500 shrink-0">{t.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-skrim-surface rounded-2xl border border-white/5 p-3 text-center">
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[9px] text-gray-500 uppercase mt-0.5">{label}</p>
    </div>
  );
}
