FROM node:24-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install -g pnpm@10.33.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY services/api/package.json services/api/package.json
COPY services/api/docker-entrypoint.sh services/api/docker-entrypoint.sh
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @event-platform/api...

FROM deps AS dev
WORKDIR /app/services/api
EXPOSE 4000
CMD ["sh", "-c", "pnpm prisma generate && pnpm dev"]

FROM deps AS prod
ARG RELEASE_SHA=unknown
ENV RELEASE_SHA=${RELEASE_SHA}
LABEL org.opencontainers.image.revision=${RELEASE_SHA}
COPY services/api ./services/api
WORKDIR /app/services/api
RUN printf '%s\n' "$RELEASE_SHA" > /app/services/api/release.txt
RUN pnpm prisma generate
RUN pnpm build
EXPOSE 4000
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
