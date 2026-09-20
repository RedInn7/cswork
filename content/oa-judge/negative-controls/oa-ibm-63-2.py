def solve(raw):
    d=list(map(int,raw.split()));rows=sorted(zip(d[1::2],d[2::2]));left,right=rows[0];total=0
    for start,end in rows[1:]:
        if start>right:total+=right-left+1;left,right=start,end
        else:right=end
    return str(total+right-left+1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
