import sys
def solve(raw):
    a,b,c,d=map(int,raw.split())
    while c>=a and d>=b:
        if (c,d)==(a,b):return 'Yes'
        if c==d:return 'Yes'
        if c>d:c-=d
        else:d-=c
    return 'No'
if __name__=='__main__':print(solve(sys.stdin.read()))
