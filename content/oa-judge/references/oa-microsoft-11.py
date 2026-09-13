def solve(d):
    from itertools import islice
    carry=answer=0
    for value in map(int,islice(d,1,None)):total=value+carry;answer+=total%2;carry=total//2
    return str(answer+carry.bit_count())

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
