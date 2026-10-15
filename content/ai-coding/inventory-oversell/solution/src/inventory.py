from .errors import InventoryError, OutOfStock, UnknownSku
from .models import Item


class Inventory:
    """Stock levels and open reservations for one warehouse."""

    def __init__(self):
        self._items = {}
        # order id -> (sku, quantity)
        self._reservations = {}

    def restock(self, sku, quantity):
        _positive(quantity)
        item = self._items.setdefault(sku, Item(sku))
        item.on_hand += quantity
        return item.available

    def available(self, sku):
        return self._item(sku).available

    def reserve(self, order_id, sku, quantity):
        _positive(quantity)
        if order_id in self._reservations:
            raise InventoryError('order %s already holds a reservation' % order_id)
        item = self._item(sku)
        if quantity > item.available:
            raise OutOfStock(sku)
        item.reserved += quantity
        self._reservations[order_id] = (sku, quantity)

    def release(self, order_id):
        held = self._reservations.pop(order_id, None)
        if held is None:
            return False
        sku, quantity = held
        self._items[sku].reserved -= quantity
        return True

    def ship(self, order_id):
        try:
            sku, quantity = self._reservations.pop(order_id)
        except KeyError:
            raise InventoryError('no reservation for order %s' % order_id) from None
        item = self._items[sku]
        item.reserved -= quantity
        item.on_hand -= quantity

    def _item(self, sku):
        try:
            return self._items[sku]
        except KeyError:
            raise UnknownSku(sku) from None


def _positive(quantity):
    if not isinstance(quantity, int) or quantity <= 0:
        raise ValueError('quantity must be a positive integer')
