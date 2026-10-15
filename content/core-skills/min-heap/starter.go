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

func (h *MinHeap) Push(x int) {} // TODO: 放到末尾后上浮 / append, then sift up

func (h *MinHeap) Pop() int { return 0 } // TODO: 末尾移到堆顶后下沉 / move the last to the top, then sift down

func (h *MinHeap) Top() int { return 0 } // TODO

func (h *MinHeap) Size() int { return 0 } // TODO

func (h *MinHeap) Build(values []int) {} // TODO: Floyd 建堆 / Floyd's construction

func (h *MinHeap) Dump() []int { return nil } // TODO

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
