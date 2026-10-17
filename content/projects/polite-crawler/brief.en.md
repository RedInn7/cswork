# Polite Web Crawler (robots.txt and Rate Limits)

Write a command-line crawler that starts from one URL and crawls breadth first within that one site. It must be polite: read and obey robots.txt first, leave a gap between requests, and when the server says it is busy, wait for `Retry-After` before trying again. Any language.

## Usage

```
your-program START_URL --max-pages N --delay-ms D
```

After each page, print one JSON line to standard output: `{"url": the page URL, "status": its final HTTP status, "depth": links away from the start page}`. The start page has depth 0. Exit 0 when the crawl is done or the limit is reached. Write anything else to standard error.

## Rules

- **One site**: follow only `http`/`https` links with the start URL's scheme, host and port; never request `mailto:`, `javascript:` or links to other sites.
- **robots.txt**: request `/robots.txt` before any page. Every request's `User-Agent` contains `cswork-bot`. If there is a `User-agent: cswork-bot` group, use that group only; otherwise use the `*` group, and let its `Allow` and `Disallow` lines decide. A missing robots.txt (404) allows everything.
- **No repeats**: resolve relative links to absolute URLs and drop the `#` fragment; different query strings are different URLs. Request each URL once.
- **HTML only**: look for `<a href>` only in pages whose `Content-Type` is `text/html`. Other files still count as a page fetched, but are not parsed.
- **Rate limit**: at least `--delay-ms` milliseconds between any two requests, robots.txt and retries included.
- **Retries**: on a 429 or 503, wait `Retry-After` seconds (1 if it is missing) and try the same URL again, at most 3 tries in all. Print the status of the last one. Other errors (such as 404) are not retried and are printed as they are.
- **Limit**: `--max-pages` caps the pages fetched (robots.txt not included), in breadth-first order.

## Constraints

- Do not fetch every link first and filter afterwards: the robots and same-site checks come before the request.
- If you crawl concurrently, the gap rule still holds for the one site.

## Extras

- Support `Crawl-delay`, taking the larger of it and `--delay-ms`.
- Resume: save the queue and the seen set to disk and continue after a restart.
- Many sites at once, each with its own rate limiter.
- Discover pages from `sitemap.xml`, and recrawl incrementally with `Last-Modified`.
