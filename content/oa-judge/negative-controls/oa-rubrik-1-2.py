import sys
def solve(raw):
    from collections import Counter
    s=raw.strip(); ans=0; balance=0; seen=Counter({0:1})
    for c in s:
        balance += 1 if c=='1' else -1
        ans += seen[balance]; seen[balance]+=1
    return str(ans)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
