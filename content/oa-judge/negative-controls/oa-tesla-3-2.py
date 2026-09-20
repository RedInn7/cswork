def solve(d):
    balance=0;answer=0
    for c in d[0]:
        balance+=1 if c=='L' else -1
        if balance==0 and c=='R':answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
