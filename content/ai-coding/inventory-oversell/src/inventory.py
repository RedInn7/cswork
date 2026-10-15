from .errors import OutOfStock, UnknownSku
from .models import Item


class Inventory:
    """Stock levels and open reservations for one warehouse."""

    def __init__(self):
        self._items = {}
        # order id -> (sku, quantity)
        self._reservations = {}

    def restock(self, sku, quantity):
        item = self._items.setdefault(sku, Item(sku))
        item.on_hand += quantity
        return item.available

    def available(self, sku):
        return self._item(sku).available

    def reserve(self, order_id, sku, quantity):
        item = self._item(sku)
        if quantity > item.on_hand:
            raise OutOfStock(sku)
        item.reserved += quantity
        self._reservations[order_id] = (sku, quantity)

    def release(self, order_id):
        sku, quantity = self._reservations[order_id]
        self._items[sku].reserved -= quantity
        return True

    def ship(self, order_id):
        sku, quantity = self._reservations.pop(order_id)
        item = self._items[sku]
        item.reserved -= quantity
        item.on_hand -= quantity

    def _item(self, sku):
        try:
            return self._items[sku]
        except KeyError:
            raise UnknownSku(sku) from None
