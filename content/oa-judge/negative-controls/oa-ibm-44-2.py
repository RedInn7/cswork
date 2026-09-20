def solve(d):
    n=int(d[0]);out=[0]*n;stack=[];previous=0
    for log in d[2:]:
        v,kind,t=log.split(':');v=int(v);t=int(t)
        if kind=='start':
            if stack:out[stack[-1]]+=t-previous
            stack.append(v);previous=t
        else:out[stack.pop()]+=t-previous+1;previous=t
    return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
