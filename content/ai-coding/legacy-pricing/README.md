# Legacy shipping prices: tests first

`quote()` in `src/pricing.py` prices every parcel at checkout and in billing. It grew by patches for years, nobody remembers why each branch is there, and finance reconciles invoices against its exact results, so no existing price may change by a single cent.

Product now needs a `remote` zone for addresses far from the warehouses:

- the price is the `domestic` price for the same weight plus 40%, rounded down to a whole cent;
- members get no discount in the remote zone;
- `FREESHIP` takes nothing off a remote parcel; the other coupons work as they do elsewhere.

Suggested order, the way you would do it at work:

1. Write tests in `tests/` that pin the current behaviour of `domestic` and `international` parcels (weight boundaries, members, every coupon, bad input). An AI assistant can draft them; check each expected value against the code before you trust it.
2. Refactor `quote()` into something you can read, keeping those tests green.
3. Add the remote zone.

The hidden suite compares every existing price over a grid of weights, zones, member flags and coupons with the original function, and checks the remote rules; you only see how many of its tests pass.
