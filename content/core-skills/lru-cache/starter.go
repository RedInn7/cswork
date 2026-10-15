package main

import (
	"bufio"
	"os"
	"strconv"
)

type Node struct {
	key, value int
	prev, next *Node
}

// LRUCache LRU 缓存 / LRU cache: a hash map to the nodes of a doubly linked list, most recent first.
type LRUCache struct {
	capacity int
	nodes    map[int]*Node
	// TODO: 双向链表（建议用两个哨兵节点） / the doubly linked list (two sentinels help)
}

func NewLRUCache(capacity int) *LRUCache {
	return &LRUCache{capacity: capacity, nodes: map[int]*Node{}}
}

func (c *LRUCache) Get(key int) int { return -1 } // TODO

func (c *LRUCache) Put(key, value int) int { return -1 } // TODO: 返回被淘汰的键或 -1 / the evicted key, or -1

func (c *LRUCache) Keys() []int { return nil } // TODO: 从最近到最久 / most recent first

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
	cache := NewLRUCache(nextInt())
	for q := nextInt(); q > 0; q-- {
		switch next() {
		case "get":
			put(cache.Get(nextInt()))
		case "put":
			k := nextInt()
			put(cache.Put(k, nextInt()))
		default:
			keys := cache.Keys()
			if len(keys) == 0 {
				w.WriteString("empty")
			}
			for i, k := range keys {
				if i > 0 {
					w.WriteByte(' ')
				}
				w.WriteString(strconv.Itoa(k))
			}
			w.WriteByte('\n')
		}
	}
}
