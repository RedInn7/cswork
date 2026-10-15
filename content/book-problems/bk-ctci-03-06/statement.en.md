# Animal Shelter
A shelter takes only cats and dogs and works strictly first in, first out: an adopter may ask for the animal that has waited longest (cat or dog), or name cat or dog and get the longest-waiting one of that kind. Every animal has a distinct id, unrelated to arrival order. Implement:
enqueue id k: animal id arrives, k = 0 for a cat and k = 1 for a dog;
dequeueAny: adopt the animal that arrived first;
dequeueDog: adopt the dog that arrived first;
dequeueCat: adopt the cat that arrived first.
For each adoption print "id k" of the adopted animal, or -1 -1 when none fits.

## Input
The first line holds an integer q (1 ≤ q ≤ 8000).
Each of the next q lines is one operation, with 0 ≤ id ≤ 10^9 and k equal to 0 or 1.

## Output
One line with two integers for each adoption.

## Sample explanation
In sample 1, cat 30 arrives first, then dogs 10 and 20. dequeueAny adopts cat 30; at dequeueCat no cat is left, so -1 -1; dequeueDog adopts dog 10.

## Hints
- Keep a queue for cats and one for dogs, and stamp each animal with its arrival number; dequeueAny compares the two fronts' stamps.
- Do not order animals by id: ids say nothing about arrival.
