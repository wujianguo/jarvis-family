FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --filter api... --frozen-lockfile
COPY apps/api apps/api
COPY packages/db packages/db
COPY packages/contracts packages/contracts
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @workspace/db generate \
 && pnpm --filter api build

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/packages/contracts ./packages/contracts
ENV NODE_ENV=production PORT=3001 HOST=127.0.0.1
CMD ["node", "/app/apps/api/dist/server.js"]
