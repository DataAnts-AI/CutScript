import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProvider, AIProviderConfig, FillerWordResult, ClipSuggestion } from '../types/project';

const ENCRYPTED_KEY_PREFIX = 'aive_enc_';

interface AIState {
  providers: Record<AIProvider, AIProviderConfig>;
  defaultProvider: AIProvider;
  customFillerWords: string;
  fillerResult: FillerWordResult | null;
  clipSuggestions: ClipSuggestion[];
  isProcessing: boolean;
  processingMessage: string;
  _keysHydrated: boolean;
}

interface AIActions {
  setProviderConfig: (provider: AIProvider, config: Partial<AIProviderConfig>) => void;
  setDefaultProvider: (provider: AIProvider) => void;
  setCustomFillerWords: (words: string) => void;
  setFillerResult: (result: FillerWordResult | null) => void;
  setClipSuggestions: (suggestions: ClipSuggestion[]) => void;
  setProcessing: (active: boolean, message?: string) => void;
  hydrateKeys: () => Promise<void>;
}

async function encryptAndStore(key: string, value: string): Promise<void> {
  if (!value) {
    localStorage.removeItem(ENCRYPTED_KEY_PREFIX + key);
    return;
  }
  if (window.electronAPI) {
    const encrypted = await window.electronAPI.encryptString(value);
    localStorage.setItem(ENCRYPTED_KEY_PREFIX + key, encrypted);
  } else {
    localStorage.setItem(ENCRYPTED_KEY_PREFIX + key, btoa(value));
  }
}

async function loadAndDecrypt(key: string): Promise<string> {
  const stored = localStorage.getItem(ENCRYPTED_KEY_PREFIX + key);
  if (!stored) return '';
  if (window.electronAPI) {
    try {
      return await window.electronAPI.decryptString(stored);
    } catch {
      return '';
    }
  }
  try {
    return atob(stored);
  } catch {
    return '';
  }
}

export const useAIStore = create<AIState & AIActions>()(
  persist(
    (set, get) => ({
      providers: {
        ollama: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'llama3' },
        openai: { provider: 'openai', apiKey: '', model: 'gpt-4o' },
        claude: { provider: 'claude', apiKey: '', model: 'claude-sonnet-4-20250514' },
      },
      defaultProvider: 'ollama',
      customFillerWords: '',
      fillerResult: null,
      clipSuggestions: [],
      isProcessing: false,
      processingMessage: '',
      _keysHydrated: false,

      setProviderConfig: (provider, config) => {
        set((state) => ({
          providers: {
            ...state.providers,
            [provider]: { ...state.providers[provider], ...config },
          },
        }));

        if (config.apiKey !== undefined) {
          encryptAndStore(`${provider}_apiKey`, config.apiKey);
        }
      },

      setDefaultProvider: (provider) => set({ defaultProvider: provider }),

      setCustomFillerWords: (words) => set({ customFillerWords: words }),

      setFillerResult: (result) => set({ fillerResult: result }),

      setClipSuggestions: (suggestions) => set({ clipSuggestions: suggestions }),

      setProcessing: (active, message) =>
        set({ isProcessing: active, processingMessage: message ?? '' }),

      hydrateKeys: async () => {
        const [openaiKey, claudeKey] = await Promise.all([
          loadAndDecrypt('openai_apiKey'),
          loadAndDecrypt('claude_apiKey'),
        ]);
        const state = get();
        set({
          providers: {
            ...state.providers,
            openai: { ...state.providers.openai, apiKey: openaiKey },
            claude: { ...state.providers.claude, apiKey: claudeKey },
          },
          _keysHydrated: true,
        });
      },
    }),
    {
      name: 'aive-ai-settings',
      partialize: (state) => ({
        providers: {
          ollama: { ...state.providers.ollama, apiKey: undefined },
          openai: { ...state.providers.openai, apiKey: '' },
          claude: { ...state.providers.claude, apiKey: '' },
        },
        defaultProvider: state.defaultProvider,
        customFillerWords: state.customFillerWords,
      }),
    },
  ),
);

useAIStore.getState().hydrateKeys();
