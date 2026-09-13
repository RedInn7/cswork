def solve(d):
    def minutes(t):return int(t[:2])*60+int(t[3:])
    current=minutes(d[-1]);last=-1
    for i in range(1,int(d[0])+1):
        t=minutes(d[i])
        if t<current:last=max(last,t)
    return str(current-last if last>=0 else -1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
