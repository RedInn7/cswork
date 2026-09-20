def solve(d):
    a=list(map(int,d[1:]));odd=sorted(v for v in a if v%2);even=[v for v in a if not v%2];i=j=0;out=[]
    while i<len(odd) and j<len(even):
        if odd[i]<even[j]:out.append(odd[i]);i+=1
        else:out.append(even[j]);j+=1
    out+=odd[i:]+even[j:];return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
