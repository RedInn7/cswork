def solve(data):
    rows,cols=map(int,data[:2]); offset=2; a=[]
    for _ in range(rows):a.append(list(map(int,data[offset:offset+cols]))); offset+=cols
    q=int(data[offset]); offset+=1
    for _ in range(q):
        t=data[offset]; offset+=1
        if t=='rotate90Clockwise':a=[list(row) for row in zip(*a[::-1])]
        elif t=='swapRows':
            i,j=map(int,data[offset:offset+2]); offset+=2; a[i],a[j]=a[j],a[i]
        elif t=='swapColumns':
            i,j=map(int,data[offset:offset+2]); offset+=2
            for row in a:row[i],row[j]=row[j],row[i]
        elif t=='reverseRow':
            i=int(data[offset]); offset+=1; a[i].sort()
        else:
            j=int(data[offset]); offset+=1
            for i in range(len(a)//2):a[i][j],a[-1-i][j]=a[-1-i][j],a[i][j]
    return f'{len(a)} {len(a[0])}\n'+'\n'.join(' '.join(map(str,row)) for row in a)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
