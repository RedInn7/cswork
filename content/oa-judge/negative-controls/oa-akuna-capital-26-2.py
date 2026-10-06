import sys
def solve(raw):
 t=list(map(int,raw.split()));N,m=t[:2];return str((N-sum(t[i+1]-t[i]+1 for i in range(2,len(t),2))).bit_count())
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
