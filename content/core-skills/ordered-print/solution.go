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

// InOrder 按序执行 / Run in order: three goroutines call First, Second and Third once each, in any order.
type InOrder struct {
	firstDone, secondDone chan struct{} // closed when that job has finished
}

func NewInOrder() *InOrder {
	return &InOrder{firstDone: make(chan struct{}), secondDone: make(chan struct{})}
}

func (o *InOrder) First(job func()) {
	job()
	close(o.firstDone)
}

func (o *InOrder) Second(job func()) {
	<-o.firstDone
	job()
	close(o.secondDone)
}

func (o *InOrder) Third(job func()) {
	<-o.secondDone
	job()
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
		words := make([]string, 3)
		fmt.Fscan(in, &words[0], &words[1], &words[2])
		order := NewInOrder()
		steps := []func(func()){order.First, order.Second, order.Third}
		var mu sync.Mutex
		var log []string
		var wg sync.WaitGroup
		for _, k := range rng.Perm(3) {
			wg.Add(1)
			go func(k int, own *rand.Rand) {
				defer wg.Done()
				pause(own)
				steps[k](func() {
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
