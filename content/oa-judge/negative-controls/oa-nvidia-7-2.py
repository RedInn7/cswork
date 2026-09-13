import json
def solve(raw):
    document,path=raw.split('\n',1);path=path.rstrip('\r\n');value=json.loads(document)
    for key in path.split('.'):
        if not isinstance(value,dict) or key not in value:
            value=None;break
        value=value[key]
    return json.dumps(value if value else None,ensure_ascii=False,separators=(',',':'))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
