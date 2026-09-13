from collections import deque
def solve(data):
    n=int(data[0]);start,target=data[1:];q=deque([(start,0)]);seen={start}
    while q:
        s,d=q.popleft()
        if s==target:return str(d)
        for i in range(n):
            for c in 'xyz':
                if c==s[i] or (i and s[i-1]==c) or (i+1<n and s[i+1]==c):continue
                t=s[:i]+c+s[i+1:]
                if t not in seen:seen.add(t);q.append((t,d+1))
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
