**Idea**: open `limit` "lanes". When a task finishes, its lane takes the next task. `next` is the index to hand out next, and `finished` counts the tasks that are done.

- `launch()`: unless something failed or no task is left, take `i = next++` and run `tasks[i]()`. When it's done, store `results[i]`; then resolve if everything is done, or call `launch()` again.
- Wrapping it as `new Promise((done) => done(tasks[i]()))` turns a synchronous throw from the task function into a rejection.
- On failure, set `failed` and reject; later `launch()` calls return early, so nothing new starts.
- Check for completion with `finished`, not `next`: when `next` reaches the end, the last tasks may still be running.

**Common bug**: running fixed batches of `limit` with `Promise.all` and waiting for each batch to finish. One slow task then holds up its whole batch, and fewer tasks run at once.

The total time is what you get by giving each task, in order, to the first lane that frees up.
