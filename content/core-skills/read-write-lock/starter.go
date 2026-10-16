package main

import (
	"bufio"
	"fmt"
	"math/rand"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// RWLock 读写锁 / Read-write lock: many readers at once, or a single writer alone.
// Build it on sync.Mutex and sync.Cond, not sync.RWMutex.
type RWLock struct {
	// TODO: 锁、条件变量和计数 / a lock, a condition variable and some counts
}

func NewRWLock() *RWLock { return &RWLock{} }

func (l *RWLock) AcquireRead() {} // TODO: 没有写者时进入 / get in once no writer holds the lock

func (l *RWLock) ReleaseRead() {} // TODO

func (l *RWLock) AcquireWrite() {} // TODO: 没有读者也没有写者时进入 / get in once nobody else holds the lock

func (l *RWLock) ReleaseWrite() {} // TODO

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
	run := func(workers []func(*rand.Rand)) {
		var wg sync.WaitGroup
		for _, w := range rng.Perm(len(workers)) {
			wg.Add(1)
			go func(work func(*rand.Rand), own *rand.Rand) {
				defer wg.Done()
				work(own)
			}(workers[w], rand.New(rand.NewSource(rng.Int63())))
		}
		wg.Wait()
	}
	for r := 1; r <= rounds; r++ {
		var kind string
		fmt.Fscan(in, &kind)
		lock := NewRWLock()
		switch kind {
		case "hold":
			// While the driver holds the lock, goroutines that try to get in must stay out.
			entered := make(chan struct{}, 2)
			var wg sync.WaitGroup
			probe := func(acquire, release func()) {
				wg.Add(1)
				go func() {
					defer wg.Done()
					acquire()
					entered <- struct{}{}
					release()
				}()
			}
			keptOut := func(message string) {
				select {
				case <-entered:
					fail(r, message)
				case <-time.After(100 * time.Millisecond):
				}
			}
			lock.AcquireWrite()
			probe(lock.AcquireRead, lock.ReleaseRead)
			probe(lock.AcquireWrite, lock.ReleaseWrite)
			keptOut("a thread got in while the write lock was held")
			lock.ReleaseWrite()
			wg.Wait()
			<-entered
			<-entered
			lock.AcquireRead()
			probe(lock.AcquireWrite, lock.ReleaseWrite)
			keptOut("a writer got in while a read lock was held")
			lock.ReleaseRead()
			wg.Wait()
			out = append(out, "held")
		case "share":
			// Every reader must be able to hold the read lock at once.
			var n int
			fmt.Fscan(in, &n)
			var mu sync.Mutex
			arrived, all := 0, make(chan struct{})
			workers := make([]func(*rand.Rand), n)
			for i := range workers {
				workers[i] = func(own *rand.Rand) {
					pause(own)
					lock.AcquireRead()
					mu.Lock()
					if arrived++; arrived == n {
						close(all)
					}
					mu.Unlock()
					select {
					case <-all:
					case <-time.After(2 * time.Second):
						fail(r, "%d readers could not hold the read lock at the same time", n)
					}
					lock.ReleaseRead()
				}
			}
			run(workers)
			out = append(out, strconv.Itoa(n))
		default:
			var readers, writers, ops int
			fmt.Fscan(in, &readers, &writers, &ops)
			var mu sync.Mutex
			var data [2]int // a writer adds its value to both; a reader must never see them differ
			readersIn, writersIn := 0, 0
			var workers []func(*rand.Rand)
			for i := 0; i < readers; i++ {
				workers = append(workers, func(own *rand.Rand) {
					for n := 0; n < ops; n++ {
						pause(own)
						lock.AcquireRead()
						mu.Lock()
						if writersIn > 0 {
							fail(r, "a reader got in while a writer held the lock")
						}
						readersIn++
						mu.Unlock()
						a := data[0]
						pause(own)
						b := data[1]
						if a != b {
							fail(r, "a reader saw a half-done write (%d and %d)", a, b)
						}
						mu.Lock()
						readersIn--
						mu.Unlock()
						lock.ReleaseRead()
					}
				})
			}
			for i := 0; i < writers; i++ {
				var v int
				fmt.Fscan(in, &v)
				workers = append(workers, func(own *rand.Rand) {
					for n := 0; n < ops; n++ {
						pause(own)
						lock.AcquireWrite()
						mu.Lock()
						if writersIn > 0 || readersIn > 0 {
							fail(r, "a writer got in while another thread held the lock")
						}
						writersIn++
						mu.Unlock()
						a := data[0]
						pause(own)
						data[0] = a + v
						pause(own)
						data[1] += v
						mu.Lock()
						writersIn--
						mu.Unlock()
						lock.ReleaseWrite()
					}
				})
			}
			run(workers)
			out = append(out, strconv.Itoa(data[0]))
		}
	}
	fmt.Println(strings.Join(out, "\n"))
}
