def solve(raw):
 z=raw.splitlines();n=int(z[0].split()[0]);return str(sum(int(z[i].split()[0]) for i in range(1,n+1)))
