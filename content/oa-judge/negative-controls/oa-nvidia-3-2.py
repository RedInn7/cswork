from itertools import islice
def solve(d):
    previous=0;answer=[]
    for token in islice(d,1,None):
        value=int(token);answer.append(str(previous^value));previous=int(d[1])
    return ' '.join(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
