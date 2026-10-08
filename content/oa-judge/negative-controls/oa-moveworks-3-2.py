import sys
from itertools import combinations
from bisect import bisect_left, bisect_right

MOD=998244353

def solve(raw):
    data=list(map(int,raw.split()))
    queries=list(zip(data[1::2],data[2::2]))
    maximum=max(r for l,r in queries)
    numbers=[]
    for length in range(2,maximum.bit_length()+1):
        base=(1<<length)-1
        for count in range(1,4):
            for positions in combinations(range(length-1),count):
                value=base-sum(1<<p for p in positions)
                if value<=maximum:
                    numbers.append(value)
    numbers.sort()
    prefix=[0]
    for value in numbers:
        prefix.append((prefix[-1]+pow(value,3,MOD))%MOD)
    return '\n'.join(str((prefix[bisect_left(numbers,r)]-prefix[bisect_left(numbers,l)])%MOD) for l,r in queries)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
