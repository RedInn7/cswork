package main

import (
	"bufio"
	"math"
	"os"
	"strconv"
)

// INF 到不了 / unreachable.
const INF = math.MaxInt64

// BellmanFord / Distances from s to nodes 1..n (INF if unreachable), or nil if s reaches a negative cycle.
func BellmanFord(n int, edges [][3]int, s int) []int {
	dist := make([]int, n)
	for i := range dist {
		dist[i] = INF // TODO
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
	dist := BellmanFord(n, edges, s)
	if dist == nil {
		w.WriteString("NEGATIVE CYCLE\n")
		return
	}
	for i, d := range dist {
		if i > 0 {
			w.WriteByte(' ')
		}
		if d == INF {
			w.WriteString("INF")
		} else {
			w.WriteString(strconv.Itoa(d))
		}
	}
	w.WriteByte('\n')
}
