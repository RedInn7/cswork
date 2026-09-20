def solve(d):
    h,w,a,b=map(int,d);count=0
    while a<h:a*=2;count+=1
    while b<w:b*=2
    return str(count)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
