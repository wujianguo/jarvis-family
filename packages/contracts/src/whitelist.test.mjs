import assert from "node:assert/strict"
import { test } from "node:test"
import {
  hasWhitelistIdentity,
  whitelistInput,
  whitelistPatch,
} from "./index.ts"

test("create still requires a usable identity and display name", () => {
  const base = { displayName: "Family member" }
  for (const input of [
    base,
    { ...base, wechatOpenId: "open-id" },
    { ...base, wechatAppId: "app-id" },
    { ...base, wechatAppId: "", wechatOpenId: "open-id" },
  ]) {
    assert.equal(whitelistInput.safeParse(input).success, false)
  }
  for (const identity of [
    { email: "member@example.test" },
    { wechatAppId: "app-id", wechatOpenId: "open-id" },
    { wechatUnionId: "union-id" },
  ]) {
    const result = whitelistInput.safeParse({ ...base, ...identity })
    assert.equal(result.success, true)
    assert.equal(result.data.role, "MEMBER")
    assert.equal(result.data.enabled, true)
  }
})

test("PATCH accepts bind fields and other partial updates without create defaults", () => {
  for (const input of [
    { wechatAppId: "app-id", wechatOpenId: "open-id" },
    { wechatUnionId: "union-id" },
    { email: "member@example.test" },
    { displayName: " Updated " },
    { role: "ADMIN" },
    { enabled: false },
  ]) {
    const result = whitelistPatch.safeParse(input)
    assert.equal(result.success, true)
    assert.deepEqual(Object.keys(result.data), Object.keys(input))
  }
  assert.deepEqual(whitelistPatch.parse({ displayName: " Updated " }), {
    displayName: "Updated",
  })
})

test("PATCH rejects empty, malformed, and out-of-range input without throwing", () => {
  for (const input of [
    {},
    null,
    [],
    { unknownField: "value" },
    { email: "bad-email" },
    { wechatOpenId: null },
    { displayName: "" },
    { displayName: "x".repeat(81) },
    { role: "OWNER" },
    { enabled: "false" },
  ]) {
    assert.equal(whitelistPatch.safeParse(input).success, false)
  }
  assert.equal(
    whitelistPatch.safeParse({ displayName: "x".repeat(80) }).success,
    true
  )
})

test("merged PATCH cannot clear the last usable identity", () => {
  const row = {
    email: null,
    wechatAppId: "app-id",
    wechatOpenId: "open-id",
    wechatUnionId: null,
  }
  for (const input of [
    { wechatAppId: "" },
    { wechatOpenId: "" },
    { wechatAppId: "", wechatOpenId: "" },
  ]) {
    const patch = whitelistPatch.parse(input)
    assert.equal(hasWhitelistIdentity({ ...row, ...patch }), false)
  }
  assert.equal(
    hasWhitelistIdentity({
      ...row,
      ...whitelistPatch.parse({ wechatOpenId: "" }),
      wechatUnionId: "union-id",
    }),
    true
  )
  assert.equal(
    hasWhitelistIdentity({
      ...row,
      ...whitelistPatch.parse({ enabled: false }),
    }),
    true
  )
})
