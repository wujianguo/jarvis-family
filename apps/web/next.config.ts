import type { NextConfig } from "next"
import { resolve } from "node:path"

const nextConfig: NextConfig = {
  experimental: { useTypeScriptCli: false },
  transpilePackages: ["@workspace/ui"],
  basePath: "/family",
  output: "standalone",
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
}

export default nextConfig
