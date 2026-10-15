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
	capacity   int
	nodes      map[int]*Node
	head, tail *Node // sentinels
}

func NewLRUCache(capacity int) *LRUCache {
	c := &LRUCache{capacity: capacity, nodes: map[int]*Node{}, head: &Node{}, tail: &Node{}}
	c.head.next, c.tail.prev = c.tail, c.head
	return c
}

func (c *LRUCache) unlink(n *Node) {
	n.prev.next, n.next.prev = n.next, n.prev
}

func (c *LRUCache) pushFront(n *Node) {
	n.prev, n.next = c.head, c.head.next
	c.head.next.prev = n
	c.head.next = n
}

func (c *LRUCache) Get(key int) int {
	n, ok := c.nodes[key]
	if !ok {
		return -1
	}
	c.unlink(n)
	c.pushFront(n)
	return n.value
}

func (c *LRUCache) Put(key, value int) int {
	if n, ok := c.nodes[key]; ok {
		n.value = value
		c.unlink(n)
		c.pushFront(n)
		return -1
	}
	n := &Node{key: key, value: value}
	c.nodes[key] = n
	c.pushFront(n)
	if len(c.nodes) <= c.capacity {
		return -1
	}
	oldest := c.tail.prev
	c.unlink(oldest)
	delete(c.nodes, oldest.key)
	return oldest.key
}

func (c *LRUCache) Keys() []int {
	out := []int{}
	for n := c.head.next; n != c.tail; n = n.next {
		out = append(out, n.key)
	}
	return out
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
