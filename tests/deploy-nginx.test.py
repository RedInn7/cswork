import importlib.util
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


if __name__ == "__main__":
    unittest.main()
