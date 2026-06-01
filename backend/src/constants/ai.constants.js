export const aiProviders = {
  OPENAI: "OPENAI",
  NVIDIA_NIM: "NVIDIA_NIM",
  DEEPSEEK: "DEEPSEEK",
  OPENAI_COMPATIBLE: "OPENAI_COMPATIBLE",
  HEURISTIC: "HEURISTIC"
};

export const aiProviderLabels = {
  OPENAI: "OpenAI",
  NVIDIA_NIM: "NVIDIA NIM",
  DEEPSEEK: "DeepSeek",
  OPENAI_COMPATIBLE: "AI provider",
  HEURISTIC: "Built-in heuristics"
};

export function resolveAiProviderFromBaseUrl(baseUrl) {
  if (!baseUrl) {
    return aiProviders.OPENAI;
  }

  const normalized = String(baseUrl).toLowerCase();

  if (normalized.includes("nvidia.com")) {
    return aiProviders.NVIDIA_NIM;
  }

  if (normalized.includes("deepseek")) {
    return aiProviders.DEEPSEEK;
  }

  return aiProviders.OPENAI_COMPATIBLE;
}

export const aiAnalysisStatuses = ["COMPLETED", "FAILED"];

export const aiApplicableFields = [
  "title",
  "summary",
  "category",
  "priority",
  "assigned_department",
  "tags",
  "suggested_action"
];

export const aiPromptVersion = "incident-analysis-v1";
