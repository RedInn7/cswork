def solve(d):
    a=list(map(int,d[1:]));allowed=set(a);previous={};answer=0
    for value in a:
        current={value:1}
        for old,count in previous.items():key=old|value;current[key]=current.get(key,0)+count
        answer+=sum(1 for key in current if key in allowed);previous=current
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
