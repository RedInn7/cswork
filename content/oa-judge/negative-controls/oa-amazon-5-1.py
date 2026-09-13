def solve(d):
    a=list(map(int,d[1:])); prefix=[0]
    for v in a: prefix.append(prefix[-1]+v)
    stop=[len(prefix)]*len(prefix); stack=[]
    for i,v in enumerate(prefix):
        while stack and prefix[stack[-1]]>=v: stop[stack.pop()]=i
        stack.append(i)
    return str(max(stop[i]-i-1 for i in range(len(a))))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
