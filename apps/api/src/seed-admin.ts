import { db } from "@workspace/db"
import { hashPassword } from "better-auth/crypto"

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
if (!email) throw new Error("ADMIN_EMAIL is required to seed the admin account")
const password = process.env.ADMIN_INITIAL_PASSWORD
if (!password || password.length < 8)
  throw new Error("ADMIN_INITIAL_PASSWORD must contain at least 8 characters")
await db.$transaction(async (tx) => {
  const user = await tx.user.upsert({
    where: { email },
    create: { email, name: "管理员", emailVerified: true },
    update: {},
  })
  await tx.whitelist.upsert({
    where: { email },
    create: { email, displayName: "管理员", role: "ADMIN", userId: user.id },
    update: { userId: user.id, role: "ADMIN", enabled: true },
  })
  const hashed = await hashPassword(password)
  await tx.account.upsert({
    where: {
      providerId_accountId: { providerId: "credential", accountId: user.id },
    },
    create: {
      providerId: "credential",
      accountId: user.id,
      userId: user.id,
      password: hashed,
    },
    update: { password: hashed },
  })
})
console.log("Admin account initialized")
await db.$disconnect()
