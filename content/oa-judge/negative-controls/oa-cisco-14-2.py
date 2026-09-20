def solve(raw):
    x,target=map(int,raw.split());x-=1;states={(0,True):1}
    for char in str(x):
        bound=int(char);following={}
        for (total,tight),count in states.items():
            for digit in range((bound if tight else 9)+1):
                if total+digit<=target:
                    key=total+digit,tight and digit==bound;following[key]=following.get(key,0)+count
        states=following
    answer=sum(count for (total,tight),count in states.items() if total==target)
    return str(answer or -1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
