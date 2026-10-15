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
	n := len(values)
	f := &FenwickTree{n, make([]int64, n+1)}
	copy(f.tree[1:], values)
	for i := 1; i <= n; i++ { // O(n) build
		if j := i + i&-i; j <= n {
			f.tree[j] += f.tree[i]
		}
	}
	return f
}

func (f *FenwickTree) Add(i int, x int64) {
	for ; i <= f.n; i += i & -i {
		f.tree[i] += x
	}
}

func (f *FenwickTree) Prefix(i int) int64 {
	var total int64
	for ; i > 0; i -= i & -i {
		total += f.tree[i]
	}
	return total
}

func (f *FenwickTree) Kth(k int64) int {
	if f.Prefix(f.n) < k {
		return -1
	}
	pos, step := 0, 1
	for step*2 <= f.n {
		step *= 2
	}
	for ; step > 0; step /= 2 {
		if pos+step <= f.n && f.tree[pos+step] < k {
			pos += step
			k -= f.tree[pos]
		}
	}
	return pos + 1
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
