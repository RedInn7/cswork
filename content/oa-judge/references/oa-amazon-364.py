def solve(raw):
    import json
    from collections import Counter
    s=json.loads(raw);remaining=Counter(s);need={c for c,v in remaining.items() if v%2};used=set();stack=[]
    for c in s:
        remaining[c]-=1
        if c not in need or c in used:continue
        while stack and stack[-1]>c and remaining[stack[-1]]>0:used.remove(stack.pop())
        stack.append(c);used.add(c)
    return json.dumps(''.join(stack),ensure_ascii=True,separators=(',',':'))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
