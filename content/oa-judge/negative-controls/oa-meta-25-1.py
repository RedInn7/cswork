def solve(data):
    def minutes(s):
        h,m=map(int,s.split(':')); return h*60+m
    now=minutes(data[-1]); latest=-1
    for s in data[1:-1]:
        t=minutes(s)
        if t<=now:latest=max(latest,t)
    return str(now-latest if latest>=0 else -1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
