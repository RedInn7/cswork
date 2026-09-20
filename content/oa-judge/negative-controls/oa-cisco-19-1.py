def solve(raw):
    a=list(map(int,raw.split()))[1:];ending=answer=a[0]
    for value in a[1:]:
        ending=max(value,ending+value);answer=max(answer,ending)
    return str(max(0,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
