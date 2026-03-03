export interface Word {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: Word[];
  speaker?: string;
  globalStartIndex: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface DeletedRange extends TimeRange {
  id: string;
  wordIndices: number[];
}

export interface ProjectFile {
  version: 1;
  videoPath: string;
  words: Word[];
  segments: Segment[];
  deletedRanges: DeletedRange[];
  language: string;
  createdAt: string;
  modifiedAt: string;
}

export interface TranscriptionResult {
  words: Word[];
  segments: Segment[];
  language: string;
}

export interface ExportOptions {
  outputPath: string;
  mode: 'fast' | 'reencode';
  resolution: '720p' | '1080p' | '4k';
  format: 'mp4' | 'mov' | 'webm';
  enhanceAudio: boolean;
  captions: 'none' | 'burn-in' | 'sidecar';
  captionStyle?: CaptionStyle;
}

export interface CaptionStyle {
  fontName: string;
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  position: 'bottom' | 'top' | 'center';
  bold: boolean;
}

export type AIProvider = 'ollama' | 'openai' | 'claude';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface FillerWordResult {
  wordIndices: number[];
  fillerWords: Array<{ index: number; word: string; reason: string }>;
}

export interface ClipSuggestion {
  title: string;
  startWordIndex: number;
  endWordIndex: number;
  startTime: number;
  endTime: number;
  reason: string;
}
