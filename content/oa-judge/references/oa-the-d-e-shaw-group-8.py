def solve(raw):
    v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]
    left=[-1]*n; st=[]
    for i,x in enumerate(a):
        while st and a[st[-1]]<=x: st.pop()
        left[i]=st[-1] if st else -1; st.append(i)
    right=[n]*n; st=[]
    for i in range(n-1,-1,-1):
        while st and a[st[-1]]<=a[i]: st.pop()
        right[i]=st[-1] if st else n; st.append(i)
    return str(sum(right[i]-left[i]-1 for i in range(n)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
