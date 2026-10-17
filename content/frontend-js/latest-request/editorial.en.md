**Idea**: give every call its own identity `call`, and keep the newest one in the closure's `current`.

- A new call first rejects the unsettled `current` with `'cancelled'`, then becomes `current` itself.
- When a request's answer arrives, check `current === call` first. If not, that call was cancelled, so drop the answer.
- Once a call settles, clear `current`, so a later call doesn't try to reject a Promise that already fulfilled. Rejecting it would do nothing anyway; clearing just keeps the logic plain.

This "cancel" cancels the **result** only; the request itself keeps going. To really stop the network request, use `AbortController`: pass its `signal` to `fetch` and call `abort()` on the previous one when a new call comes in. Real code can do both.

Another common version uses an increasing request number and accepts only the response whose number is the latest. Same idea.
