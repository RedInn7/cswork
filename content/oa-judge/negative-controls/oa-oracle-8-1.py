def solve(raw):
    import json
    s=json.loads(raw);return json.dumps(s[-2]+' '+s[-1],ensure_ascii=True)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
