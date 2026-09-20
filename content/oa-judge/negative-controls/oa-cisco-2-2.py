def solve(raw):
    values=map(int,raw.split());n=next(values);older=previous=0
    for value in values:older,previous=previous,max(previous,value)
    return str(previous)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
