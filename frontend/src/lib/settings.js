// Local-only settings (API keys, provider) — stored on the user's device.
// These never leave the browser except as the per-call header to our backend proxy.

const KEY = "mindmapper.apiKey.v1";

const PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    prefix: "sk-ant-",
    // Where to sign up + generate a key. These deep-links save new users a
    // couple of clicks — critical because every extra click is a drop-off.
    signupUrl: "https://console.anthropic.com/settings/keys",
    label: "Get a Claude key",
    hint: "Best for long research, PDFs, nuanced reasoning.",
  },
  {
    id: "openai",
    name: "OpenAI",
    prefix: "sk-",
    signupUrl: "https://platform.openai.com/api-keys",
    label: "Get an OpenAI key",
    hint: "Widest ecosystem. Use gpt-4o or gpt-4o-mini for best value.",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    prefix: "",
    signupUrl: "https://aistudio.google.com/apikey",
    label: "Get a Gemini key",
    hint: "Generous free tier. gemini-2.5-flash is fast and cheap.",
  },
];

export const getProviders = () => PROVIDERS;

export const getApiKey = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null; // { provider, key }
  } catch {
    return null;
  }
};

export const setApiKey = ({ provider, key }) => {
  const entry = { provider, key };
  localStorage.setItem(KEY, JSON.stringify(entry));
  // Notify gauge / settings panel that the active key changed.
  try { window.dispatchEvent(new CustomEvent("mindmapper:apikey-changed")); } catch { /* ignore */ }
  return entry;
};

export const clearApiKey = () => {
  localStorage.removeItem(KEY);
  try { window.dispatchEvent(new CustomEvent("mindmapper:apikey-changed")); } catch { /* ignore */ }
};

export const maskKey = (k) => {
  if (!k) return "";
  if (k.length <= 10) return "•".repeat(k.length);
  return `${k.slice(0, 6)}${"•".repeat(Math.max(4, k.length - 10))}${k.slice(-4)}`;
};

// ---------- Research Assistant persona config ----------
const RESEARCH_KEY = "mindmapper.research.v1";

const RESEARCH_DEFAULTS = {
  persona: "",
  audience: "curious generalist",
  depth: "balanced", // "concise" | "balanced" | "deep"
};

export const getResearchConfig = () => {
  try {
    const raw = localStorage.getItem(RESEARCH_KEY);
    if (!raw) return { ...RESEARCH_DEFAULTS };
    return { ...RESEARCH_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...RESEARCH_DEFAULTS };
  }
};

export const setResearchConfig = (patch) => {
  const next = { ...getResearchConfig(), ...patch };
  localStorage.setItem(RESEARCH_KEY, JSON.stringify(next));
  return next;
};
