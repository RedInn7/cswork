def solve(raw):
    free=lost=0
    for v in map(int,raw.split()[1:]):
        if v>0:free+=v
        elif free:free-=0
        else:lost+=1
    return str(lost)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
