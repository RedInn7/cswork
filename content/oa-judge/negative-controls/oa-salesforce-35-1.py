def solve(raw):
    values=list(map(int,raw.split()));n=values[0];a=values[1:n+1];minimum=values[-1]
    return 'Possible' if sum(a)>=minimum else 'Impossible'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
