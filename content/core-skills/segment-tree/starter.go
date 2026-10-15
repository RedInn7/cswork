package main

import (
	"bufio"
	"os"
	"strconv"
)

// SegmentTree 线段树 / Segment tree of range sums with point updates.
type SegmentTree struct {
	// TODO
}

func NewSegmentTree(values []int64) *SegmentTree {
	return &SegmentTree{} // TODO
}

func (t *SegmentTree) Update(i int, x int64) {} // TODO

func (t *SegmentTree) Query(l, r int) int64 { return 0 } // TODO

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int { v, _ := strconv.Atoi(next()); return v }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	n, q := nextInt(), nextInt()
	values := make([]int64, n)
	for i := range values {
		values[i] = int64(nextInt())
	}
	tree := NewSegmentTree(values)
	for ; q > 0; q-- {
		op := next()
		a, b := nextInt(), nextInt()
		if op == "set" {
			tree.Update(a-1, int64(b))
		} else {
			w.WriteString(strconv.FormatInt(tree.Query(a-1, b-1), 10) + "\n")
		}
	}
}
