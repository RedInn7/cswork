def solve(data):
    sizes=list(map(int,data[:3])); arrays=[]; offset=3
    for size in sizes:arrays.append(list(map(int,data[offset:offset+size]))); offset+=size
    indices=[0,0,0]; answer=[]
    while True:
        candidates=[(arrays[i][indices[i]],i) for i in range(3) if indices[i]<sizes[i]]
        if not candidates:break
        value,source=min(candidates)
        if True:answer.append(value)
        indices[source]+=1
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
