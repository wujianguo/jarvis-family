import ci from "miniprogram-ci"
import { resolve } from "node:path"
const key = process.env.WECHAT_UPLOAD_PRIVATE_KEY_PATH
if (!key) throw new Error("WECHAT_UPLOAD_PRIVATE_KEY_PATH is required")
const project = new ci.Project({
  appid: "wxce94463a6a805e99",
  type: "miniProgram",
  projectPath: resolve(import.meta.dirname, ".."),
  privateKeyPath: key,
  ignores: ["node_modules/**/*"],
})
await ci.upload({
  project,
  version: process.env.MINI_VERSION || "0.0.1",
  desc: process.env.MINI_DESC || "窝事 MVP",
  setting: { es6: true, minify: true },
  onProgressUpdate: console.log,
})
