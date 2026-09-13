def solve(data):
    groups={}
    for i in range(1,len(data),2):
        v=int(data[i]); c=data[i+1]
        lo,hi=groups.get(c,(v,v)); groups[c]=(v,max(hi,v))
    return str(max(hi-lo for lo,hi in groups.values()))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
