package main

import (
	"bufio"
	"os"
	"strconv"
)

// LowerBound 第一个 >= x 的下标 / First index with a[i] >= x, or len(a).
func LowerBound(a []int, x int) int {
	lo, hi := 0, len(a)
	for lo < hi {
		mid := lo + (hi-lo)/2
		if a[mid] < x {
			lo = mid + 1
		} else {
			hi = mid
		}
	}
	return lo
}

// UpperBound 第一个 > x 的下标 / First index with a[i] > x, or len(a).
func UpperBound(a []int, x int) int {
	lo, hi := 0, len(a)
	for lo < hi {
		mid := lo + (hi-lo)/2
		if a[mid] <= x {
			lo = mid + 1
		} else {
			hi = mid
		}
	}
	return lo
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
	a := make([]int, n)
	for i := range a {
		a[i] = nextInt()
	}
	for ; q > 0; q-- {
		x := nextInt()
		w.WriteString(strconv.Itoa(LowerBound(a, x)) + " " + strconv.Itoa(UpperBound(a, x)) + "\n")
	}
}
