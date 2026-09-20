def solve(d):
    a=[]
    for token in d[1:]:
        v=int(token)
        if not a or v!=a[-1]:a.append(v)
    if len(a)==1:return '2'
    answer=2
    for i in range(1,len(a)-1):
        if (a[i]-a[i-1])*(a[i+1]-a[i])<0:answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
