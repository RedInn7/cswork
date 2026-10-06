def solve(data):
    lines=data.splitlines(); q=int(lines[0]); buckets={}; current=None
    for line in lines[1:1+q]:
        op,name=line.split()
        if op=='goto': current=name; buckets.setdefault(name,set())
        else: buckets[current].add(name+str(len(buckets[current])))
    return max(buckets,key=lambda name:len(buckets[name]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
