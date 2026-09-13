def solve(d):
    s=d[0];last=None;runs=0
    for i in range(0,len(s),2):
        if s[i]!=last:runs+=1;last=s[i]
    return str(max(1,runs))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
