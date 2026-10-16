package main

import (
	"bufio"
	"bytes"
	"fmt"
	"math/rand"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// H2O without synchronization: every atom bonds as soon as it arrives.
type H2O struct{}

func NewH2O() *H2O { return &H2O{} }

func (w *H2O) Hydrogen(bond func()) { bond() }

func (w *H2O) Oxygen(bond func()) { bond() }

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
var out []string
var failing sync.Mutex

func fail(round int, message string) {
	failing.Lock()
	fmt.Print(strings.Join(append(out, fmt.Sprintf("round %d: %s", round, message)), "\n") + "\n")
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
		var atoms string
		fmt.Fscan(in, &atoms)
		water := NewH2O()
		var mu sync.Mutex
		var log []byte
		var wg sync.WaitGroup
		for _, atom := range []byte(atoms) {
			wg.Add(1)
			go func(atom byte, own *rand.Rand) {
				defer wg.Done()
				bond := func() {
					pause(own)
					mu.Lock()
					group, molecule := log[len(log)-len(log)%3:], len(log)/3+1
					if atom == 'H' && bytes.Count(group, []byte("H")) == 2 {
						fail(r, fmt.Sprintf("molecule %d got a third hydrogen", molecule))
					}
					if atom == 'O' && bytes.IndexByte(group, 'O') >= 0 {
						fail(r, fmt.Sprintf("molecule %d got a second oxygen", molecule))
					}
					log = append(log, atom)
					mu.Unlock()
					pause(own)
				}
				pause(own)
				if atom == 'H' {
					water.Hydrogen(bond)
				} else {
					water.Oxygen(bond)
				}
			}(atom, rand.New(rand.NewSource(rng.Int63())))
		}
		wg.Wait()
		if len(log) != len(atoms) {
			fail(r, fmt.Sprintf("%d of %d atoms bonded", len(log), len(atoms)))
		}
		out = append(out, strconv.Itoa(len(atoms)/3))
	}
	fmt.Println(strings.Join(out, "\n"))
}
