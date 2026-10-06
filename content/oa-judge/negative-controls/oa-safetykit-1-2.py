import sys
def solve(raw):
 v=list(map(int,raw.split())); n,rotation,vf,hf=v[:4]; a=[v[4+i*n:4+(i+1)*n] for i in range(n)]
 for _ in range(rotation//90): a=[list(row) for row in zip(*a[::-1])]
 if hf: a=[row[::-1] for row in a]
 return "\n".join(" ".join(map(str,row)) for row in a)
if __name__ == "__main__": print(solve(sys.stdin.read()))
