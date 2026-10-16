# Building Water

Every atom is a thread: a hydrogen calls `hydrogen(bond)` and an oxygen calls `oxygen(bond)`, once each. Atoms arrive in random order. Implement `H2O` so the atoms form water molecules:

- Every atom calls `bond()` once, joining a molecule.
- Taken in the order they happen, every three `bond()` calls form one molecule, which must be exactly two hydrogens and one oxygen.
- No atom of the next molecule may start `bond()` until all three `bond()` calls of the current molecule have finished.
- An atom waits until a whole molecule can form: if three hydrogens have arrived and no oxygen yet, the third hydrogen has to wait for the next molecule.

| Method | Does |
| --- | --- |
| `hydrogen(bond)` | A hydrogen: wait for its molecule's turn, then call bond once |
| `oxygen(bond)` | An oxygen: wait for its molecule's turn, then call bond once |

The driver runs many rounds. Each round makes a new `H2O`, starts the atom threads in the order given, and randomly yields or sleeps briefly around each `bond`. It records every `bond` itself and reports a wrongly built molecule the moment it happens. The judge only compares output, so building the answer without threads would also pass, but it would skip the concurrency this problem is about.

## Input

The first line holds a random seed and the number of rounds R. Each of the next R lines is a string of H and O: the order in which that round's atom threads start. Every string has exactly twice as many H as O.

1 ≤ R ≤ 100, each string holds 1 to 6 O, and 0 ≤ seed < 2^31.

## Output

For a round in which every atom bonds correctly, one line: the number of molecules formed.

As soon as the driver finds a problem, it prints one more line after those already printed, round k: followed by what went wrong, and stops. The problems are molecule m got a third hydrogen, molecule m got a second oxygen, and a of b atoms bonded (only a atoms of the round called bond).

## Explanation

In the second round the atoms start in the order OOHHHH. When the second oxygen arrives, the first molecule still lacks its hydrogens, so the second oxygen has to wait until all three bonds of the first molecule have finished before it joins the second. The round forms 2 molecules.

## Hints

- The classic approach: a hydrogen semaphore starting at 2 and an oxygen semaphore starting at 1 count the free seats in the current molecule; atoms with a seat meet at a three-party barrier, call bond, then give the seat back.
- Give the seat back only after bond, so the next molecule cannot fill up until all three bonds of this one have finished.
- One condition variable also works: count the hydrogens and oxygens let into the current molecule and how many have bonded; once all three have, reset the counts and wake the waiting atoms.
