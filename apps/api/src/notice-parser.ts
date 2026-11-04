import { z } from "zod"

export type Extracted = {
  isPickup: boolean
  address?: string
  pickupCode?: string
  confidence: number
  rawText?: string
}

export type NoticeResult = Extracted & {
  ready: boolean
  reason?: "NOT_PICKUP" | "INCOMPLETE" | "AI_NOT_CONFIGURED" | "AI_FAILED"
}

const extraction = z.object({
  isPickup: z.boolean(),
  address: z.string().max(200).optional(),
  pickupCode: z.string().max(80).optional(),
  confidence: z.number().min(0).max(1),
  rawText: z.string().max(4000).optional(),
})

export function ruleExtract(content: string): Extracted | null {
  const code = content.match(
    /(?:取件码|提货码|凭码|取货码)[：:\s]*([A-Za-z0-9-]{4,30})/
  )
  const address = content.match(
    /(?:请至|到|存放在|存于|已到|放在)([^，。；;\n]{2,80}?)(?:取件|领取|，|。|；|;|$)/
  )
  if (code && address)
    return {
      isPickup: true,
      pickupCode: code[1],
      address: address[1].trim(),
      confidence: 0.8,
    }
  if (!/(快递|包裹|取件|驿站|菜鸟|丰巢)/.test(content))
    return { isPickup: false, confidence: 0.9 }
  return null
}

async function aiExtract(content: string, image?: string): Promise<Extracted> {
  const key = process.env.SMS_AI_API_KEY
  const base = process.env.SMS_AI_BASE_URL
  if (!key || !base) throw new Error("AI_NOT_CONFIGURED")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.SMS_AI_MODEL || "deepseek-flash",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "将通知分类并提取快递取件信息。只返回 JSON: isPickup(boolean), address(string), pickupCode(string), confidence(0-1), rawText(string，图片中的通知原文)。无法确认就降低置信度。",
          },
          {
            role: "user",
            content: image
              ? [
                  {
                    type: "text",
                    text: "读取图片中的通知原文并提取取件信息。",
                  },
                  { type: "image_url", image_url: { url: image } },
                ]
              : content,
          },
        ],
      }),
      signal: controller.signal,
    })
    if (!r.ok) throw new Error("AI_HTTP_ERROR")
    const raw = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return extraction.parse(
      JSON.parse(raw.choices?.[0]?.message?.content || "{}")
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function parseNotice(input: {
  content?: string
  image?: string
}): Promise<NoticeResult> {
  let out: Extracted
  try {
    if (input.image) {
      const vision = await aiExtract("", input.image)
      const text = vision.rawText?.trim() || ""
      out = (text && ruleExtract(text)) || vision
      out = {
        ...out,
        confidence: Math.min(out.confidence, vision.confidence),
        rawText: text,
      }
    } else {
      const content = input.content?.trim() || ""
      out = ruleExtract(content) || (await aiExtract(content))
      out.rawText = content
    }
  } catch (error) {
    return {
      isPickup: false,
      confidence: 0,
      rawText: input.content?.trim(),
      ready: false,
      reason:
        error instanceof Error && error.message === "AI_NOT_CONFIGURED"
          ? "AI_NOT_CONFIGURED"
          : "AI_FAILED",
    }
  }
  const address = out.address?.trim()
  const pickupCode = out.pickupCode?.trim()
  const ready =
    out.isPickup &&
    out.confidence >= 0.75 &&
    !!address &&
    !!pickupCode &&
    (!input.image || !!out.rawText) &&
    address.length <= 200 &&
    pickupCode.length <= 80
  return {
    ...out,
    address,
    pickupCode,
    ready,
    reason: ready ? undefined : out.isPickup ? "INCOMPLETE" : "NOT_PICKUP",
  }
}
