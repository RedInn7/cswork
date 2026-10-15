package main

import (
	"bufio"
	"os"
	"strconv"
)

// Partition Lomuto 划分 / Lomuto partition around a[hi]; returns the pivot's final index.
func Partition(a []int, lo, hi int) int {
	return lo // TODO
}

// QuickSort 原地升序排序 / Sort a in place.
func QuickSort(a []int) {
	// TODO
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
	n := nextInt()
	a := make([]int, n)
	for i := range a {
		a[i] = nextInt()
	}
	b := append([]int(nil), a...)
	p := Partition(b, 0, n-1)
	QuickSort(a)
	w.WriteString(strconv.Itoa(p) + "\n")
	for _, row := range [][]int{b, a} {
		for i, v := range row {
			if i > 0 {
				w.WriteByte(' ')
			}
			w.WriteString(strconv.Itoa(v))
		}
		w.WriteByte('\n')
	}
}
