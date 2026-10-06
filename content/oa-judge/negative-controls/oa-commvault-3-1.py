def solve(raw):
 z=list(map(int,raw.split()));n,m=z[:2];e={tuple(sorted((z[2+2*i],z[3+2*i]))) for i in range(m)};return str(sum((i,j) not in e for i in range(1,n+1) for j in range(i+1,n+1)))
