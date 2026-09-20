def solve(raw):
    values=map(int,raw.split());n=next(values);answer=0
    for bit in values:answer=answer*2+bit
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
