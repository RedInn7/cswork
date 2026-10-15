class InventoryError(Exception):
    """Base class for every inventory failure."""


class UnknownSku(InventoryError):
    """The SKU was never stocked."""


class OutOfStock(InventoryError):
    """Fewer units are available than were asked for."""
