package main

import (
	"bufio"
	"os"
	"strconv"
)

// UnionFind 并查集 / Union-find over nodes 1..n with path halving and union by rank.
type UnionFind struct {
	parent []int
	// TODO: 秩、集合大小、集合个数 / ranks, set sizes, number of sets
}

func NewUnionFind(n int) *UnionFind {
	u := &UnionFind{parent: make([]int, n+1)}
	for v := range u.parent {
		u.parent[v] = v
	}
	return u
}

func (u *UnionFind) Find(x int) int { return x } // TODO

func (u *UnionFind) Union(a, b int) bool { return false } // TODO

func (u *UnionFind) Same(a, b int) bool { return false } // TODO

func (u *UnionFind) Size(x int) int { return 1 } // TODO

func (u *UnionFind) Count() int { return 0 } // TODO

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
