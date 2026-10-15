# Inventory: orders oversell

`src/` is a small warehouse service: stock levels per SKU and the units each open order holds. Support filed two tickets this week:

1. Two customers each got "the last mug". The service let an order reserve units that another order already held.
2. A cancellation was sent twice, and afterwards the dashboard showed more free mugs than were on the shelf.

Fix both without changing the public API. This is the contract of `Inventory`:

- `restock(sku, quantity)` adds units and returns the units now available. `quantity` must be a positive integer, otherwise `ValueError`.
- `reserve(order_id, sku, quantity)` holds units for an order. `UnknownSku` for a SKU that was never stocked, `OutOfStock` when fewer than `quantity` units are available, `ValueError` for a quantity that is not a positive integer, `InventoryError` when the order already holds a reservation. A failed call holds nothing.
- `release(order_id)` cancels a reservation and returns `True`. Releasing an unknown or already released order changes nothing and returns `False`.
- `ship(order_id)` takes the reserved units out of stock. An unknown or released order raises `InventoryError`.
- `available(sku)` is units on hand minus units reserved.

`tests/` holds the public suite. A hidden suite checks the whole contract above; you only see how many of its tests pass. Add tests for the cases you fix before you trust a change, yours or the AI's.
