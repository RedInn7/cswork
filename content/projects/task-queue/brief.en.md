# Task Queue with Retries and Visibility Timeouts

Build an SQS-like task queue service: producers put messages in, consumers take them out, process them and acknowledge (ack) them. If a consumer crashes halfway, the message comes back after its visibility timeout and is retried; after too many attempts it goes to a dead-letter list. Any language or framework.

## API

Requests and responses are JSON. Queue names are 1–64 letters, digits, `_` or `-`; a queue exists from its first use.

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/queues/{q}/messages` | `{"body": any JSON, "max_attempts": 1–20 (default 3), "delay_ms": ≥ 0 (default 0)}`; answers 201 `{"id"}`. The message stays hidden for `delay_ms`. |
| `POST` | `/queues/{q}/receive` | `{"visibility_ms": 1–3600000 (default 30000), "max": 1–10 (default 1)}`; answers 200 `{"messages": [{"id", "body", "receipt", "attempt"}]}`, an empty list when there is nothing. A received message is hidden from everyone else for `visibility_ms`; `attempt` counts deliveries from 1. |
| `POST` | `/queues/{q}/ack` | `{"receipt"}`: done; the message is deleted. Answers 204. |
| `POST` | `/queues/{q}/nack` | `{"receipt", "delay_ms": optional}`: failed; visible again now (or after the delay). Answers 204. |
| `GET` | `/queues/{q}/stats` | `{"ready", "delayed", "in_flight", "dead"}`. |
| `GET` | `/queues/{q}/dead` | `{"messages": [{"id", "body", "attempts"}]}`, in enqueue order. |

Rules:

- First in, first out: visible messages are delivered in enqueue order.
- A receipt stands for one delivery. After its timeout, after a redelivery, after an ack, or when it never existed, ack and nack answer 409.
- A message already delivered `max_attempts` times that times out or is nacked again goes to the dead-letter list and is never delivered again.
- A missing or out-of-range parameter, or a body that is not JSON, is a 400.

## Constraints

- With many consumers calling receive at once, a message goes to only one of them while it is hidden.
- Do not start a timer thread per message to wait for timeouts; explain how you find the ones that expired.

## Extras

- Durability: SQLite or an append-only log, so a restart loses nothing and in-flight timeouts keep running.
- Long polling: `wait_ms` on receive waits for a message when the queue is empty.
- Redrive: move dead-lettered messages back to their queue.
- A worker library with exponential backoff and a heartbeat that extends the visibility of slow jobs.
