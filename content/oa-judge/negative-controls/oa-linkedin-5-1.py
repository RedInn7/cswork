def solve(raw):
    a=list(map(int,raw.split()[1:]));d=0
    for v in a:d=abs(v-d)
    total=sum(a);return f'{(total+d)//2} {(total-d)//2}'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
