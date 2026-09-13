def solve(data):
    points=sorted(map(int,data[1:]),reverse=True); difference=0
    for i,value in enumerate(points):difference+=value if i%2==0 else -value
    return str(abs(difference))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
