package main

import (
	"bufio"
	"os"
	"sort"
	"strconv"
)

// Kruskal / Indices of the chosen edges in the order chosen; fewer than n - 1 if disconnected.
func Kruskal(n int, edges [][3]int) []int {
	parent, rank := make([]int, n+1), make([]int, n+1)
	for v := range parent {
		parent[v] = v
	}
	find := func(x int) int {
		for parent[x] != x {
			parent[x] = parent[parent[x]] // path halving
			x = parent[x]
		}
		return x
	}
	order := make([]int, len(edges))
	for i := range order {
		order[i] = i
	}
	sort.SliceStable(order, func(i, j int) bool { return edges[order[i]][2] < edges[order[j]][2] })
	chosen := []int{}
	for _, i := range order {
		a, b := find(edges[i][0]), find(edges[i][1])
		if a == b {
			continue
		}
		if rank[a] < rank[b] {
			a, b = b, a
		}
		parent[b] = a
		if rank[a] == rank[b] {
			rank[a]++
		}
		chosen = append(chosen, i)
		if len(chosen) == n-1 {
			break
		}
	}
	return chosen
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
	edges := make([][3]int, m)
	for i := range edges {
		edges[i] = [3]int{nextInt(), nextInt(), nextInt()}
	}
	chosen := Kruskal(n, edges)
	if len(chosen) != n-1 {
		w.WriteString("-1\n")
		return
	}
	total := 0
	for _, i := range chosen {
		total += edges[i][2]
	}
	w.WriteString(strconv.Itoa(total) + "\n")
	for k, i := range chosen {
		if k > 0 {
			w.WriteByte(' ')
		}
		w.WriteString(strconv.Itoa(i + 1))
	}
	w.WriteByte('\n')
}
