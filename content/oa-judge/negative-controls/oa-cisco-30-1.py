def solve(raw):
    a=list(map(int,raw.split()))[1:];older=previous=0
    for value in a:older,previous=previous,max(previous,previous+value)
    return str(previous)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
