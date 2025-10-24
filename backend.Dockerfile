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

ENV CGO_ENABLED=0
COPY backend/go.* ./backend/
WORKDIR /build/backend

RUN --mount=type=cache,target=/go/pkg/mod \
  go mod download

ADD backend /build/backend
RUN --mount=type=cache,target=/root/.cache/go-build \
  mkdir ../dist && go build -o ../dist/app

FROM gcr.io/distroless/static-debian12
COPY  --from=builder /build/dist/app /app
ENV PORT=3000 
EXPOSE 3000
CMD [ "/app" ]
