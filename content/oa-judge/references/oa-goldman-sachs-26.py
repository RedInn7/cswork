import sys
def solve(raw):
    a,b,c,d=map(int,raw.split())
    if c<a or d<b:return 'No'
    # Each reverse step is forced: if c>d, only (c-d,d) can precede
    # (c,d); if d>c, only (c,d-c) can precede it. Coordinates stay positive.
    while (c,d)!=(a,b):
        if c<a or d<b:return 'No'
        if c==d:return 'No'
        if c>d:c-=d
        else:d-=c
    return 'Yes'
if __name__=='__main__':print(solve(sys.stdin.read()))
