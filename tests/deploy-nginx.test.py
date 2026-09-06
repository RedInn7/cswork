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
        self.assertEqual(module.with_media_location(result), result)

    def test_new_install_and_unknown_config(self):
        template = (path.parent / "nginx.conf.template").read_text()
        self.assertEqual(module.with_media_location(module.with_media_location(template)), module.with_media_location(template))
        with self.assertRaises(ValueError):
            module.with_media_location("server { location / { proxy_pass http://127.0.0.1:3000; } }")


if __name__ == "__main__":
    unittest.main()
