def solve(d):
    s=d[0]; diff=[0]*(len(s)+1)
    for k in map(int,d[2:]):diff[0]+=1;diff[k]-=1
    count=0;result=[]
    for i,c in enumerate(s):count+=diff[i];result.append(chr(97+(ord(c)-96+count)%26))
    return ''.join(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
