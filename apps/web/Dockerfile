FROM node:24-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install -g pnpm@10.33.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @event-platform/web...

FROM deps AS dev
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM deps AS builder
ARG NEXT_PUBLIC_API_BASE_URL
ARG RELEASE_SHA=unknown
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV RELEASE_SHA=${RELEASE_SHA}
ENV NEXT_PUBLIC_RELEASE_SHA=${RELEASE_SHA}

COPY apps/web ./apps/web
COPY packages ./packages

RUN pnpm --filter @event-platform/web build

FROM node:24-alpine AS runner
ARG RELEASE_SHA=unknown
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV RELEASE_SHA=${RELEASE_SHA}
ENV NEXT_PUBLIC_RELEASE_SHA=${RELEASE_SHA}
LABEL org.opencontainers.image.revision=${RELEASE_SHA}
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

RUN mkdir -p /app/apps/web/.next/cache && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
