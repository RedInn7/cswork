def solve(raw):
    a=list(map(int,raw.split()[1:]));stack=[];answer=0;n=len(a)
    for i in range(n+1):
        while stack and (i==n or a[stack[-1]]<=a[i]):
            j=stack.pop();left=j-(stack[-1] if stack else -1);right=i-j
            answer+=a[j]*left*right
        stack.append(i)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
