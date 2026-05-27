// Server-only helper para chamar a OpenAI Chat Completions API.
// NUNCA importar de código cliente — usa OPENAI_API_KEY do process.env.

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenAIChatResult = {
  text: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

const DEFAULT_MODEL = process.env.OPENAI_MODEL_DEFAULT || "gpt-4o-mini";

export async function openaiChat(opts: {
  messages: OpenAIMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
}): Promise<OpenAIChatResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY ausente no servidor.");
  }

  const model = opts.model || DEFAULT_MODEL;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      max_tokens: opts.max_tokens ?? 350,
      temperature: opts.temperature ?? 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[openai] erro", res.status, errText);
    throw new Error(`OpenAI retornou ${res.status}.`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    model?: string;
  };

  const text = data.choices?.[0]?.message?.content?.trim() || "";
  return {
    text,
    model: data.model || model,
    usage: {
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
      total_tokens: data.usage?.total_tokens ?? 0,
    },
  };
}
