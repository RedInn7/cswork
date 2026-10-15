# Hash Map (Separate Chaining)

Implement an integer-to-integer hash map `HashMap` with separate chaining: an array of buckets, each a linked list or small array of (key, value) pairs, with a hash function sending each key to a bucket. No built-in hash or ordered map may be used (`dict`, `set`, `unordered_map`, `map`, `HashMap`, `TreeMap`, Go's `map`).

The bucket count (the `buckets` operation checks it):

- It starts at 8.
- After a `put` adds a new key (updating an existing key does not count), if `size * 4 > buckets * 3`, that is the load factor exceeds 0.75, **double** the bucket count and redistribute every pair into the new buckets.
- Removals never reduce the bucket count.

Any hash function will do, as long as the bucket index lands in `[0, buckets)`.

Methods to implement:

| Method | Does |
| --- | --- |
| `put(key, value)` | Add the key, or update its value if present |
| `get(key)` | Return the key's value, or -1 if absent |
| `remove(key)` | Remove the key; return true if it was present, false otherwise |
| `size()` | Number of pairs |
| `buckets()` | Current bucket count |

## Input

The first line is the number of operations q. Each of the next q lines is one operation:

put k v / get k / remove k / size / buckets

1 ≤ q ≤ 2×10^4, |k| ≤ 10^9, 0 ≤ v ≤ 10^9.

## Output

`get` prints the value or -1; `remove` prints 1 if it removed the key and 0 otherwise; `size` prints the number of pairs; `buckets` prints the bucket count.

## Explanation

The first 6 puts add 6 distinct keys. After the 7th new key, put 70 7, size is 7 and 7×4 = 28 > 8×3 = 24, so the buckets double to 16. put 10 100 only updates a value and leaves size alone. remove 20 succeeds, the second remove 20 fails, and get 20 gives -1.

## Hints

- Keys may be negative. In languages where a negative number modulo stays negative, such as Java and C++, make the hash non-negative first.
- With key % buckets and a power-of-two bucket count, every multiple of 1024 lands in the same bucket while there are at most 1024 buckets. Multiplying the key by a large odd constant (such as 2654435761) before taking the remainder spreads keys far more evenly.
- When growing, recompute every pair's index for the new bucket count; old buckets cannot be copied over as they are.
