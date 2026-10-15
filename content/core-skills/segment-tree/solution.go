package main

import (
	"bufio"
	"os"
	"strconv"
)

// SegmentTree 线段树 / Iterative segment tree of sums: leaves at n..2n-1, node k's parent at k / 2.
type SegmentTree struct {
	n    int
	tree []int64
}

func NewSegmentTree(values []int64) *SegmentTree {
	n := len(values)
	t := &SegmentTree{n, make([]int64, 2*n)}
	copy(t.tree[n:], values)
	for k := n - 1; k > 0; k-- {
		t.tree[k] = t.tree[2*k] + t.tree[2*k+1]
	}
	return t
}

func (t *SegmentTree) Update(i int, x int64) {
	k := i + t.n
	t.tree[k] = x
	for k /= 2; k >= 1; k /= 2 {
		t.tree[k] = t.tree[2*k] + t.tree[2*k+1]
	}
}

func (t *SegmentTree) Query(l, r int) int64 {
	var total int64
	for l, r = l+t.n, r+t.n+1; l < r; l, r = l/2, r/2 {
		if l&1 == 1 {
			total += t.tree[l]
			l++
		}
		if r&1 == 1 {
			r--
			total += t.tree[r]
		}
	}
	return total
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
