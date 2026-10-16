package main

import (
	"bufio"
	"fmt"
	"math/rand"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"
)

// FooBar 交替输出 / Take turns: Foo and Bar each call emit n times, Foo first, strictly alternating.
type FooBar struct {
	n                int
	fooTurn, barTurn chan struct{} // a token in a channel means it is that side's turn
}

func NewFooBar(n int) *FooBar {
	f := &FooBar{n: n, fooTurn: make(chan struct{}, 1), barTurn: make(chan struct{}, 1)}
	f.fooTurn <- struct{}{}
	return f
}

func (f *FooBar) Foo(emit func()) {
	for i := 0; i < f.n; i++ {
		<-f.fooTurn
		emit()
		f.barTurn <- struct{}{}
	}
}

func (f *FooBar) Bar(emit func()) {
	for i := 0; i < f.n; i++ {
		<-f.barTurn
		emit()
		f.fooTurn <- struct{}{}
	}
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
func pause(rng *rand.Rand) {
	r := rng.Float64()
	if r < 0.4 {
		runtime.Gosched()
	} else if r < 0.45 {
		time.Sleep(50 * time.Microsecond)
	}
}

func main() {
	in := bufio.NewReader(os.Stdin)
	var seed int64
	var rounds int
	fmt.Fscan(in, &seed, &rounds)
	rng := rand.New(rand.NewSource(seed))
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	for r := 0; r < rounds; r++ {
		var n int
		words := make([]string, 2)
		fmt.Fscan(in, &n, &words[0], &words[1])
		pair := NewFooBar(n)
		sides := []func(func()){pair.Foo, pair.Bar}
		var mu sync.Mutex
		var log []string
		var wg sync.WaitGroup
		for _, k := range rng.Perm(2) {
			wg.Add(1)
			go func(k int, own *rand.Rand) {
				defer wg.Done()
				pause(own)
				sides[k](func() {
					pause(own)
					mu.Lock()
					log = append(log, words[k])
					mu.Unlock()
					pause(own)
				})
			}(k, rand.New(rand.NewSource(rng.Int63())))
		}
		wg.Wait()
		fmt.Fprintln(w, strings.Join(log, " "))
	}
}
