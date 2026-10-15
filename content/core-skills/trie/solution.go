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

func (t *Trie) walk(word string) *trieNode {
	node := &t.root
	for i := 0; i < len(word) && node != nil; i++ {
		node = node.children[word[i]-'a']
	}
	return node
}

func (t *Trie) Insert(word string) {
	node := &t.root
	node.pass++
	for i := 0; i < len(word); i++ {
		c := word[i] - 'a'
		if node.children[c] == nil {
			node.children[c] = &trieNode{}
		}
		node = node.children[c]
		node.pass++
	}
	node.end++
}

func (t *Trie) Erase(word string) bool {
	if !t.Search(word) {
		return false
	}
	node := &t.root
	node.pass--
	for i := 0; i < len(word); i++ {
		node = node.children[word[i]-'a']
		node.pass--
	}
	node.end--
	return true
}

func (t *Trie) Search(word string) bool {
	node := t.walk(word)
	return node != nil && node.end > 0
}

func (t *Trie) CountPrefix(p string) int {
	if node := t.walk(p); node != nil {
		return node.pass
	}
	return 0
}

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
