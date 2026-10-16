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

// BoundedBlockingQueue with no lock and no capacity check: Put never waits, Take spins until something shows up.
type BoundedBlockingQueue struct{ items []int }

func NewBoundedBlockingQueue(capacity int) *BoundedBlockingQueue { return &BoundedBlockingQueue{} }

func (q *BoundedBlockingQueue) Put(x int) { q.items = append(q.items, x) }

func (q *BoundedBlockingQueue) Take() int {
	for len(q.items) == 0 {
		runtime.Gosched()
	}
	x := q.items[0]
	q.items = q.items[1:]
	return x
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
var out []string
var failing sync.Mutex

func fail(round int, format string, args ...interface{}) {
	failing.Lock()
	fmt.Print(strings.Join(append(out, fmt.Sprintf("round %d: ", round)+fmt.Sprintf(format, args...)), "\n") + "\n")
	os.Exit(0)
}

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
	for r := 1; r <= rounds; r++ {
		var capacity, producers, consumers, k int
		fmt.Fscan(in, &capacity, &producers, &consumers, &k)
		total := producers * k
		queue := NewBoundedBlockingQueue(capacity)
		var mu sync.Mutex
		started, taken := make([]bool, total+1), make([]bool, total+1)
		puts, takes, done, sum := 0, 0, 0, 0 // puts returned, takes begun, takes returned, sum taken
		var workers []func(*rand.Rand)
		for i := 0; i < producers; i++ {
			i := i
			workers = append(workers, func(own *rand.Rand) {
				for x := i*k + 1; x <= i*k+k; x++ {
					pause(own)
					mu.Lock()
					started[x] = true
					mu.Unlock()
					queue.Put(x)
					mu.Lock()
					// At least puts - takes items are inside the queue right now.
					if puts++; puts-takes > capacity {
						fail(r, "the queue went over its capacity of %d", capacity)
					}
					mu.Unlock()
				}
			})
		}
		for j := 0; j < consumers; j++ {
			share := total / consumers
			if j < total%consumers {
				share++
			}
			workers = append(workers, func(own *rand.Rand) {
				last := make([]int, producers) // the last item this consumer took from each producer
				if own.Float64() < 0.5 {
					time.Sleep(time.Millisecond) // let the producers run ahead
				}
				for n := 0; n < share; n++ {
					pause(own)
					mu.Lock()
					takes++
					mu.Unlock()
					x := queue.Take()
					mu.Lock()
					if x < 1 || x > total || !started[x] {
						fail(r, "take() returned %d, which was never put", x)
					}
					if taken[x] {
						fail(r, "%d was taken twice", x)
					}
					p := (x - 1) / k
					if x < last[p] {
						fail(r, "%d came out after %d, though it was put first", x, last[p])
					}
					taken[x], last[p] = true, x
					done++
					sum += x
					mu.Unlock()
				}
			})
		}
		var wg sync.WaitGroup
		for _, w := range rng.Perm(len(workers)) {
			wg.Add(1)
			go func(work func(*rand.Rand), own *rand.Rand) {
				defer wg.Done()
				work(own)
			}(workers[w], rand.New(rand.NewSource(rng.Int63())))
		}
		wg.Wait()
		if done != total {
			fail(r, "only %d of %d items came out", done, total)
		}
		out = append(out, fmt.Sprintf("%d %d", total, sum))
	}
	fmt.Println(strings.Join(out, "\n"))
}
