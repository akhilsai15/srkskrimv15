import React, { useState, useRef, useEffect } from 'react';
import { Upload, X as XIcon } from 'lucide-react';
import { USER_CONTENT, AdDraft, AD_GOALS, AdGoalId } from '../../lib/mock/monetizationMockData';
import { formatCompact } from '../../hooks/useCountUp';

interface StepCreativeProps {
  format: AdDraft['format'];
  creativeId: string | null;
  uploadedMedia: string[];
  headline: string;
  ctaText: string;
  goal: AdGoalId;
  destinationValue: string;
  onSelectCreative: (id: string) => void;
  onHeadlineChange: (text: string) => void;
  onUploadedMediaChange: (media: string[]) => void;
  onGoalChange: (goal: AdGoalId) => void;
  onDestinationChange: (value: string) => void;
  onCtaChange: (cta: string) => void;
}

const MAX_CAROUSEL_IMAGES = 5;

export function StepCreative({
  format, creativeId, uploadedMedia, headline, ctaText, goal, destinationValue,
  onSelectCreative, onHeadlineChange, onUploadedMediaChange, onGoalChange, onDestinationChange, onCtaChange,
}: StepCreativeProps) {
  const [source, setSource] = useState<'existing' | 'upload'>('existing');
  const [loading, setLoading] = useState(true);
  const [asyncUserContent, setAsyncUserContent] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCarousel = format === 'carousel';

  useEffect(() => {
    let active = true;
    const fetchContent = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (active) {
        setAsyncUserContent(USER_CONTENT);
        setLoading(false);
      }
    };
    fetchContent();
    return () => { active = false; };
  }, []);

  const filtered = asyncUserContent.filter((c) => {
    if (format === 'video') return c.type === 'reel';
    if (format === 'story') return c.type === 'story' || c.type === 'reel';
    return c.type === 'post' || c.type === 'reel';
  });

  const existingSelected = asyncUserContent.find((c) => c.id === creativeId);
  const hasUpload = uploadedMedia.length > 0;
  // What's shown in the preview: uploaded media takes priority if present, else existing content selection
  const previewThumbnail = hasUpload ? uploadedMedia[0] : existingSelected?.thumbnail;
  const previewTitle = hasUpload ? 'Your upload' : existingSelected?.title;
  const hasSelection = hasUpload || !!existingSelected;

  const goalMeta = AD_GOALS.find((g) => g.id === goal) || AD_GOALS[AD_GOALS.length - 1];

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });

  const handleFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (isCarousel) {
      const room = Math.max(0, MAX_CAROUSEL_IMAGES - uploadedMedia.length);
      const toRead = files.slice(0, room);
      const dataUrls = await Promise.all(toRead.map(readFileAsDataUrl));
      onUploadedMediaChange([...uploadedMedia, ...dataUrls]);
    } else {
      const dataUrl = await readFileAsDataUrl(files[0]);
      onUploadedMediaChange([dataUrl]);
      onSelectCreative(''); // clear any existing-content selection so upload takes priority
    }
    e.target.value = '';
  };

  const removeUploadedImage = (idx: number) => {
    onUploadedMediaChange(uploadedMedia.filter((_, i) => i !== idx));
  };

  const handleGoalSelect = (id: AdGoalId) => {
    onGoalChange(id);
    const meta = AD_GOALS.find((g) => g.id === id);
    if (meta) onCtaChange(meta.ctaDefault);
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-bold text-white">Pick your creative</h2>

      <div className="flex gap-2">
        <button
          onClick={() => setSource('existing')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold ${source === 'existing' ? 'bg-neon-purple text-white' : 'bg-skrim-surface text-gray-400'}`}
        >
          From your content
        </button>
        <button
          onClick={() => setSource('upload')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold ${source === 'upload' ? 'bg-neon-purple text-white' : 'bg-skrim-surface text-gray-400'}`}
        >
          Upload new
        </button>
      </div>

      {source === 'existing' ? (
        loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center col-span-3">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-neon-purple animate-spin mb-3" />
            <p className="text-[11px] text-gray-500 font-mono tracking-wider">RETRIEVING YOUR POSTS...</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((c) => (
              <button
                key={c.id}
                id={`creative-${c.id}`}
                onClick={() => { onSelectCreative(c.id); onUploadedMediaChange([]); }}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 ${creativeId === c.id && !hasUpload ? 'border-neon-purple' : 'border-transparent'}`}
              >
                <img src={c.thumbnail || null} alt="" className="w-full h-full object-cover" />
                {creativeId === c.id && !hasUpload && <div className="absolute inset-0 bg-neon-purple/20" />}
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={format === 'video' ? 'video/*' : 'image/*'}
            multiple={isCarousel}
            className="hidden"
            onChange={handleFilesPicked}
          />

          {isCarousel && uploadedMedia.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {uploadedMedia.map((src, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-neon-purple">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeUploadedImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"
                  >
                    <XIcon className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!isCarousel && uploadedMedia.length > 0 ? (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-neon-purple">
              {format === 'video' ? (
                <video src={uploadedMedia[0]} className="w-full h-full object-cover" controls />
              ) : (
                <img src={uploadedMedia[0]} alt="" className="w-full h-full object-cover" />
              )}
              <button
                onClick={() => removeUploadedImage(0)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center"
              >
                <XIcon className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          ) : null}

          {(isCarousel ? uploadedMedia.length < MAX_CAROUSEL_IMAGES : uploadedMedia.length === 0) && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video rounded-2xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-2 text-gray-500"
            >
              <Upload className="w-6 h-6" />
              <span className="text-xs font-semibold">
                {isCarousel ? `Tap to add image (${uploadedMedia.length}/${MAX_CAROUSEL_IMAGES})` : 'Tap to upload'}
              </span>
            </button>
          )}
        </div>
      )}

      {hasSelection && (
        <>
          {!hasUpload && existingSelected && (
            <div className="bg-skrim-surface rounded-2xl border border-white/5 p-3 flex items-center gap-3">
              <img src={existingSelected.thumbnail || null} alt="" className="w-12 h-12 rounded-xl object-cover" />
              <div>
                <p className="text-sm font-semibold text-white">{existingSelected.title}</p>
                <p className="text-[11px] text-gray-500">{formatCompact(existingSelected.views)} existing views</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">Headline (optional)</label>
            <input
              value={headline}
              onChange={(e) => onHeadlineChange(e.target.value)}
              placeholder="Add a catchy headline..."
              maxLength={60}
              className="w-full bg-skrim-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-purple/50"
            />
          </div>

          {/* Ad goal — determines the CTA button + destination field */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">What's the goal of this ad?</label>
            <div className="flex flex-wrap gap-2">
              {AD_GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleGoalSelect(g.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${goal === g.id ? 'bg-neon-purple/20 border border-neon-purple text-neon-purple' : 'bg-skrim-surface border border-white/10 text-gray-400'}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {goalMeta.destinationType !== 'none' && (
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">{goalMeta.destinationLabel}</label>
              <input
                value={destinationValue}
                onChange={(e) => onDestinationChange(e.target.value)}
                placeholder={goalMeta.placeholder}
                type={goalMeta.destinationType === 'phone' ? 'tel' : 'url'}
                className="w-full bg-skrim-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-purple/50"
              />
              <p className="text-[10px] text-gray-500 mt-1.5">
                Tapping "{ctaText}" on your ad will {goalMeta.destinationType === 'url' ? 'open this link' : 'call/message this number'}.
              </p>
            </div>
          )}

          {/* Ad preview */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-400 uppercase mb-2">Ad Preview</h4>
            <div className="bg-skrim-surface rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-3 py-2 flex items-center gap-2 border-b border-white/5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neon-purple to-neon-blue" />
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-white">@rahul_yt</p>
                  <p className="text-[9px] text-gray-500 uppercase">Sponsored</p>
                </div>
              </div>
              {previewThumbnail && <img src={previewThumbnail} alt="" className="w-full aspect-video object-cover" />}
              <div className="p-3 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-white truncate flex-1">{headline || previewTitle}</p>
                <button className="ml-2 px-3 py-1.5 bg-white/10 text-white text-[11px] font-bold rounded-lg shrink-0">{ctaText}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
