import sys
def solve(raw):
 v=list(map(int,raw.split())); n=v[0]; moments=v[1:1+n]; finish=0
 for arrival in moments: finish=max(finish,arrival)+300
 return str(finish)
if __name__ == "__main__": print(solve(sys.stdin.read()))
