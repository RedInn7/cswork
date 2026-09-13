from collections import deque
def solve(d):
    n,gap=map(int,d[:2]);a=list(map(int,d[2:]));ranked=sorted((v,i) for i,v in enumerate(a));minimum=deque();maximum=deque();left=0;answer=10**30
    for right,(_,index) in enumerate(ranked):
        while minimum and ranked[minimum[-1]][1]>=index:minimum.pop()
        while maximum and ranked[maximum[-1]][1]<=index:maximum.pop()
        minimum.append(right);maximum.append(right)
        while ranked[maximum[0]][1]-ranked[minimum[0]][1]>=gap:
            answer=min(answer,ranked[right][0]-ranked[left][0])
            if minimum[0]==left:minimum.popleft()
            if maximum[0]==left:maximum.popleft()
            left+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
