package main

import (
	"bufio"
	"os"
	"strconv"
)

type trieNode struct {
	children  [26]*trieNode
	pass, end int // 经过 / 结束于该节点的单词数 / words through / ending at this node
}

// Trie 字典树 / Trie of lowercase words, counting repeated inserts.
type Trie struct {
	root trieNode
}

func (t *Trie) Insert(word string) {} // TODO

func (t *Trie) Erase(word string) bool { return false } // TODO

func (t *Trie) Search(word string) bool { return false } // TODO

func (t *Trie) CountPrefix(p string) int { return 0 } // TODO

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	sc.Split(bufio.ScanWords)
	next := func() string { sc.Scan(); return sc.Text() }
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	put := func(v int) { w.WriteString(strconv.Itoa(v)); w.WriteByte('\n') }
	bit := func(ok bool) int {
		if ok {
			return 1
		}
		return 0
	}
	trie := &Trie{}
	q, _ := strconv.Atoi(next())
	for ; q > 0; q-- {
		op, word := next(), next()
		switch op {
		case "insert":
			trie.Insert(word)
		case "erase":
			put(bit(trie.Erase(word)))
		case "search":
			put(bit(trie.Search(word)))
		default:
			put(trie.CountPrefix(word))
		}
	}
}
