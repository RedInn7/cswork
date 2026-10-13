import http.client
import http.server
import importlib.util
import json
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import unittest
from pathlib import Path

path = Path(__file__).resolve().parent.parent / "deploy/configure-nginx.py"
spec = importlib.util.spec_from_file_location("cswork_nginx", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MediaRouting(unittest.TestCase):
    def test_https_proxy_after_redirect_and_idempotent_upgrade(self):
        original = """server {
    listen 80;
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/cswork/fullchain.pem;
    location / {
        proxy_pass http://127.0.0.1:4317;
    }
}
"""
        result = module.with_media_location(original)
        self.assertGreater(result.index("include /etc/nginx/snippets/"), result.index("listen 443 ssl"))
        self.assertIn("ssl_certificate /etc/letsencrypt/live/cswork/fullchain.pem;", result)
        self.assertEqual(module.with_media_location(result), result)
        misplaced = original.replace("    listen 80;", "    listen 80;\n    include /etc/nginx/snippets/cswork-media.conf;")
        self.assertEqual(module.with_media_location(misplaced), result)

    def test_large_import_is_exact_and_does_not_expand_other_routes(self):
        snippet = (path.parent / "nginx-oj-import.conf").read_text()
        template = (path.parent / "nginx.conf.template").read_text()
        self.assertIn("location = /api/oj/admin/problems/save {", snippet)
        self.assertEqual(snippet.count("location "), 1)
        self.assertIn("client_max_body_size 129m;", snippet)
        self.assertIn("proxy_request_buffering off;", snippet)
        self.assertIn("client_max_body_size 9m;", template)
        result = module.with_media_location(template)
        self.assertEqual(result.count("include /etc/nginx/snippets/cswork-oj-import.conf;"), 1)
        self.assertEqual(result.count("include /etc/nginx/snippets/cswork-content-assets.conf;"), 1)
        self.assertEqual(module.with_media_location(result), result)

    def test_content_assets_are_static_and_script_free(self):
        snippet = (path.parent / "nginx-content-assets.conf").read_text()
        self.assertIn("location ^~ /content-assets/ {", snippet)
        self.assertIn("alias /srv/cswork/content-assets/;", snippet)
        self.assertIn("sandbox", snippet)
        self.assertNotIn("proxy_pass", snippet)

    def test_new_install_and_unknown_config(self):
        template = (path.parent / "nginx.conf.template").read_text()
        self.assertEqual(module.with_media_location(module.with_media_location(template)), module.with_media_location(template))
        with self.assertRaises(ValueError):
            module.with_media_location("server { location / { proxy_pass http://127.0.0.1:3000; } }")


class FormalDomain(unittest.TestCase):
    live = """server {
    listen 80;
    server_name cswork.192.18.137.70.sslip.io;
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/cswork/fullchain.pem;
    server_name cswork.192.18.137.70.sslip.io;
    location / {
        proxy_pass http://127.0.0.1:4317;
    }
}
"""
    names = ["cswork.192.18.137.70.sslip.io", "cswork.org", "www.cswork.org"]

    def test_names_are_added_to_both_servers_and_keep_the_temporary_domain(self):
        result = module.with_server_names(self.live, self.names)
        self.assertEqual(result.count("server_name cswork.192.18.137.70.sslip.io cswork.org www.cswork.org;"), 2)
        self.assertEqual(module.with_server_names(result, self.names), result)
        # The media include step still finds the one proxy location afterwards.
        self.assertIn("cswork-media.conf", module.with_media_location(result))
        with self.assertRaises(ValueError):
            module.with_server_names("server { listen 80; }", self.names)

    def test_canonical_redirect_is_https_only_idempotent_and_reversible(self):
        named = module.with_server_names(self.live, self.names)
        switched = module.with_canonical(named, "cswork.org")
        self.assertEqual(switched.count("return 301 https://cswork.org$request_uri;"), 1)
        self.assertGreater(switched.index("if ($host != cswork.org)"), switched.index("listen 443 ssl;"))
        self.assertEqual(module.with_canonical(switched, "cswork.org"), switched)
        self.assertEqual(module.with_canonical(switched, None), named)
        self.assertIn("cswork-media.conf", module.with_media_location(switched))

    def test_http2_is_idempotent_and_keeps_the_canonical_redirect(self):
        upgraded = module.with_http2(self.live + "    listen 443 ssl; # managed by Certbot\n")
        self.assertEqual(upgraded.count("listen 443 ssl http2;"), 2)
        self.assertNotIn("listen 443 ssl;", upgraded)
        self.assertIn("listen 443 ssl http2; # managed by Certbot", upgraded)
        self.assertEqual(module.with_http2(upgraded), upgraded)
        self.assertEqual(module.with_http2("server {\n    listen 80;\n}\n"), "server {\n    listen 80;\n}\n")
        switched = module.with_canonical(module.with_http2(self.live), "cswork.org")
        self.assertGreater(switched.index("if ($host != cswork.org)"), switched.index("listen 443 ssl http2;"))
        self.assertEqual(module.with_canonical(switched, None), module.with_http2(self.live))


class Hardening(unittest.TestCase):
    live = FormalDomain.live.replace(
        "        proxy_pass http://127.0.0.1:4317;\n",
        "        proxy_pass http://127.0.0.1:4317;\n"
        "        add_header X-Content-Type-Options nosniff always;\n"
        "        add_header Referrer-Policy strict-origin-when-cross-origin always;\n")
    hsts = 'add_header Strict-Transport-Security "max-age=31536000" always;'

    def configure(self, text):
        return module.with_hardening(module.with_media_location(text))

    def test_every_server_logs_and_limits_and_only_the_proxy_gets_headers(self):
        result = self.configure(module.with_canonical(module.with_http2(self.live), "cswork.org"))
        self.assertEqual(result.count("include /etc/nginx/snippets/cswork-server.conf;"), 2)
        proxy = result[result.index("proxy_pass http://127.0.0.1:4317;"):]
        proxy = proxy[:proxy.index("}")]
        for header in (self.hsts, "add_header X-Frame-Options DENY always;", "nosniff", "Referrer-Policy"):
            self.assertEqual(result.count(header), 1)
            self.assertIn(header, proxy)
        self.assertEqual(self.configure(result), result)
        self.assertIn("return 301 https://cswork.org$request_uri; } # cswork-canonical", result)
        template = (path.parent / "nginx.conf.template").read_text()
        self.assertEqual(self.configure(template).count("cswork-server.conf"), 1)
        self.assertEqual(self.configure(self.configure(template)), self.configure(template))
        with self.assertRaises(ValueError):
            module.with_hardening(FormalDomain.live)  # proxy without its headers

    def test_directives(self):
        http_conf = (path.parent / "nginx-http.conf").read_text()
        for line in ("server_tokens off;", "gzip_vary on;", "gzip_proxied any;", "gzip_comp_level 5;",
                     "gzip_min_length 1024;", "gzip_types text/css application/javascript application/json "
                     "image/svg+xml font/ttf application/xml text/plain;",
                     "limit_req_zone $cswork_auth_key zone=cswork_auth:10m rate=2r/s;",
                     "limit_req_zone $cswork_api_key zone=cswork_api:10m rate=10r/s;"):
            self.assertIn("\n" + line + "\n", http_conf)
        self.assertNotIn("\ngzip on;", http_conf)  # nginx.conf has it; a repeat fails nginx -t
        for field in ("$host", "$request_time", "$upstream_response_time", "$status", "$body_bytes_sent"):
            self.assertIn(field, http_conf[http_conf.index("log_format cswork"):])
        server = (path.parent / "nginx-server.conf").read_text()
        for line in ("access_log /var/log/nginx/cswork.access.log cswork;", "limit_req_status 429;",
                     "limit_req zone=cswork_auth burst=20 nodelay;", "limit_req zone=cswork_api burst=60 nodelay;"):
            self.assertIn(line, server)
        self.assertIn(self.hsts, (path.parent / "nginx-oj-import.conf").read_text())

    @unittest.skipUnless(shutil.which("nginx"), "nginx not installed")
    def test_nginx_accepts_the_rendered_config_and_limits_only_api(self):
        class App(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript" if self.path.endswith(".js") else "application/json")
                self.send_header("Content-Length", "2048")
                self.end_headers()
                self.wfile.write(b"a" * 2048)

            def log_message(self, *args):
                pass
        app = http.server.ThreadingHTTPServer(("127.0.0.1", 0), App)
        threading.Thread(target=app.serve_forever, daemon=True).start()
        self.addCleanup(app.server_close)
        self.addCleanup(app.shutdown)
        with tempfile.TemporaryDirectory() as d, socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
            local = lambda text: (text.replace("/etc/nginx/snippets/", d + "/").replace("/var/log/nginx/", d + "/")
                                  .replace("127.0.0.1:4317", f"127.0.0.1:{app.server_port}"))
            vhost = self.configure((path.parent / "nginx.conf.template").read_text().replace("CSWORK_HOSTNAME", "cswork.test"))
            Path(d, "cswork").write_text(local(vhost).replace("listen 80;", f"listen 127.0.0.1:{port};"))
            for name in ("media", "oj-import", "content-assets", "server"):
                Path(d, f"cswork-{name}.conf").write_text(local((path.parent / f"nginx-{name}.conf").read_text()))
            Path(d, "http.conf").write_text((path.parent / "nginx-http.conf").read_text())
            temps = " ".join(f"{t}_temp_path {d}/{t};" for t in ("client_body", "proxy", "fastcgi", "uwsgi", "scgi"))
            # Stock Ubuntu nginx.conf: `gzip on;` in http, then conf.d, then sites.
            Path(d, "nginx.conf").write_text(f"pid {d}/nginx.pid;\nevents {{}}\nhttp {{\n gzip on;\n access_log {d}/access.log;\n"
                                             f" {temps}\n include {d}/http.conf;\n include {d}/cswork;\n}}\n")
            probe.close()
            cmd = ["nginx", "-p", d, "-e", f"{d}/error.log", "-c", f"{d}/nginx.conf"]
            check = subprocess.run(cmd + ["-t"], capture_output=True, text=True)
            self.assertEqual(check.returncode, 0, check.stderr)
            server = subprocess.Popen(cmd + ["-g", "daemon off;"], stderr=subprocess.DEVNULL)
            try:
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
                for _ in range(50):
                    try:
                        conn.connect()
                        break
                    except OSError:
                        time.sleep(0.1)

                def statuses(url, n, **headers):
                    seen = []
                    for _ in range(n):
                        conn.request("GET", url, headers={"Host": "cswork.test", **headers})
                        response = conn.getresponse()
                        response.body = response.read()
                        seen.append(response.status)
                    return response, seen
                response, seen = statuses("/api/bootstrap", 90)
                self.assertGreaterEqual(seen.count(200), 61)
                self.assertEqual(response.status, 429)
                self.assertIn("Too many requests", json.loads(response.body)["error"])
                self.assertIn(429, statuses("/api//auth/get-session", 30)[1])
                # The verdict long-poll and pages are not limited by nginx.
                for url in ("/api/oj/submissions/s1?after=t&wait=1", "/library/algorithm"):
                    response, seen = statuses(url, 90)
                    self.assertNotIn(429, seen, url)
                self.assertEqual(response.getheader("X-Frame-Options"), "DENY")
                self.assertEqual(response.getheader("Strict-Transport-Security"), "max-age=31536000")
                self.assertEqual(response.getheader("Server"), "nginx")
                js = statuses("/_next/static/chunks/a.js", 1, **{"Accept-Encoding": "gzip"})[0]
                self.assertEqual(js.getheader("Content-Encoding"), "gzip")
                self.assertEqual(js.getheader("Vary"), "Accept-Encoding")
                self.assertIn(" cswork.test rt=", Path(d, "cswork.access.log").read_text())
            finally:
                conn.close()
                server.terminate()
                server.wait(10)


if __name__ == "__main__":
    unittest.main()
