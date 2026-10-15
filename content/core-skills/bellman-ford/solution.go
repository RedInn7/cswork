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
	dist := make([]int, n+1)
	for i := range dist {
		dist[i] = INF
	}
	dist[s] = 0
	for round := 1; round < n; round++ {
		changed := false
		for _, e := range edges {
			if dist[e[0]] != INF && dist[e[0]]+e[2] < dist[e[1]] {
				dist[e[1]] = dist[e[0]] + e[2]
				changed = true
			}
		}
		if !changed {
			break
		}
	}
	for _, e := range edges {
		if dist[e[0]] != INF && dist[e[0]]+e[2] < dist[e[1]] {
			return nil
		}
	}
	return dist[1:]
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
