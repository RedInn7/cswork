def solve(data):
    values=list(map(int,data[2:])); intervals=sorted(zip(values[::2],values[1::2])); result=[]
    for left,right in intervals:
        if result and left<=result[-1][1]:result[-1][1]=min(result[-1][1],right)
        else:result.append([left,right])
    return str(len(result))+''.join(f'\n{a} {b}' for a,b in result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
