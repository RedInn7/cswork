package main

import (
	"bufio"
	"fmt"
	"math/rand"
	"os"
	"runtime"
	"strconv"
	"sync"
	"time"
)

// ZeroEvenOdd 零、偶、奇 / Zero, even, odd: together emit 0 1 0 2 0 3 ... 0 n, one goroutine per method.
type ZeroEvenOdd struct {
	n                           int
	zeroTurn, evenTurn, oddTurn chan struct{} // a token in a channel means it is that method's turn
}

func NewZeroEvenOdd(n int) *ZeroEvenOdd {
	z := &ZeroEvenOdd{n: n, zeroTurn: make(chan struct{}, 1), evenTurn: make(chan struct{}, 1), oddTurn: make(chan struct{}, 1)}
	z.zeroTurn <- struct{}{}
	return z
}

func (z *ZeroEvenOdd) Zero(emit func(int)) {
	for i := 1; i <= z.n; i++ {
		<-z.zeroTurn
		emit(0)
		if i%2 == 1 {
			z.oddTurn <- struct{}{}
		} else {
			z.evenTurn <- struct{}{}
		}
	}
}

func (z *ZeroEvenOdd) Even(emit func(int)) {
	for i := 2; i <= z.n; i += 2 {
		<-z.evenTurn
		emit(i)
		z.zeroTurn <- struct{}{}
	}
}

func (z *ZeroEvenOdd) Odd(emit func(int)) {
	for i := 1; i <= z.n; i += 2 {
		<-z.oddTurn
		emit(i)
		z.zeroTurn <- struct{}{}
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
		fmt.Fscan(in, &n)
		trio := NewZeroEvenOdd(n)
		methods := []func(func(int)){trio.Zero, trio.Even, trio.Odd}
		var mu sync.Mutex
		var log []int
		var wg sync.WaitGroup
		for _, k := range rng.Perm(3) {
			wg.Add(1)
			go func(k int, own *rand.Rand) {
				defer wg.Done()
				pause(own)
				methods[k](func(x int) {
					pause(own)
					mu.Lock()
					log = append(log, x)
					mu.Unlock()
					pause(own)
				})
			}(k, rand.New(rand.NewSource(rng.Int63())))
		}
		wg.Wait()
		for i, x := range log {
			if i > 0 {
				w.WriteByte(' ')
			}
			w.WriteString(strconv.Itoa(x))
		}
		w.WriteByte('\n')
	}
}
