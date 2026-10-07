import json, re, sys

TOKEN = re.compile(r"%([A-Za-z][A-Za-z0-9_]*)%")
MAX_TEXT = 4096
MAX_OUTPUT = 1_048_576

def solve(raw):
    data = json.loads(raw)
    if not isinstance(data, dict) or set(data) != {"substitutions", "template"}:
        raise ValueError("expected substitutions and template only")
    substitutions = data["substitutions"]
    template = data["template"]
    if not isinstance(substitutions, dict) or len(substitutions) > 100:
        raise ValueError("substitutions must be an object with at most 100 entries")
    if not isinstance(template, str) or len(template) > MAX_TEXT:
        raise ValueError("template exceeds the supported length")

    for key, value in substitutions.items():
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,31}", key):
            raise ValueError("invalid key")
        if (not isinstance(value, str) or len(value) > MAX_TEXT
                or any(not 32 <= ord(char) <= 126 for char in value)):
            raise ValueError("value exceeds the supported length")
    if any(not 32 <= ord(char) <= 126 for char in template):
        raise ValueError("template must contain printable ASCII only")

    visiting = set()
    resolved = {}
    def resolve_key(key):
        if key in resolved:
            return resolved[key]
        if key in visiting or key not in substitutions:
            raise ValueError("cyclic or missing reference")
        visiting.add(key)
        value = expand(substitutions[key])
        visiting.remove(key)
        resolved[key] = value
        return value

    def expand(text):
        out = []
        cursor = 0
        for match in TOKEN.finditer(text):
            literal = text[cursor:match.start()]
            if "%" in literal:
                raise ValueError("malformed placeholder")
            out.append(literal)
            out.append(resolve_key(match.group(1)))
            if sum(map(len, out)) > MAX_OUTPUT:
                raise ValueError("expanded output exceeds the supported limit")
            cursor = match.end()
        tail = text[cursor:]
        if "%" in tail:
            raise ValueError("malformed placeholder")
        out.append(tail)
        result = "".join(out)
        if len(result) > MAX_OUTPUT:
            raise ValueError("expanded output exceeds the supported limit")
        return result

    for key in substitutions:
        resolve_key(key)
    return json.dumps(expand(template), ensure_ascii=True)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
