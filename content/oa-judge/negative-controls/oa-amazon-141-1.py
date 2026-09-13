def solve(d):
    next_time={};total=0
    for token in d[1:]:
        original=int(token);value=next_time.get(original,original);total+=value;next_time[original]=value//2
    return str(total)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
