package main

import (
	"bufio"
	"os"
	"strconv"
)

// MergeSort 归并排序 / Sort a in place and return its inversion count.
func MergeSort(a []int) int64 {
	return 0 // TODO
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
	w.WriteString(strconv.FormatInt(MergeSort(a), 10) + "\n")
	for i, v := range a {
		if i > 0 {
			w.WriteByte(' ')
		}
		w.WriteString(strconv.Itoa(v))
	}
	w.WriteByte('\n')
}
