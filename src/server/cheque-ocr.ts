import { parsedChequeSchema, type ParsedCheque } from "@/schemas/cheques";

const DEFAULT_MODEL = "gpt-4o-mini";

export function getChequeOcrModel(): string {
  return process.env.CHEQUE_OCR_MODEL?.trim() || DEFAULT_MODEL;
}

export function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return key;
}

export async function parseChequeImage(
  base64: string,
  mimeType: string,
): Promise<ParsedCheque | null> {
  const apiKey = getOpenAIKey();
  const model = getChequeOcrModel();

  const body = {
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract fields from a cheque image. Return ONLY a JSON object with keys: chequeNo, bankName, amount, chequeDate, payee. Use null when unknown. amount is the numeric value as a plain decimal string (no currency). chequeDate is ISO YYYY-MM-DD. chequeNo is the cheque number as printed.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract the cheque fields from this image." },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const validated = parsedChequeSchema.safeParse(parsed);
  if (!validated.success) return null;
  return validated.data;
}
