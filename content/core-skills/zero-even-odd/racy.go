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

// ZeroEvenOdd without synchronization: each goroutine emits its own numbers straight away.
type ZeroEvenOdd struct{ n int }

func NewZeroEvenOdd(n int) *ZeroEvenOdd { return &ZeroEvenOdd{n: n} }

func (z *ZeroEvenOdd) Zero(emit func(int)) {
	for i := 1; i <= z.n; i++ {
		emit(0)
	}
}

func (z *ZeroEvenOdd) Even(emit func(int)) {
	for i := 2; i <= z.n; i += 2 {
		emit(i)
	}
}

func (z *ZeroEvenOdd) Odd(emit func(int)) {
	for i := 1; i <= z.n; i += 2 {
		emit(i)
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
