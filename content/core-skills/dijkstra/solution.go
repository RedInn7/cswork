package main

import (
	"bufio"
	"container/heap"
	"os"
	"strconv"
)

type item struct {
	dist int64
	node int
}

// pairs is a container/heap min-heap ordered by distance.
type pairs []item

func (h pairs) Len() int           { return len(h) }
func (h pairs) Less(i, j int) bool { return h[i].dist < h[j].dist }
func (h pairs) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *pairs) Push(x any)        { *h = append(*h, x.(item)) }
func (h *pairs) Pop() any {
	old := *h
	x := old[len(old)-1]
	*h = old[:len(old)-1]
	return x
}

// Dijkstra / Shortest distances from s to nodes 1..n on non-negative weights; -1 if unreachable.
func Dijkstra(n int, edges [][3]int, s int) []int64 {
	adj := make([][][2]int, n+1)
	for _, e := range edges {
		adj[e[0]] = append(adj[e[0]], [2]int{e[1], e[2]})
	}
	dist := make([]int64, n+1)
	for i := range dist {
		dist[i] = -1
	}
	dist[s] = 0
	h := &pairs{{0, s}}
	for h.Len() > 0 {
		top := heap.Pop(h).(item)
		if top.dist > dist[top.node] {
			continue // stale
		}
		for _, e := range adj[top.node] {
			if d := top.dist + int64(e[1]); dist[e[0]] < 0 || d < dist[e[0]] {
				dist[e[0]] = d
				heap.Push(h, item{d, e[0]})
			}
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
	for i, d := range Dijkstra(n, edges, s) {
		if i > 0 {
			w.WriteByte(' ')
		}
		w.WriteString(strconv.FormatInt(d, 10))
	}
	w.WriteByte('\n')
}
