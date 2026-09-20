def solve(raw):
    from collections import Counter
    tasks,cool=raw.split();cool=int(cool);freq=Counter(tasks);f=max(freq.values());c=sum(v==f for v in freq.values())
    return str(max(len(tasks),(f-1)*(cool+1)+1))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
