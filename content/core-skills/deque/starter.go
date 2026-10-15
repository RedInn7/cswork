package main

import (
	"bufio"
	"os"
	"strconv"
)

// RingDeque 双端队列 / Deque on a ring buffer: element i lives at data[(head + i) % capacity].
type RingDeque struct {
	data       []int
	head, size int
}

func NewRingDeque() *RingDeque {
	return &RingDeque{data: make([]int, 4)}
}

func (d *RingDeque) PushFront(x int) {} // TODO

func (d *RingDeque) PushBack(x int) {} // TODO

func (d *RingDeque) PopFront() int { return 0 } // TODO

func (d *RingDeque) PopBack() int { return 0 } // TODO

func (d *RingDeque) Front() int { return 0 } // TODO

func (d *RingDeque) Back() int { return 0 } // TODO

func (d *RingDeque) Get(i int) int { return 0 } // TODO

func (d *RingDeque) Size() int { return 0 } // TODO

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int { v, _ := strconv.Atoi(next()); return v }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	put := func(v int) { w.WriteString(strconv.Itoa(v)); w.WriteByte('\n') }
	dq := NewRingDeque()
	for q := nextInt(); q > 0; q-- {
		op := next()
		switch {
		case op == "push_front":
			dq.PushFront(nextInt())
		case op == "push_back":
			dq.PushBack(nextInt())
		case op == "get":
			put(dq.Get(nextInt()))
		case op == "size":
			put(dq.Size())
		case dq.Size() == 0:
			w.WriteString("empty\n")
		case op == "pop_front":
			put(dq.PopFront())
		case op == "pop_back":
			put(dq.PopBack())
		case op == "front":
			put(dq.Front())
		default:
			put(dq.Back())
		}
	}
}
