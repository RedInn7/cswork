# Quicksort

Implement the two parts of quicksort:

**1. `partition(a, lo, hi)`: Lomuto partition.** With `a[hi]` as the pivot, move every element of `[lo, hi]` smaller than the pivot to the left, then put the pivot in its final place and return that index. Follow **exactly these steps**; the driver checks the partitioned array:

```text
pivot = a[hi]
i = lo
for j = lo .. hi - 1:
    if a[j] < pivot:
        swap a[i] and a[j]
        i = i + 1
swap a[i] and a[hi]
return i
```

**2. `quick_sort(a)`: sort the whole array in place, ascending.** The pivot choice is yours, but the tests include sorted and reversed arrays: always taking the last element degrades to O(n²) with recursion n deep.

No built-in sort may be called. Function names follow each language's conventions (Java `quickSort`, Go `QuickSort`); the starter code has them. The driver first calls `partition(b, 0, n - 1)` once on a copy of the array and prints the result and the partitioned copy, then calls `quick_sort` on the original and prints it.

## Input

The first line is n and the second holds n **distinct** integers.

1 ≤ n ≤ 10^4, and every number's absolute value is at most 10^9.

## Output

Three lines: the index partition returned, the partitioned copy, and the sorted array, numbers separated by spaces.

## Explanation

a = [3, 8, 1, 9, 2, 5] and the pivot is 5. j passes 3 (less than 5: swapped with itself, i becomes 1), 8 (stays), 1 (swapped with 8, i becomes 2), 9 (stays) and 2 (swapped with 8, i becomes 3), giving [3, 1, 2, 9, 8, 5]. Swapping a[3] with the pivot gives [3, 1, 2, 5, 8, 9], and the result is 3.

## Hints

- Before each partition, swap a randomly chosen index into a[hi]; the expected cost is then O(n log n).
- Recurse into the shorter side and loop on the longer one, and the recursion is at most O(log n) deep. Python's default recursion limit is only 1000.
- Once the pivot is placed, everything left of it is smaller and everything right of it larger, so only [lo, p - 1] and [p + 1, hi] remain.
