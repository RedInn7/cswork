def solve(data):
    count,length=map(int,data[:2]); values=list(map(int,data[2:])); intervals=sorted(zip(values[::2],values[1::2])); end=0
    for start,finish in intervals:
        if start-end>=length:return str(end)
        end=max(end,finish)
    return str(end if 1440-end>=length else -1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
