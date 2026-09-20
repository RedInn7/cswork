def solve(raw):
    d=list(map(int,raw.split()));n,target=d[:2];a=sorted(d[2:]);l=0;r=n-1;out=[]
    while l<r:
        value=a[l]+a[r]
        if value<target:l+=1
        elif value>target:r-=1
        else:
            low,high=a[l],a[r];out.extend([f'{low},{high}'] if low!=high else [])
            while l<r and a[l]==low:l+=1
            while l<r and a[r]==high:r-=1
    return '\n'.join(out) if out else 'None'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
