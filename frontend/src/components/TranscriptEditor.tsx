import { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Virtuoso } from 'react-virtuoso';
import { Trash2, RotateCcw } from 'lucide-react';

export default function TranscriptEditor() {
  const words = useEditorStore((s) => s.words);
  const segments = useEditorStore((s) => s.segments);
  const deletedRanges = useEditorStore((s) => s.deletedRanges);
  const selectedWordIndices = useEditorStore((s) => s.selectedWordIndices);
  const hoveredWordIndex = useEditorStore((s) => s.hoveredWordIndex);
  const setSelectedWordIndices = useEditorStore((s) => s.setSelectedWordIndices);
  const setHoveredWordIndex = useEditorStore((s) => s.setHoveredWordIndex);
  const deleteSelectedWords = useEditorStore((s) => s.deleteSelectedWords);
  const restoreRange = useEditorStore((s) => s.restoreRange);
  const getWordAtTime = useEditorStore((s) => s.getWordAtTime);

  const selectionStart = useRef<number | null>(null);
  const wasDragging = useRef(false);
  const virtuosoRef = useRef<any>(null);

  const deletedSet = useMemo(() => {
    const s = new Set<number>();
    for (const range of deletedRanges) {
      for (const idx of range.wordIndices) s.add(idx);
    }
    return s;
  }, [deletedRanges]);

  const selectedSet = useMemo(() => new Set(selectedWordIndices), [selectedWordIndices]);

  const [activeWordIndex, setActiveWordIndex] = useState(-1);

  useEffect(() => {
    if (words.length === 0) return;
    const interval = setInterval(() => {
      const video = document.querySelector('video') as HTMLVideoElement | null;
      if (!video) return;
      const idx = getWordAtTime(video.currentTime);
      setActiveWordIndex((prev) => (prev === idx ? prev : idx));
    }, 250);
    return () => clearInterval(interval);
  }, [words, getWordAtTime]);

  // Auto-scroll to active segment via Virtuoso
  useEffect(() => {
    if (activeWordIndex < 0 || segments.length === 0) return;
    const segIdx = segments.findIndex((seg) => {
      const start = seg.globalStartIndex ?? 0;
      return activeWordIndex >= start && activeWordIndex < start + seg.words.length;
    });
    if (segIdx >= 0 && virtuosoRef.current) {
      virtuosoRef.current.scrollIntoView({ index: segIdx, behavior: 'smooth', align: 'center' });
    }
  }, [activeWordIndex, segments]);

  const handleWordMouseDown = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      wasDragging.current = false;
      if (e.shiftKey && selectedWordIndices.length > 0) {
        const first = selectedWordIndices[0];
        const start = Math.min(first, index);
        const end = Math.max(first, index);
        const indices = [];
        for (let i = start; i <= end; i++) indices.push(i);
        setSelectedWordIndices(indices);
      } else {
        selectionStart.current = index;
        setSelectedWordIndices([index]);
      }
    },
    [selectedWordIndices, setSelectedWordIndices],
  );

  const handleWordMouseEnter = useCallback(
    (index: number) => {
      setHoveredWordIndex(index);
      if (selectionStart.current !== null) {
        wasDragging.current = true;
        const start = Math.min(selectionStart.current, index);
        const end = Math.max(selectionStart.current, index);
        const indices = [];
        for (let i = start; i <= end; i++) indices.push(i);
        setSelectedWordIndices(indices);
      }
    },
    [setHoveredWordIndex, setSelectedWordIndices],
  );

  const handleMouseUp = useCallback(() => {
    selectionStart.current = null;
  }, []);

  const handleClickOutside = useCallback(
    (e: React.MouseEvent) => {
      if (wasDragging.current) {
        wasDragging.current = false;
        return;
      }
      if ((e.target as HTMLElement).dataset.wordIndex === undefined) {
        setSelectedWordIndices([]);
      }
    },
    [setSelectedWordIndices],
  );

  const getRangeForWord = useCallback(
    (wordIndex: number) => deletedRanges.find((r) => r.wordIndices.includes(wordIndex)),
    [deletedRanges],
  );

  const renderSegment = useCallback(
    (index: number) => {
      const segment = segments[index];
      if (!segment) return null;
      return (
        <div className="mb-3 px-4">
          {segment.speaker && (
            <div className="text-xs text-editor-accent font-medium mb-1">
              {segment.speaker}
            </div>
          )}
          <p className="text-sm leading-relaxed flex flex-wrap">
            {segment.words.map((word, localIndex) => {
              const globalIndex = (segment.globalStartIndex ?? 0) + localIndex;
              const isDeleted = deletedSet.has(globalIndex);
              const isSelected = selectedSet.has(globalIndex);
              const isActive = globalIndex === activeWordIndex;
              const isHovered = globalIndex === hoveredWordIndex;
              const deletedRange = isDeleted ? getRangeForWord(globalIndex) : null;

              return (
                <span
                  key={globalIndex}
                  id={`word-${globalIndex}`}
                  data-word-index={globalIndex}
                  onMouseDown={(e) => handleWordMouseDown(globalIndex, e)}
                  onMouseEnter={() => handleWordMouseEnter(globalIndex)}
                  onMouseLeave={() => setHoveredWordIndex(null)}
                  className={`
                    relative px-[2px] py-[1px] rounded cursor-pointer transition-colors
                    ${isDeleted ? 'line-through text-editor-text-muted/40 bg-editor-word-deleted' : ''}
                    ${isSelected && !isDeleted ? 'bg-editor-word-selected text-white' : ''}
                    ${isActive && !isDeleted && !isSelected ? 'bg-editor-accent/20 text-editor-accent' : ''}
                    ${isHovered && !isDeleted && !isSelected && !isActive ? 'bg-editor-word-hover' : ''}
                  `}
                >
                  {word.word}{' '}
                  {isDeleted && isHovered && deletedRange && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        restoreRange(deletedRange.id);
                      }}
                      className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 bg-editor-surface border border-editor-border rounded text-[10px] text-editor-success whitespace-nowrap z-10"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Restore
                    </button>
                  )}
                </span>
              );
            })}
          </p>
        </div>
      );
    },
    [segments, deletedSet, selectedSet, activeWordIndex, hoveredWordIndex, handleWordMouseDown, handleWordMouseEnter, setHoveredWordIndex, getRangeForWord, restoreRange],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-editor-border shrink-0">
        <span className="text-xs text-editor-text-muted flex-1">
          {words.length} words &middot; {deletedRanges.length} cuts
        </span>
        {selectedWordIndices.length > 0 && (
          <button
            onClick={deleteSelectedWords}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-editor-danger/20 text-editor-danger rounded hover:bg-editor-danger/30 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Delete {selectedWordIndices.length} words
          </button>
        )}
      </div>

      <div
        className="flex-1 min-h-0 select-none"
        onMouseUp={handleMouseUp}
        onClick={handleClickOutside}
      >
        <Virtuoso
          ref={virtuosoRef}
          totalCount={segments.length}
          itemContent={renderSegment}
          overscan={200}
          className="h-full"
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}
