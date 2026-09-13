def solve(d):
    from collections import Counter
    s=d[0]; remaining=Counter(s); required={c for c,n in remaining.items() if True}; stack=[]; used=set()
    for c in s:
        remaining[c]-=1
        if c not in required or c in used:continue
        while stack and stack[-1]>c and remaining[stack[-1]]>0:used.remove(stack.pop())
        stack.append(c);used.add(c)
    return ''.join(stack)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
