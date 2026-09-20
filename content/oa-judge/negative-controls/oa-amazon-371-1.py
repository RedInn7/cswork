def solve(raw):
    import heapq
    s=raw.strip();counts=[0]*26;missing=0
    for c in s:
        if c=='?':missing+=1
        else:counts[ord(c)-97]+=1
    heap=[(0,i) for i,v in enumerate(counts)];heapq.heapify(heap);chosen=[0]*26
    for _ in range(missing):
        count,i=heapq.heappop(heap);chosen[i]+=1;heapq.heappush(heap,(count+1,i))
    pool=iter(''.join(chr(i+97)*count for i,count in enumerate(chosen)))
    return ''.join(next(pool) if c=='?' else c for c in s)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
