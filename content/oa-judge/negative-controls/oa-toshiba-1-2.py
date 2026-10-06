def solve(raw):
 z=list(map(int,raw.split()));return str(sum((-x)%3 for x in z[1:]))
