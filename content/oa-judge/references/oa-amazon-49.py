def solve(d):
    s,c=d;run=answer=0
    for v in s:
        if v==c:answer=max(answer,run);run=0
        else:run+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
