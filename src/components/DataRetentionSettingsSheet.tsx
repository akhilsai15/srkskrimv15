import { motion } from 'framer-motion';
import { X, Timer, Info } from 'lucide-react';
import { useRetentionStore } from '../store/retentionStore';
import { RetentionSettingsPanel } from './RetentionSettingsPanel';

interface Props {
  onClose: () => void;
}

export const DataRetentionSettingsSheet = ({ onClose }: Props) => {
  const { settings, setCategoryDuration } = useRetentionStore();

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[300] backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 max-h-[90vh] bg-[#141414] rounded-t-3xl z-[301] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 overflow-hidden"
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-4 shrink-0" />

        <div className="px-6 flex justify-between items-center pb-4 shrink-0 border-b border-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Timer className="w-5 h-5 text-[#B026FF]" /> Data Retention
          </h2>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 flex flex-col gap-5 pb-10">
          <div className="flex gap-3 bg-[#B026FF]/10 border border-[#B026FF]/20 rounded-2xl p-4">
            <Info className="w-4 h-4 text-[#B026FF] shrink-0 mt-0.5" />
            <p className="text-white/60 text-xs leading-relaxed">
              Choose how long each type of content sticks around before it's automatically and permanently deleted. Changing a value only affects future deletions — it won't bring back anything already removed. 💜
            </p>
          </div>

          <RetentionSettingsPanel settings={settings} onChange={setCategoryDuration} />
        </div>
      </motion.div>
    </>
  );
};
