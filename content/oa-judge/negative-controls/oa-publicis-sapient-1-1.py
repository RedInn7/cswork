def solve(raw):
 z=list(map(int,raw.split()));n=z[0];return str(sum(b*2*(n-i) for i,b in enumerate(z[1:1+n])))
