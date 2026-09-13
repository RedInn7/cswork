def solve(d):
    a=list(map(int,d[1:]));stack=[];total=0;full=[]
    for i in range(len(a)-1,-1,-1):
        while stack and stack[-1]>a[i]:stack.pop()
        if stack:total+=a[i]
        else:total+=a[i];full.append(i)
        stack.append(a[i])
    full.reverse()
    return str(total)+'\n'+str(len(full))+(' '+' '.join(map(str,full)) if full else '')

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
