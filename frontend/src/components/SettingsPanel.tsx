import { useAIStore } from '../store/aiStore';
import { useState, useEffect } from 'react';
import type { AIProvider } from '../types/project';
import { useEditorStore } from '../store/editorStore';
import { Bot, Cloud, Brain, RefreshCw } from 'lucide-react';

export default function SettingsPanel() {
  const { providers, defaultProvider, setProviderConfig, setDefaultProvider } = useAIStore();
  const { backendUrl } = useEditorStore();
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const fetchOllamaModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch(`${backendUrl}/ai/ollama-models`);
      if (res.ok) {
        const data = await res.json();
        setOllamaModels(data.models || []);
      }
    } catch {
      setOllamaModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    fetchOllamaModels();
  }, [backendUrl]);

  const providerIcons: Record<AIProvider, React.ReactNode> = {
    ollama: <Bot className="w-4 h-4" />,
    openai: <Cloud className="w-4 h-4" />,
    claude: <Brain className="w-4 h-4" />,
  };

  const providerLabels: Record<AIProvider, string> = {
    ollama: 'Ollama (Local)',
    openai: 'OpenAI',
    claude: 'Claude (Anthropic)',
  };

  return (
    <div className="p-4 space-y-6">
      <h3 className="text-sm font-semibold">AI Settings</h3>

      {/* Default provider selector */}
      <div className="space-y-2">
        <label className="text-xs text-editor-text-muted font-medium">Default AI Provider</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(['ollama', 'openai', 'claude'] as AIProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => setDefaultProvider(p)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors text-[10px] ${
                defaultProvider === p
                  ? 'border-editor-accent bg-editor-accent/10 text-editor-accent'
                  : 'border-editor-border text-editor-text-muted hover:text-editor-text'
              }`}
            >
              {providerIcons[p]}
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Ollama settings */}
      <ProviderSection title="Ollama (Local)" icon={providerIcons.ollama}>
        <InputField
          label="Base URL"
          value={providers.ollama.baseUrl || ''}
          onChange={(v) => setProviderConfig('ollama', { baseUrl: v })}
          placeholder="http://localhost:11434"
        />
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-editor-text-muted">Model</label>
            <button
              onClick={fetchOllamaModels}
              disabled={loadingModels}
              className="text-[10px] text-editor-accent hover:underline flex items-center gap-0.5"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${loadingModels ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {ollamaModels.length > 0 ? (
            <select
              value={providers.ollama.model}
              onChange={(e) => setProviderConfig('ollama', { model: e.target.value })}
              className="w-full px-3 py-2 bg-editor-surface border border-editor-border rounded-lg text-xs text-editor-text focus:outline-none focus:border-editor-accent"
            >
              {ollamaModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <InputField
              label=""
              value={providers.ollama.model}
              onChange={(v) => setProviderConfig('ollama', { model: v })}
              placeholder="llama3"
            />
          )}
        </div>
      </ProviderSection>

      {/* OpenAI settings */}
      <ProviderSection title="OpenAI" icon={providerIcons.openai}>
        <InputField
          label="API Key"
          value={providers.openai.apiKey || ''}
          onChange={(v) => setProviderConfig('openai', { apiKey: v })}
          placeholder="sk-..."
          type="password"
        />
        <InputField
          label="Model"
          value={providers.openai.model}
          onChange={(v) => setProviderConfig('openai', { model: v })}
          placeholder="gpt-4o"
        />
      </ProviderSection>

      {/* Claude settings */}
      <ProviderSection title="Claude (Anthropic)" icon={providerIcons.claude}>
        <InputField
          label="API Key"
          value={providers.claude.apiKey || ''}
          onChange={(v) => setProviderConfig('claude', { apiKey: v })}
          placeholder="sk-ant-..."
          type="password"
        />
        <InputField
          label="Model"
          value={providers.claude.model}
          onChange={(v) => setProviderConfig('claude', { model: v })}
          placeholder="claude-sonnet-4-20250514"
        />
      </ProviderSection>
    </div>
  );
}

function ProviderSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 p-3 bg-editor-surface rounded-lg">
      <div className="flex items-center gap-2 text-xs font-medium">
        {icon}
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      {label && <label className="text-xs text-editor-text-muted">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-editor-bg border border-editor-border rounded-lg text-xs text-editor-text placeholder:text-editor-text-muted/50 focus:outline-none focus:border-editor-accent"
      />
    </div>
  );
}
