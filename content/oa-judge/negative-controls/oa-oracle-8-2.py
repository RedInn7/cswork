def solve(raw):
    import json
    s=json.loads(raw);return json.dumps(s[-1]+s[-2],ensure_ascii=True)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
