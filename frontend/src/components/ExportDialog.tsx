import { useState, useCallback, useMemo } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Download, Loader2, Zap, Cog, Info } from 'lucide-react';
import type { ExportOptions } from '../types/project';

export default function ExportDialog() {
  const { videoPath, words, deletedRanges, isExporting, exportProgress, backendUrl, setExporting, getKeepSegments } =
    useEditorStore();

  const hasCuts = deletedRanges.length > 0;

  const [options, setOptions] = useState<Omit<ExportOptions, 'outputPath'>>({
    mode: 'fast',
    resolution: '1080p',
    format: 'mp4',
    enhanceAudio: false,
    captions: 'none',
  });

  const handleExport = useCallback(async () => {
    if (!videoPath) return;

    const outputPath = await window.electronAPI?.saveFile({
      defaultPath: videoPath.replace(/\.[^.]+$/, '_edited.mp4'),
      filters: [
        { name: 'MP4', extensions: ['mp4'] },
        { name: 'MOV', extensions: ['mov'] },
        { name: 'WebM', extensions: ['webm'] },
      ],
    });
    if (!outputPath) return;

    setExporting(true, 0);
    try {
      const keepSegments = getKeepSegments();

      const deletedSet = new Set<number>();
      for (const range of deletedRanges) {
        for (const idx of range.wordIndices) deletedSet.add(idx);
      }

      const res = await fetch(`${backendUrl}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_path: videoPath,
          output_path: outputPath,
          keep_segments: keepSegments,
          words: options.captions !== 'none' ? words : undefined,
          deleted_indices: options.captions !== 'none' ? [...deletedSet] : undefined,
          ...options,
        }),
      });
      if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
      setExporting(false, 100);
    } catch (err) {
      console.error('Export error:', err);
      setExporting(false);
    }
  }, [videoPath, options, backendUrl, setExporting, getKeepSegments]);

  return (
    <div className="p-4 space-y-5">
      <h3 className="text-sm font-semibold">Export Video</h3>

      {/* Mode */}
      <fieldset className="space-y-2">
        <legend className="text-xs text-editor-text-muted font-medium">Export Mode</legend>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            active={options.mode === 'fast'}
            onClick={() => setOptions((o) => ({ ...o, mode: 'fast' }))}
            icon={<Zap className="w-4 h-4" />}
            title="Fast"
            desc="Stream copy, seconds"
          />
          <ModeCard
            active={options.mode === 'reencode'}
            onClick={() => setOptions((o) => ({ ...o, mode: 'reencode' }))}
            icon={<Cog className="w-4 h-4" />}
            title="Re-encode"
            desc="Custom quality, slower"
          />
        </div>
      </fieldset>

      {/* Resolution (only for re-encode) */}
      {options.mode === 'reencode' && (
        <SelectField
          label="Resolution"
          value={options.resolution}
          onChange={(v) => setOptions((o) => ({ ...o, resolution: v as ExportOptions['resolution'] }))}
          options={[
            { value: '720p', label: '720p (HD)' },
            { value: '1080p', label: '1080p (Full HD)' },
            { value: '4k', label: '4K (Ultra HD)' },
          ]}
        />
      )}

      {/* Format */}
      <SelectField
        label="Format"
        value={options.format}
        onChange={(v) => setOptions((o) => ({ ...o, format: v as ExportOptions['format'] }))}
        options={[
          { value: 'mp4', label: 'MP4 (H.264)' },
          { value: 'mov', label: 'MOV (QuickTime)' },
          { value: 'webm', label: 'WebM (VP9)' },
        ]}
      />

      {/* Audio enhancement */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={options.enhanceAudio}
          onChange={(e) => setOptions((o) => ({ ...o, enhanceAudio: e.target.checked }))}
          className="w-4 h-4 rounded bg-editor-surface border-editor-border accent-editor-accent"
        />
        <span className="text-xs">Enhance audio (Studio Sound)</span>
      </label>

      {/* Captions */}
      <SelectField
        label="Captions"
        value={options.captions}
        onChange={(v) => setOptions((o) => ({ ...o, captions: v as ExportOptions['captions'] }))}
        options={[
          { value: 'none', label: 'No captions' },
          { value: 'burn-in', label: 'Burn-in (permanent)' },
          { value: 'sidecar', label: 'Sidecar SRT file' },
        ]}
      />

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={isExporting || !videoPath}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-editor-accent hover:bg-editor-accent-hover disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting... {Math.round(exportProgress)}%
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export
          </>
        )}
      </button>

      {options.mode === 'fast' && !hasCuts && (
        <p className="text-[10px] text-editor-text-muted text-center">
          Fast mode uses stream copy &mdash; no quality loss, exports in seconds.
        </p>
      )}
      {options.mode === 'fast' && hasCuts && (
        <div className="flex items-start gap-1.5 p-2 bg-editor-accent/10 rounded text-[10px] text-editor-accent">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Word-level cuts require re-encoding for frame-accurate output. Export will
            automatically use re-encode mode. This takes longer but ensures your cuts are precise.
          </span>
        </div>
      )}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
        active
          ? 'border-editor-accent bg-editor-accent/10'
          : 'border-editor-border hover:border-editor-text-muted'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{title}</span>
      <span className="text-[10px] text-editor-text-muted">{desc}</span>
    </button>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-editor-text-muted font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-editor-surface border border-editor-border rounded-lg text-xs text-editor-text focus:outline-none focus:border-editor-accent"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
