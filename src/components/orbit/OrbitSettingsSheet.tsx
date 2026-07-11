import React from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MOOD_META, MoodStatus } from '../../lib/mock/mockOrbit';
import type { OrbitSettings, RadiusKm, AgeFilter, FemaleSafetyMode } from '../../hooks/useOrbit';

interface Props {
  open: boolean;
  settings: OrbitSettings;
  onClose: () => void;
  onUpdate: (patch: Partial<OrbitSettings>) => void;
}

const RADIUS_OPTIONS: RadiusKm[] = [1, 5, 10, 25, 50];
const PRESENCE_OPTIONS: { value: OrbitSettings['presence']; label: string }[] = [
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hour' },
  { value: '3h', label: '3 hours' },
  { value: 'always', label: 'Always' },
];
const AGE_OPTIONS: { value: AgeFilter; label: string }[] = [
  { value: 'all', label: 'All ages' },
  { value: '18-25', label: '18–25' },
  { value: '25-35', label: '25–35' },
  { value: '35-45', label: '35–45' },
];
const SAFETY_OPTIONS: { value: FemaleSafetyMode; label: string; desc: string }[] = [
  { value: 'off', label: 'Off', desc: 'Default visibility' },
  { value: 'women_only', label: 'Women only', desc: 'Only see and be seen by women' },
  { value: 'verified_only', label: 'Verified users only', desc: 'Hide unverified accounts' },
  { value: 'nobody_first', label: 'Nobody can message first', desc: 'You must send the first icebreaker' },
];

export function OrbitSettingsSheet({ open, settings, onClose, onUpdate }: Props) {
  const [isSaving, setIsSaving] = React.useState(false);

  const handleUpdate = async (patch: Partial<OrbitSettings>) => {
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      onUpdate(patch);
    } catch (err) {
      console.error("Failed to update settings", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && <motion.div
        className="fixed inset-0 bg-black/60 z-[200] flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass-panel fixed inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-lg">Orbit settings</h3>
              {isSaving && (
                <div className="w-3.5 h-3.5 rounded-full border border-t-transparent border-[#00F0FF] animate-spin" />
              )}
            </div>
            <button onClick={onClose} className="p-1 text-white/50">
              <X className="w-5 h-5" />
            </button>
          </div>

          <Section title="Discovery radius">
            <div className="flex gap-2 flex-wrap">
              {RADIUS_OPTIONS.map((km) => (
                <Pill
                  key={km}
                  active={settings.radiusKm === km}
                  onClick={() => handleUpdate({ radiusKm: km })}
                  label={`${km} km`}
                />
              ))}
            </div>
          </Section>

          <Section title="Mood status">
            <div className="flex flex-col gap-2">
              {(Object.keys(MOOD_META) as MoodStatus[]).map((mood) => (
                <button
                  key={mood}
                  onClick={() => handleUpdate({ mood })}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition ${
                    settings.mood === mood
                      ? 'border-neon-purple bg-neon-purple/10'
                      : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <span>{MOOD_META[mood].emoji}</span>
                  <span className="text-sm text-white">{MOOD_META[mood].label}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Appear orbit for">
            <div className="flex gap-2 flex-wrap">
              {PRESENCE_OPTIONS.map((opt) => (
                <Pill
                  key={opt.value}
                  active={settings.presence === opt.value}
                  onClick={() => handleUpdate({ presence: opt.value })}
                  label={opt.label}
                />
              ))}
            </div>
            <p className="text-[11px] text-white/30 mt-2">
              You disappear from Orbit automatically after this time.
            </p>
          </Section>

          <Section title="Age filter">
            <div className="flex gap-2 flex-wrap">
              {AGE_OPTIONS.map((opt) => (
                <Pill
                  key={opt.value}
                  active={settings.ageFilter === opt.value}
                  onClick={() => handleUpdate({ ageFilter: opt.value })}
                  label={opt.label}
                />
              ))}
            </div>
          </Section>

          <Section title="Female safety mode">
            <div className="flex flex-col gap-2">
              {SAFETY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleUpdate({ femaleSafetyMode: opt.value })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    settings.femaleSafetyMode === opt.value
                      ? 'border-neon-purple bg-neon-purple/10'
                      : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <p className="text-sm font-bold text-white">{opt.label}</p>
                  <p className="text-[11px] text-white/40">{opt.desc}</p>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Account verification">
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-white/10 bg-white/[0.02]">
              <ShieldCheck className={`w-4 h-4 ${settings.isVerified ? 'text-neon-blue' : 'text-white/30'}`} />
              <span className="text-sm text-white flex-1">
                {settings.isVerified ? 'Verified account' : 'Not verified'}
              </span>
              <button
                onClick={() => handleUpdate({ isVerified: !settings.isVerified })}
                className="text-[11px] font-bold text-neon-blue"
              >
                {settings.isVerified ? 'Unverify (test)' : 'Mock verify'}
              </button>
            </div>
            <p className="text-[11px] text-white/30 mt-2">
              Verified accounts get more daily requests and pass "verified only" filters.
            </p>
          </Section>
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">{title}</p>
      {children}
    </div>
  );
}

function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
        active
          ? 'bg-gradient-to-r from-neon-purple to-neon-blue text-black border-transparent'
          : 'border-white/10 text-white/60'
      }`}
    >
      {label}
    </button>
  );
}
