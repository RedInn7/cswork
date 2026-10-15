package main

import (
	"bufio"
	"os"
	"strconv"
)

// TopoOrder Kahn 算法 / Kahn's algorithm with a min-heap: the smallest order, or nil on a cycle.
// Go 没有现成的整数堆：可以用 container/heap，或者手写一个 / Go has no ready-made int heap: use container/heap or write one.
func TopoOrder(n int, edges [][2]int) []int {
	return nil // TODO
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
	n, m := nextInt(), nextInt()
	edges := make([][2]int, m)
	for i := range edges {
		edges[i] = [2]int{nextInt(), nextInt()}
	}
	order := TopoOrder(n, edges)
	if len(order) == 0 {
		w.WriteString("-1")
	}
	for i, v := range order {
		if i > 0 {
			w.WriteByte(' ')
		}
		w.WriteString(strconv.Itoa(v))
	}
	w.WriteByte('\n')
}
