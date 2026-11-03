import { z } from "zod"

export const pickupInput = z.object({rawInfo:z.string().trim().max(4000).optional().nullable(),address:z.string().trim().min(1).max(200),pickupCode:z.string().trim().min(1).max(80),recipientName:z.string().trim().max(80).optional().nullable()})
export const pickupPatch = pickupInput.partial().refine(v=>Object.keys(v).length>0)
export const smsInput = z.object({content:z.string().trim().min(1).max(4000),sender:z.string().trim().max(160).optional(),receivedAt:z.iso.datetime({offset:true}),device:z.string().trim().min(1).max(160),clientEventId:z.string().trim().min(1).max(128).optional()})
export const whitelistInput = z.object({email:z.email().optional(),wechatAppId:z.string().optional(),wechatOpenId:z.string().optional(),wechatUnionId:z.string().optional(),displayName:z.string().trim().min(1).max(80),role:z.enum(["ADMIN","MEMBER"]).default("MEMBER"),enabled:z.boolean().default(true)}).refine(v=>!!(v.email||(v.wechatAppId&&v.wechatOpenId)||v.wechatUnionId))
