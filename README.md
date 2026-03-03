# CutScript

An open-source, local-first, Descript-like text-based video editor powered by AI. Edit video by editing text — delete a word from the transcript and it's cut from the video.

## Architecture

- **Electron + React** desktop app with Tailwind CSS
- **FastAPI** Python backend (spawned as child process)
- **WhisperX** for word-level transcription with alignment
- **FFmpeg** for video processing (stream-copy and re-encode)
- **Ollama / OpenAI / Claude** for AI features (filler removal, clip creation)

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- FFmpeg (in PATH)
- (Optional) Ollama for local AI features

### Install

```bash
# Root dependencies (Electron, concurrently)
npm install

# Frontend dependencies (React, Tailwind, Zustand)
cd frontend && npm install && cd ..

# Backend dependencies
cd backend && pip install -r requirements.txt && cd ..
```

### Run (Development)

```bash
# Start all three (backend + frontend + electron)
npm run dev
```

Or run them separately:

```bash
# Terminal 1: Backend
cd backend && python -m uvicorn main:app --reload --port 8642

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Electron
npx electron .
```

## Project Structure

```
cutscript/
├── electron/          # Electron main process
│   ├── main.js        # App entry, spawns Python backend
│   ├── preload.js     # Secure IPC bridge
│   └── python-bridge.js
├── frontend/          # React + Vite + Tailwind
│   └── src/
│       ├── components/  # VideoPlayer, TranscriptEditor, etc.
│       ├── store/       # Zustand state (editorStore, aiStore)
│       ├── hooks/       # useVideoSync, useKeyboardShortcuts
│       └── types/       # TypeScript interfaces
├── backend/           # FastAPI Python backend
│   ├── main.py
│   ├── routers/       # API endpoints
│   ├── services/      # Core logic (transcription, editing, AI)
│   └── utils/         # GPU, cache, audio helpers
└── shared/            # Project schema
```

## Features

| Feature | Status |
|---------|--------|
| Word-level transcription (WhisperX) | Done |
| Text-based video editing | Done |
| Undo/redo | Done |
| Waveform timeline | Done |
| FFmpeg stream-copy export | Done |
| FFmpeg re-encode (up to 4K) | Done |
| AI filler word removal | Done |
| AI clip creation (Shorts) | Done |
| Ollama + OpenAI + Claude | Done |
| Word-level captions (SRT/VTT/ASS) | Done |
| Caption burn-in on export | Done |
| Studio Sound (DeepFilterNet) | Done |
| Keyboard shortcuts (J/K/L) | Done |
| Speaker diarization | Done |
| Virtualized transcript (react-virtuoso) | Done |
| Encrypted API key storage | Done |
| Project save/load (.cutscript) | Done |
| AI background removal | Planned |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| J / K / L | Reverse / Pause / Forward |
| ← / → | Seek ±5 seconds |
| Delete | Delete selected words |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+S | Save project |
| Ctrl+E | Export |
| ? | Shortcut cheatsheet |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| POST | /transcribe | Transcribe video with WhisperX |
| POST | /export | Export edited video (stream copy or re-encode) |
| POST | /ai/filler-removal | Detect filler words via LLM |
| POST | /ai/create-clip | AI-suggested clips for shorts |
| GET | /ai/ollama-models | List local Ollama models |
| POST | /captions | Generate SRT/VTT/ASS captions |
| POST | /audio/clean | Noise reduction (DeepFilterNet) |
| GET | /audio/capabilities | Check audio processing availability |

## License

MIT License — see [LICENSE](LICENSE) for details.
