# ---- Stage 1: build the SPA -------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# node:20 ships an old corepack whose signature keys predate npm's 2025 key
# rotation; corepack@latest avoids "signature verification failed" fetching pnpm.
RUN npm install -g corepack@latest && corepack enable

# Lockfile-only fetch: the dependency layer invalidates only when pnpm-lock.yaml changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --offline

ENV NX_DAEMON=false
RUN pnpm nx build klank

# ---- Stage 2: serve via nginx ----------------------------------------------
FROM nginx:1.27-alpine

# Safe default: nothing listens on 127.0.0.1:9, so /api/* returns 502 until a
# real upstream is configured (e.g. KLANK_API_UPSTREAM=http://server:3000).
ENV KLANK_API_UPSTREAM=http://127.0.0.1:9

COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/klank/build/client /usr/share/nginx/html

EXPOSE 80
