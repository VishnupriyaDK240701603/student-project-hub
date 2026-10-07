export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProviderOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface AiProvider {
  generate(messages: AiMessage[], options?: AiProviderOptions): Promise<{ text: string; error?: string }>;
}

export class HuggingFaceProvider implements AiProvider {
  private token: string;
  private model: string;
  private endpoint: string;

  constructor(token?: string, model?: string, endpoint?: string) {
    this.token = token || process.env.HF_TOKEN || "";
    this.model = model || process.env.HF_MODEL || "meta-llama/Llama-3.1-8B-Instruct";
    this.endpoint = endpoint || `https://api-inference.huggingface.co/models/${this.model}`;
  }

  async generate(
    messages: AiMessage[],
    options: AiProviderOptions = {},
  ): Promise<{ text: string; error?: string }> {
    if (!this.token) {
      return {
        text: "",
        error: "Hugging Face API token is not configured.",
      };
    }

    const timeoutMs = options.timeoutMs || 15_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Build prompt or chat structure for chat models
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n"),
          parameters: {
            temperature: options.temperature ?? 0.7,
            max_new_tokens: options.maxTokens ?? 1024,
            return_full_text: false,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 503) {
          return {
            text: "",
            error: "The AI model is currently loading on Hugging Face. Please try again in a few moments.",
          };
        }
        if (response.status === 429) {
          return {
            text: "",
            error: "AI rate limit reached. Please wait a moment before trying again.",
          };
        }
        return {
          text: "",
          error: `AI provider returned error (${response.status}).`,
        };
      }

      const data = await response.json();

      let outputText = "";
      if (Array.isArray(data) && data[0]?.generated_text) {
        outputText = data[0].generated_text;
      } else if (typeof data?.generated_text === "string") {
        outputText = data.generated_text;
      } else if (typeof data === "string") {
        outputText = data;
      } else {
        outputText = JSON.stringify(data);
      }

      return { text: outputText.trim() };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        return {
          text: "",
          error: "AI request timed out. Please try again with a shorter query.",
        };
      }
      return {
        text: "",
        error: "Unable to reach AI assistant. Please try again later.",
      };
    }
  }
}
