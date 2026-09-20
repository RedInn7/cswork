def solve(d):
    count=int(d[0]);at=1;transactions=[];masks={}
    for i in range(count):
        size=int(d[at]);at+=1;names=sorted(set(d[at:at+size]));at+=size;transactions.append(names);bit=1<<i
        for name in names:masks[name]=masks.get(name,0)|bit
    best=0;answer=None
    for names in transactions:
        for i,a in enumerate(names):
            left=masks[a]
            for j in range(i+1,len(names)):
                b=names[j];frequency=(left&masks[b]).bit_count();pair=(a,b)
                if frequency>best or frequency==best and (answer is None or pair<answer):best=frequency;answer=pair
    return '-1' if answer is None else ' '.join(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
