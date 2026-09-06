"""Authored fixed transport for ordinary acyclic integer linked lists."""

class ListNode:
    def __init__(self, val=0, next=None):
        self.val=val
        self.next=next

def from_values(values):
    if type(values)is not list or len(values)>100000 or any(type(v)is not int for v in values):
        raise ValueError('Expected a bounded integer list')
    sentinel=ListNode()
    tail=sentinel
    for value in values:
        tail.next=ListNode(value)
        tail=tail.next
    return sentinel.next

def to_values(node):
    values=[]
    visited=set()
    while node is not None:
        if id(node) in visited or len(values)>=100000:
            raise ValueError('Reference returned a cyclic or oversized list')
        if type(node.val)is not int:
            raise ValueError('Reference returned a noninteger node')
        visited.add(id(node))
        values.append(node.val)
        node=node.next
    return values
