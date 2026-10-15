package main

import (
	"bufio"
	"os"
	"strconv"
)

func sortRange(a, buf []int, lo, hi int) int64 { // [lo, hi)
	if hi-lo < 2 {
		return 0
	}
	mid := (lo + hi) / 2
	count := sortRange(a, buf, lo, mid) + sortRange(a, buf, mid, hi)
	i, j := lo, mid
	for k := lo; k < hi; k++ {
		if j >= hi || (i < mid && a[i] <= a[j]) {
			buf[k] = a[i]
			i++
		} else {
			buf[k] = a[j]
			j++
			count += int64(mid - i)
		}
	}
	copy(a[lo:hi], buf[lo:hi])
	return count
}

// MergeSort 归并排序 / Sort a in place and return its inversion count.
func MergeSort(a []int) int64 {
	return sortRange(a, make([]int, len(a)), 0, len(a))
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
