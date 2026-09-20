def solve(d):
    import json
    from collections import deque
    queries=json.loads(''.join(d));queue=deque();out=[]
    for op,value in queries:
        if op=='INSERT':queue.append(value)
        elif len(queue)<3:out.append(['N/A'])
        else:out.append([queue.popleft(),queue.popleft(),queue.popleft()])
    return json.dumps(out,ensure_ascii=True,separators=(',',':')).replace(' ','\\u0020')

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
