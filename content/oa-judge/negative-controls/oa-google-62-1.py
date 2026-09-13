from collections import Counter
def solve(data):
    s=data[0];right=Counter(s);left=set();answer=0
    for i in range(len(s)-1):
        c=s[i]
        left.add(c);right[c]-=1
        if right[c]==0:del right[c]
        if len(left)>=len(right):answer+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
