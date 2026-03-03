import { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { ZoomIn, ZoomOut, AlertTriangle } from 'lucide-react';

export default function WaveformTimeline() {
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const headCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const videoUrl = useEditorStore((s) => s.videoUrl);
  const videoPath = useEditorStore((s) => s.videoPath);
  const duration = useEditorStore((s) => s.duration);
  const deletedRanges = useEditorStore((s) => s.deletedRanges);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const zoomRef = useRef(1);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!videoUrl || !videoPath) return;
    setAudioError(null);

    const loadAudio = async () => {
      try {
        const ctx = new AudioContext();
        audioContextRef.current = ctx;

        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioBufferRef.current = audioBuffer;
        drawStaticWaveform();
      } catch (err) {
        console.warn('Could not decode audio for waveform:', err);
        setAudioError('Waveform unavailable — audio could not be decoded');
      }
    };

    loadAudio();

    return () => {
      audioContextRef.current?.close();
    };
  }, [videoUrl, videoPath]);

  const drawStaticWaveform = useCallback(() => {
    const canvas = waveCanvasRef.current;
    const buffer = audioBufferRef.current;
    if (!canvas || !buffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const channelData = buffer.getChannelData(0);
    const samplesPerPixel = Math.floor(channelData.length / width);

    ctx.clearRect(0, 0, width, height);

    for (const range of deletedRanges) {
      const x1 = (range.start / buffer.duration) * width;
      const x2 = (range.end / buffer.duration) * width;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.fillRect(x1, 0, x2 - x1, height);
    }

    const mid = height / 2;
    ctx.beginPath();
    ctx.strokeStyle = '#4a4d5e';
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x++) {
      const start = x * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, channelData.length);

      let min = 0;
      let max = 0;
      for (let i = start; i < end; i++) {
        if (channelData[i] < min) min = channelData[i];
        if (channelData[i] > max) max = channelData[i];
      }

      const yMin = mid + min * mid * 0.9;
      const yMax = mid + max * mid * 0.9;
      ctx.moveTo(x, yMin);
      ctx.lineTo(x, yMax);
    }
    ctx.stroke();
  }, [deletedRanges]);

  // Redraw static layer when deletedRanges change
  useEffect(() => {
    drawStaticWaveform();
  }, [drawStaticWaveform]);

  // Lightweight RAF loop for playhead only -- reads video.currentTime directly,
  // never triggers React re-renders
  useEffect(() => {
    const headCanvas = headCanvasRef.current;
    const waveCanvas = waveCanvasRef.current;
    if (!headCanvas || !waveCanvas) return;

    const tick = () => {
      const ctx = headCanvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }

      const buffer = audioBufferRef.current;
      const video = document.querySelector('video') as HTMLVideoElement | null;
      const dur = buffer?.duration ?? 0;

      const dpr = window.devicePixelRatio || 1;
      const rect = headCanvas.getBoundingClientRect();
      if (headCanvas.width !== waveCanvas.width || headCanvas.height !== waveCanvas.height) {
        headCanvas.width = rect.width * dpr;
        headCanvas.height = rect.height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);

      if (dur > 0 && video) {
        const px = (video.currentTime / dur) * width;
        ctx.beginPath();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoUrl]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      drawStaticWaveform();
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [drawStaticWaveform]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!headCanvasRef.current || duration === 0) return;
      const rect = headCanvasRef.current.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const newTime = ratio * duration;
      setCurrentTime(newTime);
      const video = document.querySelector('video');
      if (video) video.currentTime = newTime;
    },
    [duration, setCurrentTime],
  );

  if (!videoUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-editor-text-muted text-xs">
        Load a video to see the waveform
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1 shrink-0">
        <span className="text-[10px] text-editor-text-muted font-medium uppercase tracking-wider">
          Timeline
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { zoomRef.current = Math.max(0.5, zoomRef.current - 0.5); drawStaticWaveform(); }}
            className="p-0.5 text-editor-text-muted hover:text-editor-text"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { zoomRef.current = Math.min(10, zoomRef.current + 0.5); drawStaticWaveform(); }}
            className="p-0.5 text-editor-text-muted hover:text-editor-text"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {audioError ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-editor-text-muted text-xs">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span>{audioError}</span>
        </div>
      ) : (
        <div className="flex-1 relative">
          <canvas ref={waveCanvasRef} className="absolute inset-0 w-full h-full" />
          <canvas
            ref={headCanvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            onClick={handleClick}
          />
        </div>
      )}
    </div>
  );
}
