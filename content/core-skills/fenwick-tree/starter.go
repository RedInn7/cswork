package main

import (
	"bufio"
	"os"
	"strconv"
)

// FenwickTree 树状数组 / Fenwick tree over indices 1..n: tree[i] sums (i - lowbit(i), i].
type FenwickTree struct {
	n    int
	tree []int64
}

func NewFenwickTree(values []int64) *FenwickTree {
	return &FenwickTree{len(values), make([]int64, len(values)+1)} // TODO: 建树 / build
}

func (f *FenwickTree) Add(i int, x int64) {} // TODO

func (f *FenwickTree) Prefix(i int) int64 { return 0 } // TODO

func (f *FenwickTree) Kth(k int64) int { return -1 } // TODO: 倍增 / binary lifting

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
	tree := NewFenwickTree(values)
	for ; q > 0; q-- {
		switch next() {
		case "add":
			i := nextInt()
			tree.Add(i, int64(nextInt()))
		case "prefix":
			w.WriteString(strconv.FormatInt(tree.Prefix(nextInt()), 10) + "\n")
		default:
			w.WriteString(strconv.Itoa(tree.Kth(int64(nextInt()))) + "\n")
		}
	}
}
