FROM node:22-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY services/api/package.json services/api/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @event-platform/api...

FROM deps AS dev
WORKDIR /app/services/api
EXPOSE 4000
CMD ["sh", "-c", "pnpm prisma generate && pnpm dev"]

FROM deps AS builder
COPY services/api ./services/api
RUN pnpm --filter @event-platform/api prisma generate
RUN pnpm --filter @event-platform/api build
RUN pnpm --filter @event-platform/api deploy --prod --legacy /prod/api \
  && generated="$(find /app/node_modules/.pnpm -path '*/node_modules/.prisma/client' -type d | head -n 1)" \
  && client_pkg="$(find /prod/api/node_modules/.pnpm -path '*/node_modules/@prisma/client' -type d | head -n 1)" \
  && client_node_modules="$(dirname "$(dirname "$client_pkg")")" \
  && mkdir -p "$client_node_modules/.prisma" \
  && cp -R "$generated" "$client_node_modules/.prisma/client" \
  && rm -rf /prod/api/node_modules/.pnpm/prisma@* \
    /prod/api/node_modules/.pnpm/@prisma+studio-core@* \
    /prod/api/node_modules/.pnpm/@prisma+dev@* \
    /prod/api/node_modules/.pnpm/@prisma+engines@* \
    /prod/api/node_modules/.pnpm/@prisma+fetch-engine@* \
    /prod/api/node_modules/.pnpm/typescript@* \
    /prod/api/node_modules/.pnpm/@types+node@* \
    /prod/api/node_modules/.pnpm/@types+react*@* \
    /prod/api/node_modules/.pnpm/react@* \
    /prod/api/node_modules/.pnpm/react-dom@* \
    /prod/api/node_modules/.pnpm/chart.js@* \
    /prod/api/node_modules/.pnpm/@kurkle+color@* \
    /prod/api/node_modules/.pnpm/hono@* \
    /prod/api/node_modules/.pnpm/@hono+node-server@* \
    /prod/api/node_modules/.pnpm/fast-check@* \
    /prod/api/node_modules/.pnpm/pure-rand@* \
  && rm -f /prod/api/node_modules/.pnpm/node_modules/prisma \
    /prod/api/node_modules/.pnpm/node_modules/typescript \
    /prod/api/node_modules/.pnpm/node_modules/react \
    /prod/api/node_modules/.pnpm/node_modules/react-dom \
    /prod/api/node_modules/.pnpm/node_modules/chart.js \
    /prod/api/node_modules/.pnpm/node_modules/hono \
    /prod/api/node_modules/.pnpm/node_modules/fast-check \
  && for runtime in /prod/api/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime; do \
    find "$runtime" -type f \( -name '*mysql*' -o -name '*sqlite*' -o -name '*sqlserver*' -o -name '*cockroachdb*' -o -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' -o -name '*index-browser*' -o -name '*wasm-compiler-edge*' \) -delete; \
    find "$runtime" -type f \( -name '*.mjs' ! -name '*postgresql*' \) -delete; \
  done

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

COPY --from=builder /prod/api ./

USER apiuser
EXPOSE 4000
ENV PORT=4000

CMD ["node", "dist/main.js"]
