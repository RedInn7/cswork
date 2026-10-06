import sys
def solve(raw):
 v=list(map(int,raw.split())); n=v[0]; finish=0
 for arrival in v[1:1+n]: finish=max(finish,arrival)+299
 return str(finish)
if __name__ == "__main__": print(solve(sys.stdin.read()))
