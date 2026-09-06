FROM golang:1.26-bookworm@sha256:9fdc884aacc3bec89b20ffc69f4bb369c78210e3e4f600387b5128b12c199f81 AS builder
ARG GO_JUDGE_COMMIT=1f3ac5b3d9dd012540531c6564b091fe78d39cdb
ENV GOMAXPROCS=2 GOMEMLIMIT=1GiB CGO_ENABLED=0
WORKDIR /src
RUN git init . && git remote add origin https://github.com/criyle/go-judge.git \
    && git fetch --depth 1 origin "$GO_JUDGE_COMMIT" \
    && git checkout --detach FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "$GO_JUDGE_COMMIT" \
    && printf 'v1.12.3-cswork-seccomp\n' > cmd/go-judge/version/version.txt \
    && go build -p 2 -trimpath -tags 'seccomp,nomsgpack,grpcnotrace' -o /go-judge ./cmd/go-judge
COPY redact-startup-log.patch /tmp/redact-startup-log.patch
RUN git apply --check /tmp/redact-startup-log.patch && git apply /tmp/redact-startup-log.patch \
    && go build -p 2 -trimpath -tags 'seccomp,nomsgpack,grpcnotrace' -o /go-judge ./cmd/go-judge

FROM debian:trixie-slim@sha256:d7e12182ce18b85b93007c1dedf31f2d29e01ccf3182cc4017c709b6259bc132
RUN apt-get update && apt-get install -y --no-install-recommends \
      g++ python3 default-jdk-headless golang-go util-linux ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /opt /tmp/go-judge /dev/shm/go-judge \
    && chmod 1777 /tmp
COPY build-cpp-pch.sh /tmp/build-cpp-pch.sh
RUN sh /tmp/build-cpp-pch.sh && rm /tmp/build-cpp-pch.sh
COPY cpp-json-v1 /tmp/cpp-json-v1
COPY build-cpp-json.sh /tmp/build-cpp-json.sh
RUN sh /tmp/build-cpp-json.sh /tmp/cpp-json-v1 && rm -r /tmp/cpp-json-v1 /tmp/build-cpp-json.sh
COPY build-go-cache.sh /tmp/build-go-cache.sh
RUN sh /tmp/build-go-cache.sh && rm /tmp/build-go-cache.sh
COPY --from=builder /go-judge /opt/go-judge
COPY --from=builder /src/LICENSE /opt/LICENSE.go-judge
COPY mount.yaml seccomp.yaml entrypoint.sh /opt/
RUN chmod 755 /opt/entrypoint.sh
WORKDIR /opt
ENTRYPOINT ["/opt/entrypoint.sh"]
