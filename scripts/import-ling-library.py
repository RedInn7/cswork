#!/usr/bin/env python3
"""Build a local, attributed Ling library snapshot without executing source code."""
import argparse
import hashlib
import json
import re
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin


class Description(HTMLParser):
    """Conservative HTML-to-Markdown conversion; never emit active HTML."""
    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base, self.parts, self.links = base, [], []
        self.pre = False
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'style'):
            self.skip += 1
        if self.skip:
            return
        if tag in ('p', 'div', 'ul', 'ol', 'table', 'blockquote'):
            self.parts.append('\n\n')
        elif tag == 'li':
            self.parts.append('\n- ')
        elif tag == 'br':
            self.parts.append('\n')
        elif tag == 'pre':
            self.pre = True
            self.parts.append('\n\n```text\n')
        elif tag == 'code' and not self.pre:
            self.parts.append('`')
        elif tag in ('strong', 'b'):
            if not self.pre:
                self.parts.append('**')
        elif re.fullmatch(r'h[1-6]', tag):
            self.parts.append('\n\n' + '#' * int(tag[1]) + ' ')
        elif tag == 'sup':
            self.parts.append('^{')
        elif tag == 'sub':
            self.parts.append('_{')
        elif tag == 'a':
            href = urljoin(self.base, attrs.get('href', ''))
            self.links.append(href if href.startswith(('https://', 'http://')) else '')
            self.parts.append('[')
        elif tag == 'img':
            src = urljoin(self.base, attrs.get('src', ''))
            if src.startswith(('https://', 'http://')):
                alt = attrs.get('alt', '题目配图').replace('[', '').replace(']', '')
                self.parts.append('\n\n![' + alt + '](' + src.replace(' ', '%20') + ')\n\n')
        elif tag == 'tr':
            self.parts.append('\n')
        elif tag in ('td', 'th'):
            self.parts.append(' | ')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        if tag == 'pre':
            self.pre = False
            self.parts.append('\n```\n\n')
        elif tag == 'code' and not self.pre:
            self.parts.append('`')
        elif tag in ('strong', 'b') and not self.pre:
            self.parts.append('**')
        elif tag in ('p', 'div', 'ul', 'ol', 'table', 'blockquote') or re.fullmatch(r'h[1-6]', tag):
            self.parts.append('\n\n')
        elif tag in ('sup', 'sub'):
            self.parts.append('}')
        elif tag == 'a' and self.links:
            href = self.links.pop()
            self.parts.append('](' + href.replace(' ', '%20') + ')' if href else ']')

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data if self.pre else re.sub(r'\s+', ' ', data))

    def markdown(self):
        return re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+', '\n\n', ''.join(self.parts)).strip()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def description(path, base):
    raw = path.read_text()
    match = re.search(r'<!--\s*description:start\s*-->(.*?)<!--\s*description:end\s*-->', raw, re.S)
    if not match:
        raise ValueError(f'Missing description boundary: {path}')
    parser = Description(base)
    parser.feed(match.group(1))
    value = parser.markdown()
    if not value:
        raise ValueError(f'Empty description: {path}')
    title = re.search(r'^#\s+\[\d+\.\s*(.*?)\]\(', raw, re.M)
    return value, unescape(title.group(1)) if title else None


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--source', type=Path, default=Path('/Users/capsfly/Desktop/gatecode'))
    cli.add_argument('--output', type=Path, default=Path('.local/ling-library.jsonl'))
    args = cli.parse_args()
    root = args.source.resolve()
    list_path = root / 'leetcode solution/solution 2/ling_problemset.json'
    curriculum = json.loads(list_path.read_text())
    topics = {}
    for topic, data in curriculum['topics'].items():
        for number in data['problems']:
            topics.setdefault(int(number), []).append(topic)
    metadata = {}
    for path in sorted((root / 'fetch_data/leetcode_data').glob('*.json')):
        value = json.loads(path.read_text())
        if str(value['questionFrontendId']).isdigit():
            metadata[int(value['questionFrontendId'])] = (path, value)
    sol_root = root / 'leetcode solution/solution 1/solution'
    directories = {int(path.name.split('.')[0]): path for path in sol_root.glob('*/*')
                   if path.is_dir() and path.name.split('.')[0].isdigit()}
    case_paths = {}
    for path in sorted((root / 'testcase-generator/regen_v2/inputs').glob('*.json')):
        value = json.loads(path.read_text())
        slug = value.get('slug')
        if slug in case_paths:
            raise ValueError(f'Duplicate case slug: {slug}')
        case_paths[slug] = path
    args.output.parent.mkdir(parents=True, exist_ok=True)
    counts = {'problems': 0, 'withCandidateCases': 0, 'candidateCases': 0, 'casesWithOutput': 0}
    hashes = {}
    oversized = []
    if len(topics) > 2550:
        raise ValueError('Catalog exceeds 2550 records')
    def record(path):
        relative = str(path.relative_to(root))
        digest = sha(path)
        hashes[relative] = digest
        return {'path': relative, 'sha256': digest}
    record(list_path)
    for license_path in [root / 'leetcode solution/solution 1/LICENSE', root / 'leetcode solution/solution 2/LICENSE.md']:
        record(license_path)
    with args.output.open('w') as stream:
        for number, names in sorted(topics.items()):
            path, source = metadata[number]
            directory = directories[number]
            slug = source['titleSlug']
            zh_url, en_url = f'https://leetcode.cn/problems/{slug}/', f'https://leetcode.com/problems/{slug}/'
            zh, title_zh = description(directory / 'README.md', zh_url)
            en, title_en = description(directory / 'README_EN.md', en_url)
            for item in [path, directory / 'README.md', directory / 'README_EN.md']:
                record(item)
            references = []
            for item in sorted(directory.glob('Solution*')):
                if item.is_file() and item.suffix in ('.py', '.cpp', '.java', '.go'):
                    references.append({'provider': 'doocs/leetcode', 'license': 'CC-BY-SA-4.0', **record(item)})
            for language, ext in [('Python', '.py'), ('C++', '.cpp')]:
                item = root / 'leetcode solution/solution 2' / language / (slug + ext)
                if item.exists():
                    references.append({'provider': 'kamyu104/LeetCode-Solutions', 'license': 'MIT', **record(item)})
            cases = []
            case_path = case_paths.get(slug)
            if case_path:
                provenance = record(case_path)
                for candidate in json.loads(case_path.read_text()).get('testcases', []):
                    if not isinstance(candidate, dict) or not isinstance(candidate.get('input'), str):
                        raise ValueError(f'Invalid candidate input: {case_path}')
                    cases.append({**candidate, 'sourceFile': provenance['path'], 'verification': 'unverified'})
            signature = source.get('metaData') or '{}'
            signature = json.loads(signature) if isinstance(signature, str) else signature
            value = {
                'id': f'lc-{number}', 'number': number, 'slug': slug,
                'titleZh': title_zh or source['title'], 'titleEn': title_en or source['title'],
                'difficulty': {'Easy': '简单', 'Medium': '中等', 'Hard': '困难'}[source['difficulty']],
                'topics': names, 'descriptionZh': zh, 'descriptionEn': en,
                'sourceUrl': zh_url, 'sourceEnUrl': en_url,
                'attribution': f"题单：{curriculum['author']} · {curriculum['source']}；原题：LeetCode；题面整理：doocs/leetcode (https://github.com/doocs/leetcode)，CC-BY-SA-4.0；改编：HTML 转 Markdown，仅保留题面，不含题解。",
                'signature': signature, 'codeSnippets': source.get('codeSnippets', []),
                'reference': {'files': references}, 'cases': cases,
                'caseStatus': 'unverified' if cases else 'missing',
            }
            line = json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n'
            byte_length = len(line.encode('utf-8'))
            if byte_length > 8 * 1024 * 1024:
                oversized.append({'id': value['id'], 'bytes': byte_length})
            stream.write(line)
            counts['problems'] += 1
            counts['withCandidateCases'] += bool(cases)
            counts['candidateCases'] += len(cases)
            counts['casesWithOutput'] += sum('output' in case or 'expected' in case for case in cases)
    manifest = {'formatVersion': 1, 'source': curriculum['source'], 'author': curriculum['author'],
                'sourceRoot': str(root), 'snapshot': 'Local downloaded snapshot; not claimed current',
                'topics': [{'title': title, 'sourceUrl': topic['url'], 'problemCount': len(topic['problems'])}
                           for title, topic in curriculum['topics'].items()],
                'counts': counts, 'judgeReady': 0, 'validation': 'Candidates only; no solutions executed by importer',
                'oversizedRecords': oversized, 'importable': not oversized, 'outputSha256': sha(args.output), 'sourceFilesSha256': hashes}
    manifest_path = args.output.with_name(args.output.stem + '-manifest.json')
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(args.output.resolve()), 'manifest': str(manifest_path.resolve()), **counts}, ensure_ascii=False))


if __name__ == '__main__':
    main()
