def solve(data):
    n,w=map(int,data[:2]); a=list(map(int,data[2:])); result=[]
    def rounded(total):
        scaled=(2*abs(total)*1000000+w)//(2*w)
        sign='-' if total<0 and scaled else ''
        return f'{sign}{scaled//1000000}.{scaled%1000000:06d}'
    total=sum(a[:w])
    if w<=n:
        result.append(rounded(total))
        for i in range(w,n):total+=a[i]-a[i-w]; result.append(rounded(total))
    return str(len(result))+('\n'+' '.join(result) if result else '')

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
