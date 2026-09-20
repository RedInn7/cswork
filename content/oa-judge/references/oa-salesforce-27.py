def solve(raw):
    a=list(map(int,raw.split()))[1:];difference=0
    for value in reversed(a):difference=abs(value-difference)
    total=sum(a);return f'{(total+difference)//2} {(total-difference)//2}'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
