def solve(d):
    from collections import Counter
    n,t=map(int,d[:2]);counts=Counter(map(int,d[2:]));answer=0
    for a,c in counts.items():
        b=t-a
        if b in counts and (a!=b or c>=2):answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
