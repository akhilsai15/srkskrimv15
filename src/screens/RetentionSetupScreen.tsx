import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { RetentionSettingsPanel } from '../components/RetentionSettingsPanel';
import { useRetentionStore } from '../store/retentionStore';
import { DEFAULT_RETENTION_SETTINGS, RetentionSettings, RetentionCategory, RetentionDurationDays } from '../lib/dataRetention';

interface Props {
  onComplete: () => void;
}

export default function RetentionSetupScreen({ onComplete }: Props) {
  const { completeOnboarding } = useRetentionStore();
  const [draft, setDraft] = useState<RetentionSettings>({ ...DEFAULT_RETENTION_SETTINGS });

  const handleChange = (category: RetentionCategory, duration: RetentionDurationDays) => {
    setDraft(prev => ({ ...prev, [category]: duration }));
  };

  const handleContinue = () => {
    completeOnboarding(draft);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9998] bg-[#0A0A0A] flex flex-col">
      <div className="overflow-y-auto flex-1 px-5 pt-10 pb-28 flex flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center gap-3"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#B026FF] to-[#00F0FF] flex items-center justify-center shadow-[0_0_30px_rgba(176,38,255,0.4)]">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">Set up Data Retention</h1>
          <p className="text-white/50 text-sm max-w-sm">
            Choose how long each type of your content is kept before it's automatically deleted. You can change these anytime later in Settings.
          </p>
        </motion.div>

        <RetentionSettingsPanel settings={draft} onChange={handleChange} />
      </div>

      <div className="shrink-0 p-5 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent">
        <button
          onClick={handleContinue}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#B026FF] to-[#00F0FF] text-white font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_0_25px_rgba(176,38,255,0.35)]"
        >
          Continue <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
