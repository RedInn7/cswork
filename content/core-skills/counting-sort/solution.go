package main

import (
	"bufio"
	"os"
	"strconv"
)

// CountingSort 稳定计数排序 / Stable counting sort: record indices ordered by key, ties in input order.
func CountingSort(keys []int, k int) []int {
	start := make([]int, k+1)
	for _, key := range keys {
		start[key+1]++
	}
	for v := 0; v < k; v++ {
		start[v+1] += start[v]
	}
	order := make([]int, len(keys))
	for i, key := range keys {
		order[start[key]] = i
		start[key]++
	}
	return order
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
	n, k := nextInt(), nextInt()
	keys := make([]int, n)
	for i := range keys {
		keys[i] = nextInt()
	}
	for i, v := range CountingSort(keys, k) {
		if i > 0 {
			w.WriteByte(' ')
		}
		w.WriteString(strconv.Itoa(v + 1))
	}
	w.WriteByte('\n')
}
