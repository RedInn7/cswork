def solve(d):
    tasks=[(int(d[i+1]),int(d[i])) for i in range(1,len(d),2)];tasks.sort(key=lambda item:item[1]);time=0
    for deadline,duration in tasks:
        time+=duration
        if time>deadline:return '-1'
    return str(time)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
