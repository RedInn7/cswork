def solve(raw):
    d=list(map(int,raw.split()));n=d[0];a=d[1:n+1];b=d[n+1:];i=j=0;out=[]
    while i<n and j<n:
        if a[i]>=b[j]:out.append(a[i]);i+=1
        else:out.append(b[j]);j+=1
    out.extend(a[i:]);out.extend(b[j:]);return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
