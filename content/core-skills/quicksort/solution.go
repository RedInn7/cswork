package main

import (
	"bufio"
	"math/rand"
	"os"
	"strconv"
)

// Partition Lomuto 划分 / Lomuto partition around a[hi]; returns the pivot's final index.
func Partition(a []int, lo, hi int) int {
	pivot, i := a[hi], lo
	for j := lo; j < hi; j++ {
		if a[j] < pivot {
			a[i], a[j] = a[j], a[i]
			i++
		}
	}
	a[i], a[hi] = a[hi], a[i]
	return i
}

func sortRange(a []int, lo, hi int) {
	for lo < hi {
		r := lo + rand.Intn(hi-lo+1)
		a[r], a[hi] = a[hi], a[r]
		p := Partition(a, lo, hi)
		// Recurse into the shorter side, loop on the longer: O(log n) deep.
		if p-lo < hi-p {
			sortRange(a, lo, p-1)
			lo = p + 1
		} else {
			sortRange(a, p+1, hi)
			hi = p - 1
		}
	}
}

// QuickSort 原地升序排序 / Sort a in place: random pivots.
func QuickSort(a []int) { sortRange(a, 0, len(a)-1) }

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
