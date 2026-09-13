def solve(data):
    lengths={}; best=0; answers=[]
    for x in map(int,data[1:]):
        if x not in lengths:
            left=lengths.get(x-1,0); right=lengths.get(x+1,0); total=left+right+1
            lengths[x]=total; lengths[x-left]=total; lengths[x+right]=total; best=max(best,total)
        answers.append(best)
    return ' '.join(map(str,answers))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
