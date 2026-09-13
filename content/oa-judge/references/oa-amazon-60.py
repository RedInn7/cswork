def solve(d):
    from collections import Counter
    counts=Counter(map(int,d[1:]));keys=sorted(counts);best=current=0;previous=None
    for value in keys:
        if previous is None or value!=previous+1:current=counts[value]
        elif counts[previous]==1:current=counts[previous]+counts[value]
        else:current+=counts[value]
        best=max(best,current);previous=value
    return str(best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
