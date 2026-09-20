def solve(d):
    a=list(map(int,d[1:]));order=sorted(range(len(a)),key=lambda i:(-a[i],i));return ' '.join(str(i+1) for i in order)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
