import sys

def solve(raw):
    values=list(map(int,raw.split()))
    n,threshold=values[:2]
    streak=0
    answer=-1
    for index,value in enumerate(values[2:]):
        streak=streak+1 if value>threshold else 0
        if streak>=3:
            answer=index-2
    return str(answer)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
