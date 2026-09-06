# Isolated semantic language services

The Node broker runs only on `127.0.0.1:4321` and requires a random shared bearer token. The web API authenticates the student and authorizes the problem before injecting `ownerId`; clients never choose that field. It sends a unique document ID for each editor mount, so Monaco model versions cannot collide across refreshes.

Each `(ownerId, documentId, language)` owns a separate Docker container and LSP stdio connection. The broker permits only completion, hover, signature help and diagnostics. It constructs the workspace and file URI internally. No browser-supplied commands, paths, LSP methods, server options or environment variables are accepted. Completion commands, opaque server data and diagnostic related-file locations are removed from responses. Markdown documentation must still be rendered untrusted by the frontend.

The shared image contains Pyright 1.1.411 with Python 3.13, gopls 0.21.1 analyzing against Go 1.24.4, Debian clangd 19 with C++20 headers, and Eclipse JDT LS 1.55.0 with JDK 21. These match the judge's language targets. Gopls itself is compiled with Go 1.26, but its GOROOT and project language version are 1.24.4. These are real language servers; completion comes from their type and standard-library knowledge. Dependency installation, Maven/Gradle imports, network access and execution of submitted programs are unavailable. This is a single-file algorithm workspace, not a general remote development machine.

## Build and install

From the repository root on the Linux host:

```sh
docker build --memory=3g --cpu-period=100000 --cpu-quota=200000 -t cswork-language-service:1 deploy/language-service
sudo bash deploy/language-service/install.sh
```

The installation preserves `/etc/cswork/language-service.env` on upgrades, restarts the broker, and checks authenticated health. Only after a successful check does it upsert `CSWORK_LSP_TOKEN` and `CSWORK_LSP_URL` into the existing private web environment, preserving other fields and `root:cswork` ownership. It restores the previous runtime and web configuration if the health check fails. It does not restart the web application; do that during normal web deployment. Never place the token in public/Vite environment variables.

The dedicated `cswork-lsp` service account has Docker socket access; web requests reach its fixed API rather than Docker. That account has effective Docker administrative power, so broker scripts and image must remain root-owned. Containers run as UID 10001, with no network, read-only root, no capabilities, no new privileges, no host mounts, Docker's default seccomp profile, one CPU, 128 processes, and memory/swap caps (768 MiB; Java 1536 MiB). `/workspace` and `/tmp` are private 256 MiB tmpfs mounts. No submitted source is stored on persistent storage or logged by the broker.

There are at most four reservations globally and two per user, including containers being started or removed. Idle containers expire after 180 seconds; sessions are recycled after 30 minutes when idle. Startup claims the loopback port before removing only orphan containers with this service's dedicated label. Closing waits for `docker create` before removal to prevent cold-start cancellation leaks. A failed Docker removal retains its capacity reservation and is retried. Explicitly closed documents are remembered for three minutes (bounded to 1024 keys), rejecting late requests that could otherwise recreate an abandoned editor. Generate a new document UUID on language switches as well as mount.

## HTTP API

All routes require `Authorization: Bearer …`. `POST` routes require JSON.

`POST /v1/request`:

```json
{
  "ownerId": "server-user-id",
  "documentId": "problem-id:editor-uuid",
  "language": "python",
  "code": "import math\nmath.",
  "version": 1,
  "action": "completion",
  "position": { "line": 1, "character": 5 }
}
```

Languages: `python`, `go`, `cpp`, `java`. Actions: `completion`, `hover`, `signature`, `diagnostics`. Position is zero-based UTF-16, and is required except for diagnostics. Code is capped at 65536 UTF-8 bytes. Versions must increase when code changes. Stale or conflicting versions return HTTP 409. The fixed files are `main.py`, `main.go`, `main.cpp`, and `Main.java`; Java code should use class `Main`.

The response contains `sessionId`, `version`, `language`, `server`, standard LSP `result`, `diagnostics`, and `diagnosticsVersion` (null while current-version diagnostics have not arrived, or when a server cannot identify their version). Completion is capped at 100 items, diagnostics at 100, and the entire response at 1 MiB. Busy sessions return 429, unavailable services 503, and request timeout 504. The frontend should show cold-start status and support retry; unconfigured services must not be advertised as available.

**Java diagnostic limitation:** JDT LS 1.55.0 returns semantic diagnostics but omits their document version. The broker deliberately leaves `diagnosticsVersion: null`; the editor must suppress those markers rather than risk applying old errors to a newer edit. Java completion, hover and signature help work. Python, Go and C++ publish versioned diagnostics and can show live markers. Apply markers only when `diagnosticsVersion ===` the current model version. Diagnostics are asynchronous; clients may perform a short bounded poll after an edit, not poll indefinitely.

`POST /v1/close` accepts `{ownerId,documentId,language}` and returns `{closed:true}`, also for an already closed session. `GET /health` returns configured server versions and session counts (not student IDs or source).

## Verification

```sh
node --test tests/language-service.test.mjs
node --test tests/language-service-lifecycle.test.mjs
node --env-file=/etc/cswork/language-service.env tests/language-service-integration.mjs
```

The real-runtime integration checks imported/member completion, typed hovers, parameter signatures, and unknown-identifier diagnostics for all four languages and removes every test session in a `finally` block. It does not submit or run student code.

Validated on the isolated ARM64 server on 2026-09-06:

| Language | Semantic completion example             | Cold completion    | Diagnostics version                |
| -------- | --------------------------------------- | ------------------ | ---------------------------------- |
| Python   | `math.sqrt` from an imported module     | 2.08 s / 86 items  | Current version, markers supported |
| Go       | `fmt.Println` from the standard library | 1.45 s / 29 items  | Current version, markers supported |
| C++      | `std::vector<int>.push_back`            | 2.50 s / 29 items  | Current version, markers supported |
| Java     | `ArrayList<String>.add`                 | 12.83 s / 61 items | Missing, markers suppressed        |

These are observed cold starts, not latency guarantees. Warm sessions reuse their language server. The startup budget is 45 seconds; semantic requests have a 15-second timeout and the browser should allow 60 seconds for cold startup. Gopls intentionally suppresses signature help while the caret is inside a string literal; moving to the parameter boundary returns the function signature.

For operations, use `systemctl status cswork-language-service` and authenticated `/health`. A 429 usually means four active documents or two from one user; closing a document releases its slot. If Docker is unavailable, keep the service fail-closed rather than removing reservations or relaxing sandbox flags. The installer restores the previous scripts and private web environment on failure without rotating the token. Do not prune unrelated Docker images, remove OJ containers, or restart CSGrad while diagnosing this service.

Primary implementation references: [Pyright configuration](https://github.com/microsoft/pyright/blob/main/docs/settings.md), [gopls settings](https://go.dev/gopls/settings), [clangd](https://clangd.llvm.org/installation.html), and [JDT LS launch requirements](https://github.com/eclipse-jdtls/eclipse.jdt.ls#running-from-the-command-line).
