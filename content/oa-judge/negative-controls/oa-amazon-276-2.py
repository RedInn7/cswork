def solve(raw):
    data=list(map(int,raw.split()));n=data[0];loans=data[1:n+1];payments=data[n+1:]
    used=set();current=0
    while True:
        choices=[j for j in range(n) if j not in used and loans[j]>=current]
        if not choices:return str(len(used))
        j=min(choices,key=lambda j:payments[j]);used.add(j);current=payments[j]

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
