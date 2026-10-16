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

// DiningTable 哲学家就餐 / Dining philosophers: n at a round table, fork p between philosopher p and p + 1.
type DiningTable struct {
	n int
	// TODO: 需要的同步工具 / the synchronization you need
}

func NewDiningTable(n int) *DiningTable { return &DiningTable{n: n} }

// Dine TODO: 拿起叉子 p 和 (p + 1) % n，吃一次，再放下这两把叉子
// pick up forks p and (p + 1) % n, eat once, then put both down
func (t *DiningTable) Dine(p int, pick func(int), eat func(), drop func(int)) {}

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
		var n int
		fmt.Fscan(in, &n)
		wanted := make([]int, n)
		for p := range wanted {
			fmt.Fscan(in, &wanted[p])
		}
		table := NewDiningTable(n)
		var mu sync.Mutex
		holder, meals := make([]int, n), make([]int, n)
		for f := range holder {
			holder[f] = -1
		}
		var wg sync.WaitGroup
		for _, p := range rng.Perm(n) {
			wg.Add(1)
			go func(p int, own *rand.Rand) {
				defer wg.Done()
				left, right := p, (p+1)%n
				pick := func(f int) {
					pause(own)
					mu.Lock()
					if f != left && f != right {
						fail(r, "philosopher %d picked up fork %d, which is not next to them", p, f)
					}
					if holder[f] != -1 {
						fail(r, "philosopher %d picked up fork %d while philosopher %d held it", p, f, holder[f])
					}
					holder[f] = p
					mu.Unlock()
					pause(own)
				}
				eat := func() {
					mu.Lock()
					if holder[left] != p || holder[right] != p {
						fail(r, "philosopher %d ate without holding forks %d and %d", p, left, right)
					}
					meals[p]++
					mu.Unlock()
					pause(own)
				}
				drop := func(f int) {
					pause(own)
					mu.Lock()
					if holder[f] != p {
						fail(r, "philosopher %d put down fork %d without holding it", p, f)
					}
					holder[f] = -1
					mu.Unlock()
				}
				for i := 0; i < wanted[p]; i++ {
					pause(own)
					mu.Lock()
					before := meals[p]
					mu.Unlock()
					table.Dine(p, pick, eat, drop)
					mu.Lock()
					if meals[p] != before+1 {
						fail(r, "philosopher %d ate %d times in one dine call", p, meals[p]-before)
					}
					if holder[left] == p || holder[right] == p {
						fail(r, "philosopher %d left the table holding a fork", p)
					}
					mu.Unlock()
				}
			}(p, rand.New(rand.NewSource(rng.Int63())))
		}
		wg.Wait()
		line := make([]string, n)
		for p, m := range meals {
			line[p] = strconv.Itoa(m)
		}
		out = append(out, strings.Join(line, " "))
	}
	fmt.Println(strings.Join(out, "\n"))
}
