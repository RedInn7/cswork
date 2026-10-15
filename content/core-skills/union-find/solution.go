package main

import (
	"bufio"
	"os"
	"strconv"
)

// UnionFind 并查集 / Union-find over nodes 1..n with path halving and union by rank.
type UnionFind struct {
	parent, rank, sizes []int
	sets                int
}

func NewUnionFind(n int) *UnionFind {
	u := &UnionFind{parent: make([]int, n+1), rank: make([]int, n+1), sizes: make([]int, n+1), sets: n}
	for v := range u.parent {
		u.parent[v], u.sizes[v] = v, 1
	}
	return u
}

func (u *UnionFind) Find(x int) int {
	for u.parent[x] != x {
		u.parent[x] = u.parent[u.parent[x]]
		x = u.parent[x]
	}
	return x
}

func (u *UnionFind) Union(a, b int) bool {
	a, b = u.Find(a), u.Find(b)
	if a == b {
		return false
	}
	if u.rank[a] < u.rank[b] {
		a, b = b, a
	}
	u.parent[b] = a
	u.sizes[a] += u.sizes[b]
	if u.rank[a] == u.rank[b] {
		u.rank[a]++
	}
	u.sets--
	return true
}

func (u *UnionFind) Same(a, b int) bool { return u.Find(a) == u.Find(b) }

func (u *UnionFind) Size(x int) int { return u.sizes[u.Find(x)] }

func (u *UnionFind) Count() int { return u.sets }

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	nextInt := func() int { v, _ := strconv.Atoi(next()); return v }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	put := func(v int) { w.WriteString(strconv.Itoa(v)); w.WriteByte('\n') }
	bit := func(ok bool) int {
		if ok {
			return 1
		}
		return 0
	}
	uf := NewUnionFind(nextInt())
	for q := nextInt(); q > 0; q-- {
		switch next() {
		case "union":
			a := nextInt()
			put(bit(uf.Union(a, nextInt())))
		case "same":
			a := nextInt()
			put(bit(uf.Same(a, nextInt())))
		case "size":
			put(uf.Size(nextInt()))
		default:
			put(uf.Count())
		}
	}
}
