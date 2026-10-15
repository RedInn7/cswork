package main

import (
	"bufio"
	"os"
	"strconv"
)

// minHeap is a small binary min-heap of node numbers.
type minHeap []int

func (h *minHeap) push(x int) {
	*h = append(*h, x)
	for i := len(*h) - 1; i > 0 && (*h)[i] < (*h)[(i-1)/2]; i = (i - 1) / 2 {
		(*h)[i], (*h)[(i-1)/2] = (*h)[(i-1)/2], (*h)[i]
	}
}

func (h *minHeap) pop() int {
	a := *h
	top, last := a[0], len(a)-1
	a[0] = a[last]
	a = a[:last]
	for i := 0; 2*i+1 < len(a); {
		c := 2*i + 1
		if c+1 < len(a) && a[c+1] < a[c] {
			c++
		}
		if a[c] >= a[i] {
			break
		}
		a[i], a[c] = a[c], a[i]
		i = c
	}
	*h = a
	return top
}

// TopoOrder Kahn 算法 / Kahn's algorithm with a min-heap: the smallest order, or nil on a cycle.
func TopoOrder(n int, edges [][2]int) []int {
	out := make([][]int, n+1)
	indegree := make([]int, n+1)
	for _, e := range edges {
		out[e[0]] = append(out[e[0]], e[1])
		indegree[e[1]]++
	}
	ready := &minHeap{}
	for v := 1; v <= n; v++ {
		if indegree[v] == 0 {
			ready.push(v)
		}
	}
	order := []int{}
	for len(*ready) > 0 {
		u := ready.pop()
		order = append(order, u)
		for _, v := range out[u] {
			indegree[v]--
			if indegree[v] == 0 {
				ready.push(v)
			}
		}
	}
	if len(order) < n {
		return nil
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
