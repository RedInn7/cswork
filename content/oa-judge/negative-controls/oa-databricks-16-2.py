def solve(data):
    v=list(map(int,data.split())); n=v[0]; even=odd=0
    for i,x in enumerate(v[1:1+n]):
        if -100<=x<=100:
            if i%2==1: even+=x
            else: odd+=x
    return str(even-odd)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
