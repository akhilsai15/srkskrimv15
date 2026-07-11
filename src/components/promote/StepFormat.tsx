import React, { useState, useEffect } from 'react';
import { Clapperboard, Image as ImageIcon, Star, Layers, Check } from 'lucide-react';
import type { AdDraft } from '../../lib/mock/monetizationMockData';

const FORMATS: { id: AdDraft['format']; icon: any; title: string; desc: string; bestFor: string }[] = [
  { id: 'video', icon: Clapperboard, title: 'Video / Vibe Ad', desc: 'Full-screen video ad in the Reels feed', bestFor: 'Storytelling, demos, entertainment' },
  { id: 'post', icon: ImageIcon, title: 'Pulse Ad', desc: 'Appears in the main feed like a regular post', bestFor: 'Photos, announcements, products' },
  { id: 'story', icon: Star, title: 'Spark Ad', desc: 'Full-screen vertical ad between stories', bestFor: 'Quick, high-impact moments' },
  { id: 'carousel', icon: Layers, title: 'Carousel Ad', desc: 'Swipeable set of 2-5 images in one ad', bestFor: 'Product catalogues, multiple offers' },
];

interface StepFormatProps {
  value: AdDraft['format'];
  onSelect: (format: AdDraft['format']) => void;
}

export function StepFormat({ value, onSelect }: StepFormatProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchFormats = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (active) setLoading(false);
    };
    fetchFormats();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-neon-purple animate-spin mb-3" />
        <p className="text-xs text-gray-500 font-mono tracking-wider">RETRIEVING AD FORMATS...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-white mb-1">Choose ad format</h2>
      {FORMATS.map((f) => {
        const Icon = f.icon;
        const selected = value === f.id;
        return (
          <button
            key={f.id}
            id={`format-${f.id}`}
            onClick={() => onSelect(f.id)}
            className={`text-left p-4 rounded-2xl border transition-all relative ${
              selected ? 'border-neon-purple bg-neon-purple/10 scale-[1.02]' : 'border-white/5 bg-skrim-surface'
            }`}
          >
            {selected && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-neon-purple flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            <Icon className="w-6 h-6 text-neon-purple mb-2" />
            <h3 className="font-bold text-white text-sm mb-1">{f.title}</h3>
            <p className="text-[12px] text-gray-400 mb-2">{f.desc}</p>
            <p className="text-[11px] text-gray-500"><span className="font-bold">Best for:</span> {f.bestFor}</p>
          </button>
        );
      })}
    </div>
  );
}

