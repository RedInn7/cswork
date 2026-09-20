def solve(d):
    class Node:
        def __init__(self,v=0):self.v=v;self.next=None
    head=Node();tail=head
    for v in map(int,d[1:]):tail.next=Node(v);tail=tail.next
    prev=head
    while prev.next:
        if prev.next.v%2==0:prev.next=prev.next.next
        else:prev=prev.next
    out=[];cur=head.next
    while cur:out.append(cur.v);cur=cur.next
    return str(len(out))+'\n'+' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
