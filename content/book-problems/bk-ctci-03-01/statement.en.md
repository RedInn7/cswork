# Three Stacks in One Array
Use one array of length 3c to run three stacks numbered 0, 1 and 2, each holding at most c elements. Support:
push s v: push v onto stack s; if that stack is full, ignore the operation;
pop s: pop and print the top of stack s, or -1 if it is empty;
peek s: print the top of stack s without removing it, or -1 if it is empty;
empty s: print true if stack s is empty, otherwise false.

## Input
The first line holds two integers c and q (1 ≤ c ≤ 1000, 1 ≤ q ≤ 100000).
Each of the next q lines is one operation, with 0 ≤ s ≤ 2 and 0 ≤ v ≤ 10^9.

## Output
One line for each pop, peek and empty.

## Sample explanation
In sample 1 every stack holds 1 element, so the second push 0 2 is ignored and pop 0 returns 1; stack 0 is then empty and the next pop gives -1. Stack 1 never received anything, so empty 1 is true.

## Hints
- Split the array into three slices, slice s being [s·c, (s+1)·c), and keep a size for each stack.
- The capacities are separate: a full stack cannot borrow the free slots of another.
