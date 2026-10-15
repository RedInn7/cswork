package main

import (
	"bufio"
	"os"
	"strconv"
)

type Node struct {
	Val  int
	Next *Node
}

// LinkedList 单链表 / Singly linked list with head and tail pointers.
type LinkedList struct {
	head, tail *Node
	length     int
}

func (l *LinkedList) PushFront(x int) {
	l.head = &Node{x, l.head}
	if l.tail == nil {
		l.tail = l.head
	}
	l.length++
}

func (l *LinkedList) PushBack(x int) {
	node := &Node{Val: x}
	if l.tail == nil {
		l.head = node
	} else {
		l.tail.Next = node
	}
	l.tail = node
	l.length++
}

func (l *LinkedList) PopFront() int {
	node := l.head
	l.head = node.Next
	if l.head == nil {
		l.tail = nil
	}
	l.length--
	return node.Val
}

func (l *LinkedList) Insert(i, x int) {
	if i == 0 {
		l.PushFront(x)
		return
	}
	if i == l.length {
		l.PushBack(x)
		return
	}
	prev := l.head
	for k := 0; k < i-1; k++ {
		prev = prev.Next
	}
	prev.Next = &Node{x, prev.Next}
	l.length++
}

func (l *LinkedList) Remove(x int) bool {
	var prev *Node
	node := l.head
	for node != nil && node.Val != x {
		prev, node = node, node.Next
	}
	if node == nil {
		return false
	}
	if prev == nil {
		l.head = node.Next
	} else {
		prev.Next = node.Next
	}
	if node == l.tail {
		l.tail = prev
	}
	l.length--
	return true
}

func (l *LinkedList) Reverse() {
	var prev *Node
	node := l.head
	l.tail = l.head
	for node != nil {
		node.Next, prev, node = prev, node, node.Next
	}
	l.head = prev
}

func (l *LinkedList) Size() int { return l.length }

func (l *LinkedList) Values() []int {
	out := []int{}
	for node := l.head; node != nil; node = node.Next {
		out = append(out, node.Val)
	}
	return out
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int { v, _ := strconv.Atoi(next()); return v }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	lst := &LinkedList{}
	for q := nextInt(); q > 0; q-- {
		switch next() {
		case "push_front":
			lst.PushFront(nextInt())
		case "push_back":
			lst.PushBack(nextInt())
		case "pop_front":
			w.WriteString(strconv.Itoa(lst.PopFront()) + "\n")
		case "insert":
			i := nextInt()
			lst.Insert(i, nextInt())
		case "remove":
			if lst.Remove(nextInt()) {
				w.WriteString("1\n")
			} else {
				w.WriteString("0\n")
			}
		case "reverse":
			lst.Reverse()
		case "size":
			w.WriteString(strconv.Itoa(lst.Size()) + "\n")
		default:
			v := lst.Values()
			if len(v) == 0 {
				w.WriteString("empty")
			}
			for k, x := range v {
				if k > 0 {
					w.WriteByte(' ')
				}
				w.WriteString(strconv.Itoa(x))
			}
			w.WriteByte('\n')
		}
	}
}
