FROM golang:1.26-bookworm AS gopls
ENV GOMAXPROCS=2 GOTOOLCHAIN=local
RUN go install golang.org/x/tools/gopls@v0.21.1

FROM debian:trixie-slim
ARG PYRIGHT_VERSION=1.1.411
ARG JDTLS_ARCHIVE=jdt-language-server-1.55.0-202601131729.tar.gz
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl nodejs npm python3 clangd-19 g++ openjdk-21-jdk-headless \
    && npm install --global --omit=dev pyright@${PYRIGHT_VERSION} \
    && npm cache clean --force \
    && mkdir -p /opt/jdtls /workspace \
    && curl --fail --location --retry 3 "https://download.eclipse.org/jdtls/milestones/1.55.0/${JDTLS_ARCHIVE}" -o /tmp/jdtls.tar.gz \
    && tar -xzf /tmp/jdtls.tar.gz -C /opt/jdtls \
    && rm /tmp/jdtls.tar.gz \
    && rm -rf /var/lib/apt/lists/* /root/.npm \
    && useradd --uid 10001 --no-create-home --home-dir /tmp/home --shell /usr/sbin/nologin lsp
COPY --from=gopls /go/bin/gopls /usr/local/bin/gopls
RUN arch="$(dpkg --print-architecture)" \
    && case "$arch" in \
      amd64) go_sha=77e5da33bb72aeaef1ba4418b6fe511bc4d041873cbf82e5aa6318740df98717 ;; \
      arm64) go_sha=d5501ee5aca0f258d5fe9bfaed401958445014495dc115f202d43d5210b45241 ;; \
      *) exit 1 ;; \
    esac \
    && curl --fail --location --retry 3 "https://go.dev/dl/go1.24.4.linux-${arch}.tar.gz" -o /tmp/go.tar.gz \
    && printf '%s  /tmp/go.tar.gz\n' "$go_sha" | sha256sum -c - \
    && tar -xzf /tmp/go.tar.gz -C /usr/local \
    && rm /tmp/go.tar.gz
COPY entrypoint.sh /usr/local/bin/cswork-language-server
RUN chmod 0555 /usr/local/bin/cswork-language-server
ENV PATH=/usr/local/go/bin:$PATH HOME=/tmp/home XDG_CACHE_HOME=/tmp/cache \
    GOCACHE=/tmp/go-cache GOPATH=/tmp/go GOMODCACHE=/tmp/go-mod \
    GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off GOTELEMETRY=off GOMAXPROCS=2 \
    NODE_OPTIONS=--max-old-space-size=512
USER 10001:10001
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/cswork-language-server"]
