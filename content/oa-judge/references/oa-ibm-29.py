def solve(d):
    from collections import Counter
    header,s=d.split('\n')[:2];lo,hi,u=map(int,header.split());counts=Counter()
    for i in range(len(s)-lo+1):
        part=s[i:i+lo]
        if len(set(part))<=u:counts[part]+=1
    return str(max(counts.values(),default=0))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
