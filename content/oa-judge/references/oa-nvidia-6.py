from collections import Counter
def solve(d):
    words=d[1:];counts=Counter()
    for s in words:counts.update(s)
    pairs=sum(v//2 for v in counts.values());answer=0
    for needed in sorted(len(s)//2 for s in words):
        if needed>pairs:break
        pairs-=needed;answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
