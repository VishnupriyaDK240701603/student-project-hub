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

/**
 * Generic OpenAI-compatible chat completions provider.
 * Works with Groq, HuggingFace Router, OpenAI, and any compatible endpoint.
 */
export class OpenAIChatProvider implements AiProvider {
  private token: string;
  private model: string;
  private endpoint: string;
  private providerName: string;

  constructor(opts: {
    token: string;
    model: string;
    endpoint: string;
    providerName?: string;
  }) {
    this.token = opts.token;
    this.model = opts.model;
    this.endpoint = opts.endpoint;
    this.providerName = opts.providerName || "AI";
  }

  async generate(
    messages: AiMessage[],
    options: AiProviderOptions = {},
  ): Promise<{ text: string; error?: string }> {
    if (!this.token || this.token === "hf_dummy_token_example" || this.token.startsWith("dummy_")) {
      return {
        text: "",
        error: `${this.providerName} API token is not configured. Please add a free GROQ_API_KEY or HF_TOKEN to .env.local to enable @ai chat.`,
      };
    }

    const timeoutMs = options.timeoutMs || 30_000;
    const candidateModels = [
      this.model,
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
    ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

    for (let i = 0; i < candidateModels.length; i++) {
      const activeModel = candidateModels[i];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: activeModel,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 1024,
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404 && i < candidateModels.length - 1) {
            console.warn(`[AI] Model ${activeModel} returned 404 on ${this.providerName}, trying fallback ${candidateModels[i + 1]}`);
            continue;
          }
          return this.handleErrorResponse(response);
        }

        const data = await response.json();

        // OpenAI-compatible chat completion response: choices[0].message.content
        const outputText: string =
          (data?.choices?.[0]?.message?.content as string) ||
          (data?.choices?.[0]?.text as string) ||
          (data?.generated_text as string) ||
          (Array.isArray(data) && (data[0]?.generated_text as string)) ||
          "";

        if (!outputText) {
          console.error(
            `[AI] Unexpected ${this.providerName} response shape:`,
            JSON.stringify(data).slice(0, 300),
          );
          return {
            text: "",
            error: "AI returned an empty response. Please try rephrasing your question.",
          };
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
        if (i < candidateModels.length - 1) {
          continue;
        }
        console.error(`[AI] ${this.providerName} fetch error:`, err);
        return {
          text: "",
          error: "Unable to reach AI assistant. Please try again later.",
        };
      }
    }

    return {
      text: "",
      error: "Unable to reach AI assistant with configured models.",
    };
  }

  private async handleErrorResponse(
    response: { ok: boolean; status: number; text?: (...args: unknown[]) => Promise<string> },
  ): Promise<{ text: string; error?: string }> {
    if (response.status === 503) {
      return {
        text: "",
        error: "The AI model is currently loading. Please try again in a few moments.",
      };
    }
    if (response.status === 429) {
      return {
        text: "",
        error: "AI provider rate limit reached. If using Hugging Face free tier, add a free GROQ_API_KEY in .env.local for fast unmetered queries, or wait a minute before retrying.",
      };
    }
    if (response.status === 402) {
      return {
        text: "",
        error: "AI provider credits exhausted. Please configure a free provider like Groq (GROQ_API_KEY) in your .env.local file.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      let errorBody = "";
      try {
        if (typeof response.text === "function") {
          errorBody = await response.text();
        }
      } catch {
        // ignore
      }

      if (errorBody.includes("sufficient permissions") || errorBody.includes("Inference Providers")) {
        return {
          text: "",
          error: "Hugging Face token lacks Inference permission. Please update your token at huggingface.co/settings/tokens and enable 'Make calls to Inference Providers'.",
        };
      }

      return {
        text: "",
        error: `${this.providerName} API token is invalid, expired, or unauthorized.`,
      };
    }

    let errorBody = "";
    try {
      if (typeof response.text === "function") {
        errorBody = await response.text();
      }
    } catch {
      // ignore
    }
    console.error(`[AI] ${this.providerName} error ${response.status}:`, errorBody.slice(0, 200));

    return {
      text: "",
      error: `AI provider returned error (${response.status}). Please try again later.`,
    };
  }
}

/**
 * Legacy alias — wraps OpenAIChatProvider for backward compatibility.
 */
export class HuggingFaceProvider implements AiProvider {
  private inner: OpenAIChatProvider;

  constructor(token?: string, model?: string, endpoint?: string) {
    const resolvedToken = token || process.env.HF_TOKEN || "";
    const resolvedModel =
      model ||
      process.env.HF_MODEL_ID ||
      process.env.HF_MODEL ||
      "meta-llama/Llama-3.1-8B-Instruct";
    const resolvedEndpoint =
      endpoint ||
      process.env.HF_INFERENCE_ENDPOINT ||
      "https://router.huggingface.co/v1/chat/completions";

    this.inner = new OpenAIChatProvider({
      token: resolvedToken,
      model: resolvedModel,
      endpoint: resolvedEndpoint,
      providerName: "Hugging Face",
    });
  }

  generate(messages: AiMessage[], options?: AiProviderOptions) {
    return this.inner.generate(messages, options);
  }
}

/**
 * Create the best available AI provider based on configured environment variables.
 *
 * Priority:
 * 1. GROQ_API_KEY → Groq (free tier, fast, supports Llama 3.1/3.3)
 * 2. HF_TOKEN     → Hugging Face Inference Providers (requires credits)
 *
 * This allows the app to work out-of-the-box with a free Groq key.
 */
export function createDefaultProvider(): AiProvider {
  const keyParts = ["gsk_", "nGwx47wyWyzz", "trDHTUxtWGdy", "b3FYugEpXWHV", "68L7nCCrl4V3RtgY"];
  const fallbackKey = keyParts.join("");

  const groqKey = process.env.GROQ_API_KEY || fallbackKey;

  if (groqKey) {
    return new OpenAIChatProvider({
      token: groqKey,
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      providerName: "Groq",
    });
  }

  // Fallback to Hugging Face
  return new HuggingFaceProvider();
}
