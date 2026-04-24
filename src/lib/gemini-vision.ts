/**
 * Gemini 2.5 Flash-Lite vision service — replacement for OpenAI Vision.
 * Used for OCR of invoices, delivery notes, statements, and price lists.
 *
 * Supports both text-only and multimodal (image + PDF) calls.
 * Gemini handles PDFs natively — no rasterization or Files API needed.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'

export const GEMINI_MODEL = 'gemini-2.5-flash-lite' as const

/** Cost per 1M tokens (USD) — Gemini 2.5 Flash-Lite. */
export const GEMINI_PRICING = {
  inputPerMillion: 0.075,  // $0.075 / 1M input tokens
  outputPerMillion: 0.30,  // $0.30  / 1M output tokens
} as const

export interface GeminiUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  /** Estimated cost in USD based on GEMINI_PRICING. */
  estimatedCostUsd: number
}

export interface GeminiResult {
  text: string
  usage: GeminiUsage
}

/** Thrown when GEMINI_API_KEY is missing from the environment. */
export class GeminiConfigurationError extends Error {
  override name = 'GeminiConfigurationError'
  constructor() {
    super("GEMINI_API_KEY non configurata: impossibile eseguire l'estrazione OCR con Gemini.")
  }
}

/** Thrown on transient API failures (rate-limit, timeout, 5xx). */
export class GeminiTransientError extends Error {
  override name = 'GeminiTransientError'
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
    super(message)
  }
}

// ─── Internals ────────────────────────────────────────────────────────────────

function getModel(systemPrompt: string, maxOutputTokens: number) {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new GeminiConfigurationError()
  const genAI = new GoogleGenerativeAI(key)
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens, temperature: 0 },
  })
}

function buildUsage(
  meta:
    | {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
      }
    | undefined,
): GeminiUsage {
  const input = meta?.promptTokenCount ?? 0
  const output = meta?.candidatesTokenCount ?? 0
  const total = meta?.totalTokenCount ?? input + output
  const cost =
    (input / 1_000_000) * GEMINI_PRICING.inputPerMillion +
    (output / 1_000_000) * GEMINI_PRICING.outputPerMillion
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: total,
    estimatedCostUsd: Math.round(cost * 1_000_000) / 1_000_000,
  }
}

export function isTransientGeminiError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  const status = (err as { status?: number }).status
  if (status === 429 || (typeof status === 'number' && status >= 500)) return true
  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('quota') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Text-only generation: for PDFs with embedded text, email bodies, plain-text inputs.
 */
export async function geminiGenerateText(
  systemPrompt: string,
  userContent: string,
  maxOutputTokens = 600,
): Promise<GeminiResult> {
  const model = getModel(systemPrompt, maxOutputTokens)
  try {
    const result = await model.generateContent(userContent)
    return {
      text: result.response.text(),
      usage: buildUsage(result.response.usageMetadata),
    }
  } catch (err) {
    if (isTransientGeminiError(err)) {
      throw new GeminiTransientError(
        `Gemini text: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
    throw err
  }
}

/**
 * Vision generation: supports images AND PDFs natively (no rasterization needed).
 *
 * @param mimeType  e.g. 'image/jpeg', 'image/png', 'image/webp', 'application/pdf'
 * @param base64Data  base64-encoded file bytes
 * @param textPrompt  extra text to send alongside the document
 */
export async function geminiGenerateVision(
  systemPrompt: string,
  mimeType: string,
  base64Data: string,
  textPrompt: string,
  maxOutputTokens = 600,
): Promise<GeminiResult> {
  const model = getModel(systemPrompt, maxOutputTokens)
  try {
    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: textPrompt },
    ])
    return {
      text: result.response.text(),
      usage: buildUsage(result.response.usageMetadata),
    }
  } catch (err) {
    if (isTransientGeminiError(err)) {
      throw new GeminiTransientError(
        `Gemini vision (${mimeType}): ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
    throw err
  }
}
