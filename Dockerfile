# syntax=docker/dockerfile:1
# Pin aligns with package.json `packageManager` / CI reproducibility.
ARG BUN_DOCKER_TAG="1.3.10"

FROM oven/bun:${BUN_DOCKER_TAG} AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
ENV NODE_ENV=production
RUN bun run build

FROM oven/bun:${BUN_DOCKER_TAG} AS production

LABEL org.opencontainers.image.title="bunjs-hands-on"
LABEL org.opencontainers.image.description="Bun HTTP API (Hono-style routes)"
LABEL org.opencontainers.image.version="1.0.0"

ARG APP_USER="bun"
ARG DATA_DIR="/app/data"

WORKDIR /app

RUN install -d -o "${APP_USER}" -g "${APP_USER}" "${DATA_DIR}"

COPY --from=build --chown=${APP_USER}:${APP_USER} /app/dist ./dist

USER ${APP_USER}

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "const p=process.env.PORT||'3000';fetch('http://127.0.0.1:'+p+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "dist/index.js"]
