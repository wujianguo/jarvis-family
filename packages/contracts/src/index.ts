import { z } from "zod"

export const pickupInput = z.object({
  rawInfo: z.string().trim().max(4000).optional().nullable(),
  address: z.string().trim().min(1).max(200),
  pickupCode: z.string().trim().min(1).max(80),
  recipientName: z.string().trim().max(80).optional().nullable(),
})
export const pickupPatch = pickupInput
  .partial()
  .refine((v) => Object.keys(v).length > 0)
export const smsInput = z.object({
  content: z.string().trim().min(1).max(4000),
  sender: z.string().trim().max(160).optional(),
  receivedAt: z.iso.datetime({ offset: true }).optional(),
  device: z.string().trim().min(1).max(160),
  clientEventId: z.string().trim().min(1).max(128).optional(),
})
type WhitelistIdentity = {
  email?: string | null
  wechatAppId?: string | null
  wechatOpenId?: string | null
  wechatUnionId?: string | null
}

export const hasWhitelistIdentity = (v: WhitelistIdentity) =>
  !!(v.email || (v.wechatAppId && v.wechatOpenId) || v.wechatUnionId)

const whitelistFields = z.object({
  email: z.email().optional(),
  wechatAppId: z.string().optional(),
  wechatOpenId: z.string().optional(),
  wechatUnionId: z.string().optional(),
  displayName: z.string().trim().min(1).max(80),
  role: z.enum(["ADMIN", "MEMBER"]),
  enabled: z.boolean(),
})
export const whitelistInput = whitelistFields
  .extend({
    role: whitelistFields.shape.role.default("MEMBER"),
    enabled: whitelistFields.shape.enabled.default(true),
  })
  .refine(hasWhitelistIdentity)
export const whitelistPatch = whitelistFields
  .partial()
  .refine((v) => Object.keys(v).length > 0)
