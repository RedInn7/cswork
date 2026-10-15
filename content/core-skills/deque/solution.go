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

func (d *RingDeque) grow() {
	next := make([]int, 2*len(d.data))
	for i := 0; i < d.size; i++ {
		next[i] = d.data[(d.head+i)%len(d.data)]
	}
	d.data, d.head = next, 0
}

func (d *RingDeque) PushFront(x int) {
	if d.size == len(d.data) {
		d.grow()
	}
	d.head = (d.head - 1 + len(d.data)) % len(d.data)
	d.data[d.head] = x
	d.size++
}

func (d *RingDeque) PushBack(x int) {
	if d.size == len(d.data) {
		d.grow()
	}
	d.data[(d.head+d.size)%len(d.data)] = x
	d.size++
}

func (d *RingDeque) PopFront() int {
	x := d.data[d.head]
	d.head = (d.head + 1) % len(d.data)
	d.size--
	return x
}

func (d *RingDeque) PopBack() int {
	x := d.Back()
	d.size--
	return x
}

func (d *RingDeque) Front() int { return d.data[d.head] }

func (d *RingDeque) Back() int { return d.Get(d.size - 1) }

func (d *RingDeque) Get(i int) int { return d.data[(d.head+i)%len(d.data)] }

func (d *RingDeque) Size() int { return d.size }

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
