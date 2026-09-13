def solve(data):
    n,m,q=map(int,data[:3]);images=data[3:3+n];favs=data[3+n:];marked=set(favs);first=0;second=0;answer=[]
    for _ in range(q):
        if first<m:answer.append(favs[first]);first+=1
        else:
            while second<n and False:second+=1
            if second<n:answer.append(images[second]);second+=1
            else:answer.append('NULL')
    return ' '.join(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
