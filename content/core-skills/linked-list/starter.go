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

func (l *LinkedList) PushFront(x int) {} // TODO

func (l *LinkedList) PushBack(x int) {} // TODO

func (l *LinkedList) PopFront() int { return 0 } // TODO

func (l *LinkedList) Insert(i, x int) {} // TODO

func (l *LinkedList) Remove(x int) bool { return false } // TODO

func (l *LinkedList) Reverse() {} // TODO

func (l *LinkedList) Size() int { return 0 } // TODO

func (l *LinkedList) Values() []int { return nil } // TODO: 从 head 走到尾 / walk from head to the end

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
