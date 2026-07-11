import {
  RETENTION_CATEGORIES,
  RETENTION_DURATIONS,
  RETENTION_DURATION_LABELS,
  RetentionCategory,
  RetentionDurationDays,
  RetentionSettings,
} from '../lib/dataRetention';

interface Props {
  settings: RetentionSettings;
  onChange: (category: RetentionCategory, duration: RetentionDurationDays) => void;
}

export const RetentionSettingsPanel = ({ settings, onChange }: Props) => {
  return (
    <div className="flex flex-col gap-3">
      {RETENTION_CATEGORIES.map((cat) => (
        <div key={cat.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#B026FF]/15 flex items-center justify-center shrink-0 text-lg">
              {cat.icon}
            </div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">{cat.label}</p>
              <p className="text-white/40 text-xs">{cat.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {RETENTION_DURATIONS.map((d) => {
              const active = settings[cat.id] === d;
              return (
                <button
                  key={d}
                  onClick={() => onChange(cat.id, d)}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                    active
                      ? 'bg-[#B026FF]/20 border-[#B026FF]/50 text-[#00F0FF]'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {RETENTION_DURATION_LABELS[d]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
