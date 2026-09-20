def solve(raw):
    import json
    order,codes=json.loads(raw);rank={c:i for i,c in enumerate(order)}
    codes.sort(key=lambda word:bytes(rank[c] for c in word))
    return json.dumps(codes,ensure_ascii=True,separators=(',',':'))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
