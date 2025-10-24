FROM alpine:edge AS builder
ENV MISE_DATA_DIR="/mise"
ENV MISE_CONFIG_DIR="/mise"
ENV MISE_CACHE_DIR="/cache/mise"
ENV BUN_INSTALL_CACHE_DIR="/cache/bun"
ENV PATH="$PATH:/mise/shims"

RUN apk add --no-cache libstdc++ mise

WORKDIR /build
COPY mise.docker.toml ./mise.toml
RUN --mount=type=cache,target=/cache/mise \
  --mount=type=cache,target=/cache/bun \
  --mount=type=cache,target=/go/pkg/mod \
  mise trust && mise install

WORKDIR /build/frontend
COPY frontend/package.json ./package.json
COPY frontend/bun.lock ./bun.lock
RUN --mount=type=cache,target=/cache/bun \
  bun install --frozen-lockfile

ADD frontend /build/frontend
EXPOSE 3000
CMD [ "bun", "dev", "--host", "0.0.0.0", "--port", "3000" ]


