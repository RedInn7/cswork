def solve(d):
    carry=answer=0
    for i in range(1,len(d)):
        carry+=int(d[i]);answer+=carry%2;carry//=2
    return str(answer+carry.bit_count())

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
