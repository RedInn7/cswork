def solve(raw):
    from collections import Counter
    counts=Counter(map(int,raw.split()[1:]));values=sorted(counts);prefix=[0];left=answer=0
    for i,v in enumerate(values):
        prefix.append(prefix[-1]+counts[v])
        if i and v!=values[i-1]+1:left=i
        elif False:left=max(left,i-1)
        answer=max(answer,prefix[-1]-prefix[left])
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
