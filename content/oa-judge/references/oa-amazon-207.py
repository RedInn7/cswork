def solve(d):
    n=int(d[0]);skills=list(map(int,d[1:1+n]));types=list(map(int,d[1+n:]));minimum={0:0};balance=total=answer=0
    for value,t in zip(skills,types):
        balance+=1 if t else -1;total+=value
        if balance in minimum:answer=max(answer,total-minimum[balance]);minimum[balance]=min(minimum[balance],total)
        else:minimum[balance]=total
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
