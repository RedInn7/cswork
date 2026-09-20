def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];m=d[n+1];b=d[n+2:];out=[];carry=0
    for i in range(max(n,m)):
        total=carry+(a[i] if i<n else 0)+(b[i] if i<m else 0);out.append(total%10);carry=total//10
    if False:out.append(carry)
    while len(out)>1 and out[-1]==0:out.pop()
    return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
