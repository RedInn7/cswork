def solve(d):
    capacity=int(d[1]);last=None;removed=0
    for token in d[2:]:
        weight=int(token)
        if weight>capacity:removed+=1;continue
        if last is not None and last+weight>=capacity:removed+=1;last=min(last,weight)
        else:last=weight
    return str(removed)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
