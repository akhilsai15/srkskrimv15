import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RefreshCw } from 'lucide-react';

interface AudioWaveformPlayerProps {
  src: string;
  duration?: number;
  isMe?: boolean;
  barCount?: number;
  onPlayStateChange?: (playing: boolean) => void;
  className?: string;
  speedControl?: boolean;
}

export function AudioWaveformPlayer({
  src,
  duration: initialDuration,
  isMe = false,
  barCount = 40,
  onPlayStateChange,
  className = '',
  speedControl = true
}: AudioWaveformPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speedOptions = [1, 1.5, 2];

  // Helper to generate custom deterministic pseudo peaks
  const generateMockPeaks = (count: number) => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 3;
      const base = 0.2 + Math.abs(Math.sin(angle)) * 0.4;
      const noise = Math.sin(i * 1.5) * 0.15;
      return Math.max(0.15, Math.min(1.0, base + noise));
    });
  };

  // Decode audio to get real amplitude peaks
  useEffect(() => {
    if (!src) {
      setPeaks(generateMockPeaks(barCount));
      return;
    }

    let isCancelled = false;
    const loadAndDecodeAudio = async () => {
      setLoading(true);
      try {
        // Fallback for mock URLs (unsplash, picsum, etc.)
        if (src.includes('unsplash.com') || src.includes('picsum.photos') || src.includes('stock')) {
          if (!isCancelled) {
            setPeaks(generateMockPeaks(barCount));
            setLoading(false);
          }
          return;
        }

        const response = await fetch(src);
        if (!response.ok) throw new Error('Fetch failed');
        const arrayBuffer = await response.arrayBuffer();

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error('Web Audio API not supported');
        }

        const audioCtx = new AudioContextClass();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const step = Math.floor(channelData.length / barCount);
        const newPeaks: number[] = [];

        for (let i = 0; i < barCount; i++) {
          let max = 0;
          const start = i * step;
          const end = start + step;
          for (let j = start; j < end; j++) {
            const val = Math.abs(channelData[j]);
            if (val > max) {
              max = val;
            }
          }
          newPeaks.push(max);
        }

        // Normalize
        const maxPeak = Math.max(...newPeaks, 0.01);
        const normalized = newPeaks.map(p => Math.max(0.15, p / maxPeak));

        if (!isCancelled) {
          setPeaks(normalized);
          if (!duration && audioBuffer.duration) {
            setDuration(audioBuffer.duration);
          }
        }
      } catch (err) {
        console.warn('Could not decode audio data, using fallback waveform peaks:', err);
        if (!isCancelled) {
          setPeaks(generateMockPeaks(barCount));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadAndDecodeAudio();

    return () => {
      isCancelled = true;
    };
  }, [src, barCount]);

  // Audio element management
  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (!duration) {
        setDuration(audio.duration || 5);
      }
    };

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration);
        setElapsed(audio.currentTime);
      }
    };

    const handleEnded = () => {
      setPlaying(false);
      setProgress(0);
      setElapsed(0);
      audio.currentTime = 0;
      onPlayStateChange?.(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audioRef.current = null;
    };
  }, [src]);

  // Handle Play/Pause
  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      onPlayStateChange?.(false);
    } else {
      audio.playbackRate = speed;
      audio.play().then(() => {
        setPlaying(true);
        onPlayStateChange?.(true);
      }).catch((err) => {
        console.error("Audio play failed:", err);
      });
    }
  };

  // Speed cycle
  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = speedOptions.indexOf(speed);
    const next = (current + 1) % speedOptions.length;
    const nextSpeed = speedOptions[next];
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  // Seek on waveform click
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const clickProgress = Math.max(0, Math.min(1, x / bounds.width));
    audio.currentTime = clickProgress * duration;
    setProgress(clickProgress);
    setElapsed(clickProgress * duration);
  };

  // Format display time
  const displayTime = playing ? Math.ceil(duration - elapsed) : duration;
  const mins = Math.floor(displayTime / 60);
  const secs = Math.floor(displayTime % 60).toString().padStart(2, '0');

  // Styling colors
  const playBtnBg = isMe ? 'bg-white text-purple-600' : 'bg-white/20 text-white backdrop-blur-md';
  const playedBarColor = isMe ? 'bg-white' : 'bg-purple-400';
  const unplayedBarColor = isMe ? 'bg-white/30' : 'bg-white/20';

  const renderedPeaks = peaks.length > 0 ? peaks : generateMockPeaks(barCount);

  return (
    <div id={`audio_waveform_player_${src.slice(-8)}`} className={`flex flex-col p-2 min-w-[240px] ${className}`}>
      <div className="flex items-center gap-3">
        {/* Play Button */}
        <button
          onClick={togglePlay}
          className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md hover:scale-105 active:scale-95 transition-transform ${playBtnBg}`}
        >
          {playing ? <Pause size={18} className={isMe ? 'fill-current' : ''} /> : <Play size={18} className={isMe ? 'fill-current ml-0.5' : 'ml-0.5'} />}
        </button>

        {/* Waveform & Time */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div
            className="flex items-center gap-[3px] h-7 cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
            onClick={handleSeek}
          >
            {renderedPeaks.map((val: number, i: number) => {
              const isPlayed = (i / renderedPeaks.length) <= progress;
              return (
                <div
                  key={i}
                  className={`w-[3px] rounded-full transition-all duration-150 ${isPlayed ? playedBarColor : unplayedBarColor}`}
                  style={{
                    height: `${Math.max(15, val * 100)}%`,
                    transform: playing && isPlayed ? 'scaleY(1.05)' : 'scaleY(1)'
                  }}
                />
              );
            })}
          </div>
          <div className="flex justify-between items-center px-1">
            <span className="text-[11px] font-mono text-white/80 select-none">
              {mins}:{secs}
            </span>
            {speedControl && (
              <button
                onClick={cycleSpeed}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full select-none transition-all ${
                  speed === 1 ? 'bg-white/10 text-white/80' :
                  speed === 1.5 ? 'bg-white/80 text-purple-600' :
                  'bg-purple-500 text-white shadow-[0_0_8px_rgba(176,38,255,0.6)]'
                }`}
              >
                {speed}x
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
