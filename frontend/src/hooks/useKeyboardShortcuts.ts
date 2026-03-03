import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';

export function useKeyboardShortcuts() {
  const deleteSelectedWords = useEditorStore((s) => s.deleteSelectedWords);
  const selectedWordIndices = useEditorStore((s) => s.selectedWordIndices);

  const playbackRateRef = useRef(1);

  useEffect(() => {
    const getVideo = (): HTMLVideoElement | null => document.querySelector('video');

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const video = getVideo();

      switch (true) {
        // --- Undo / Redo ---
        case e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey: {
          e.preventDefault();
          useEditorStore.temporal.getState().redo();
          return;
        }
        case e.key === 'z' && (e.ctrlKey || e.metaKey): {
          e.preventDefault();
          useEditorStore.temporal.getState().undo();
          return;
        }

        // --- Delete / Backspace: delete selected words ---
        case e.key === 'Delete' || e.key === 'Backspace': {
          if (selectedWordIndices.length > 0) {
            e.preventDefault();
            deleteSelectedWords();
          }
          return;
        }

        // --- Space: play / pause ---
        case e.key === ' ' && !e.ctrlKey: {
          e.preventDefault();
          if (video) {
            if (video.paused) video.play();
            else video.pause();
          }
          return;
        }

        // --- J: reverse / slow down ---
        case e.key === 'j' || e.key === 'J': {
          e.preventDefault();
          if (video) {
            playbackRateRef.current = Math.max(-2, playbackRateRef.current - 0.5);
            if (playbackRateRef.current < 0) {
              // HTML5 video doesn't support negative rates natively; step back
              video.currentTime = Math.max(0, video.currentTime - 2);
            } else {
              video.playbackRate = playbackRateRef.current;
              if (video.paused) video.play();
            }
          }
          return;
        }

        // --- K: pause ---
        case e.key === 'k' || e.key === 'K': {
          e.preventDefault();
          if (video) {
            video.pause();
            playbackRateRef.current = 1;
          }
          return;
        }

        // --- L: forward / speed up ---
        case e.key === 'l' || e.key === 'L': {
          e.preventDefault();
          if (video) {
            playbackRateRef.current = Math.min(4, playbackRateRef.current + 0.5);
            video.playbackRate = Math.max(0.25, playbackRateRef.current);
            if (video.paused) video.play();
          }
          return;
        }

        // --- Arrow Left: seek back 5s ---
        case e.key === 'ArrowLeft' && !e.ctrlKey: {
          e.preventDefault();
          if (video) video.currentTime = Math.max(0, video.currentTime - 5);
          return;
        }

        // --- Arrow Right: seek forward 5s ---
        case e.key === 'ArrowRight' && !e.ctrlKey: {
          e.preventDefault();
          if (video) video.currentTime = Math.min(video.duration, video.currentTime + 5);
          return;
        }

        // --- [ mark in-point (home) ---
        case e.key === '[': {
          e.preventDefault();
          if (video) video.currentTime = 0;
          return;
        }

        // --- ] mark out-point (end) ---
        case e.key === ']': {
          e.preventDefault();
          if (video) video.currentTime = video.duration;
          return;
        }

        // --- Ctrl+S: save project ---
        case e.key === 's' && (e.ctrlKey || e.metaKey): {
          e.preventDefault();
          saveProject();
          return;
        }

        // --- Ctrl+E: export ---
        case e.key === 'e' && (e.ctrlKey || e.metaKey): {
          e.preventDefault();
          // Trigger export panel via DOM click
          const exportBtn = document.querySelector('[title="Export"]') as HTMLButtonElement;
          if (exportBtn) exportBtn.click();
          return;
        }

        // --- ?: show shortcut cheatsheet ---
        case e.key === '?' || (e.key === '/' && e.shiftKey): {
          e.preventDefault();
          toggleCheatsheet();
          return;
        }

        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelectedWords, selectedWordIndices]);
}

async function saveProject() {
  const state = useEditorStore.getState();
  if (!state.videoPath || state.words.length === 0) return;

  try {
    const projectData = {
      version: 1,
      videoPath: state.videoPath,
      words: state.words,
      segments: state.segments,
      deletedRanges: state.deletedRanges,
      language: state.language,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    const outputPath = await window.electronAPI?.saveFile({
      defaultPath: state.videoPath.replace(/\.[^.]+$/, '.aive'),
      filters: [{ name: 'CutScript Project', extensions: ['aive'] }],
    });

    if (outputPath) {
      if (window.electronAPI?.writeFile) {
        await window.electronAPI.writeFile(outputPath, JSON.stringify(projectData, null, 2));
      } else {
        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = outputPath.split(/[\\/]/).pop() || 'project.aive';
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  } catch (err) {
    console.error('Failed to save project:', err);
  }
}

let cheatsheetVisible = false;

function toggleCheatsheet() {
  const existing = document.getElementById('keyboard-cheatsheet');
  if (existing) {
    existing.remove();
    cheatsheetVisible = false;
    return;
  }

  cheatsheetVisible = true;
  const overlay = document.createElement('div');
  overlay.id = 'keyboard-cheatsheet';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);';
  overlay.onclick = () => {
    overlay.remove();
    cheatsheetVisible = false;
  };

  const shortcuts = [
    ['Space', 'Play / Pause'],
    ['J', 'Reverse / Slow down'],
    ['K', 'Pause'],
    ['L', 'Forward / Speed up'],
    ['\u2190 / \u2192', 'Seek \u00b15 seconds'],
    ['Delete', 'Delete selected words'],
    ['Ctrl+Z', 'Undo'],
    ['Ctrl+Shift+Z', 'Redo'],
    ['Ctrl+S', 'Save project'],
    ['Ctrl+E', 'Export'],
    ['?', 'This cheatsheet'],
  ];

  const rows = shortcuts
    .map(
      ([key, desc]) =>
        `<tr><td style="padding:6px 16px 6px 0;font-family:monospace;color:#818cf8;font-weight:600">${key}</td><td style="padding:6px 0;color:#e2e8f0">${desc}</td></tr>`,
    )
    .join('');

  overlay.innerHTML = `<div style="background:#1a1d27;border:1px solid #2a2d3a;border-radius:12px;padding:24px 32px;max-width:400px;" onclick="event.stopPropagation()">
    <h3 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#e2e8f0">Keyboard Shortcuts</h3>
    <table style="font-size:13px">${rows}</table>
    <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;text-align:center">Press ? or click outside to close</p>
  </div>`;

  document.body.appendChild(overlay);
}
