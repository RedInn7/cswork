package main

import (
	"bufio"
	"os"
	"strconv"
)

// Dijkstra / Shortest distances from s to nodes 1..n on non-negative weights; -1 if unreachable.
// 堆可以用 container/heap（记得在 import 里加上） / for the heap, container/heap works (add it to the imports).
func Dijkstra(n int, edges [][3]int, s int) []int64 {
	dist := make([]int64, n)
	for i := range dist {
		dist[i] = -1 // TODO
	}
	return dist
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
	n, m, s := nextInt(), nextInt(), nextInt()
	edges := make([][3]int, m)
	for i := range edges {
		edges[i] = [3]int{nextInt(), nextInt(), nextInt()}
	}
	for i, d := range Dijkstra(n, edges, s) {
		if i > 0 {
			w.WriteByte(' ')
		}
		w.WriteString(strconv.FormatInt(d, 10))
	}
	w.WriteByte('\n')
}
