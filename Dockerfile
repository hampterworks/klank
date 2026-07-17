# syntax=docker/dockerfile:1

# ---- Stage 1: build the SPA -------------------------------------------------
FROM node:20-bookworm-slim AS spa
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
# -> apps/klank/build/client

# ---- Stage 2: build the klank-server binary ---------------------------------
# cargo-chef caches the compiled dependency graph in its own layer so source-only
# edits don't recompile crates.io deps. `-p klank-server` scopes the cook/build
# to the server package, so the tauri app crate's heavy GUI deps are never built.
FROM rust:1.88-bookworm AS chef
# cmake: vendored-libgit2 builds libgit2 from source. perl + build-essential
# (already in the rust image's buildpack-deps base) build vendored OpenSSL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends cmake \
 && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-chef --locked
WORKDIR /build

FROM chef AS planner
COPY apps/klank/src-tauri .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS server-build
COPY --from=planner /build/recipe.json recipe.json
RUN cargo chef cook --release -p klank-server --recipe-path recipe.json
COPY apps/klank/src-tauri .
RUN cargo build --release -p klank-server
# -> /build/target/release/klank-server

# ---- Stage 3: runtime -------------------------------------------------------
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system klank \
 && useradd --system --gid klank --home-dir /app --no-create-home klank

COPY --from=server-build /build/target/release/klank-server /usr/local/bin/klank-server
COPY --from=spa /app/apps/klank/build/client /app/static

ENV KLANK_TABS_DIR=/data \
    KLANK_CONFIG_DIR=/config \
    KLANK_STATIC_DIR=/app/static \
    KLANK_PORT=8080

# Create + own the mount points so the non-root user can write to fresh volumes.
RUN mkdir -p /data /config && chown klank:klank /data /config

VOLUME ["/data", "/config"]
EXPOSE 8080
USER klank
CMD ["klank-server"]
