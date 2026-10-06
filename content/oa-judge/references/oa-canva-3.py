def solve(raw):
    s=raw.strip(); prev=0; run=0; last=None; ans=0
    for ch in s:
        if ch==last: run+=1
        else: ans+=min(prev,run); prev,run=run,1; last=ch
    return str(ans+min(prev,run))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
