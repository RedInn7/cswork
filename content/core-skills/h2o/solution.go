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

// H2O 造水分子 / Water: one goroutine per atom; bond() calls come in threes, two hydrogens and one oxygen.
type H2O struct {
	mu     sync.Mutex
	cond   *sync.Cond
	h, o   int // atoms let into the molecule being built
	bonded int // of those, how many have bonded
}

func NewH2O() *H2O {
	w := &H2O{}
	w.cond = sync.NewCond(&w.mu)
	return w
}

func (w *H2O) join(hydrogen bool, bond func()) {
	w.mu.Lock()
	for hydrogen && w.h == 2 || !hydrogen && w.o == 1 {
		w.cond.Wait() // no seat left for this atom in the current molecule
	}
	if hydrogen {
		w.h++
	} else {
		w.o++
	}
	w.cond.Broadcast()
	for w.h < 2 || w.o < 1 {
		w.cond.Wait() // the molecule is not complete yet
	}
	w.mu.Unlock()
	bond()
	w.mu.Lock()
	if w.bonded++; w.bonded == 3 {
		w.h, w.o, w.bonded = 0, 0, 0 // all three bonded: open the next molecule
		w.cond.Broadcast()
	}
	w.mu.Unlock()
}

func (w *H2O) Hydrogen(bond func()) { w.join(true, bond) }

func (w *H2O) Oxygen(bond func()) { w.join(false, bond) }

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
