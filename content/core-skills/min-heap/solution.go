package main

import (
	"bufio"
	"os"
	"strconv"
)

// MinHeap 最小堆 / Binary min-heap on an array: parent (i - 1) / 2, children 2i + 1 and 2i + 2.
type MinHeap struct {
	a []int
}

func (h *MinHeap) siftUp(i int) {
	for i > 0 && h.a[i] < h.a[(i-1)/2] {
		h.a[i], h.a[(i-1)/2] = h.a[(i-1)/2], h.a[i]
		i = (i - 1) / 2
	}
}

func (h *MinHeap) siftDown(i int) {
	n := len(h.a)
	for 2*i+1 < n {
		c := 2*i + 1
		if c+1 < n && h.a[c+1] < h.a[c] {
			c++
		}
		if !(h.a[c] < h.a[i]) {
			break
		}
		h.a[i], h.a[c] = h.a[c], h.a[i]
		i = c
	}
}

func (h *MinHeap) Push(x int) {
	h.a = append(h.a, x)
	h.siftUp(len(h.a) - 1)
}

func (h *MinHeap) Pop() int {
	top := h.a[0]
	last := len(h.a) - 1
	h.a[0] = h.a[last]
	h.a = h.a[:last]
	if last > 0 {
		h.siftDown(0)
	}
	return top
}

func (h *MinHeap) Top() int { return h.a[0] }

func (h *MinHeap) Size() int { return len(h.a) }

func (h *MinHeap) Build(values []int) {
	h.a = append([]int(nil), values...)
	for i := len(h.a)/2 - 1; i >= 0; i-- {
		h.siftDown(i)
	}
}

func (h *MinHeap) Dump() []int { return append([]int(nil), h.a...) }

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
	heap := &MinHeap{}
	for q := nextInt(); q > 0; q-- {
		op := next()
		switch {
		case op == "push":
			heap.Push(nextInt())
		case op == "build":
			values := make([]int, nextInt())
			for k := range values {
				values[k] = nextInt()
			}
			heap.Build(values)
		case op == "size":
			put(heap.Size())
		case op == "dump":
			v := heap.Dump()
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
		case heap.Size() == 0:
			w.WriteString("empty\n")
		case op == "pop":
			put(heap.Pop())
		default:
			put(heap.Top())
		}
	}
}
