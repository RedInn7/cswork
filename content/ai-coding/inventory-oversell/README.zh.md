# 库存服务：订单超卖

`src/` 是一个小型仓库服务：记录每个 SKU 的库存，以及每个未完成订单占用的件数。客服这周转来两张工单：

1. 两位顾客都买到了「最后一个杯子」。服务允许一个订单预留另一个订单已经占用的库存。
2. 一次取消请求被重复发送了两次，之后后台显示的可用杯子比货架上的还多。

在不改变公开接口的前提下修好这两个问题。`Inventory` 的约定如下：

- `restock(sku, quantity)` 增加库存，返回当前可用件数。`quantity` 必须是正整数，否则抛 `ValueError`。
- `reserve(order_id, sku, quantity)` 为订单预留库存。从未入库的 SKU 抛 `UnknownSku`；可用件数少于 `quantity` 抛 `OutOfStock`；数量不是正整数抛 `ValueError`；同一订单已有预留时抛 `InventoryError`。失败的调用不占用任何库存。
- `release(order_id)` 取消预留并返回 `True`。取消不存在或已取消的订单不做任何改动，返回 `False`。
- `ship(order_id)` 从库存中扣除已预留的件数。订单不存在或已取消时抛 `InventoryError`。
- `available(sku)` 等于库存件数减去已预留件数。

`tests/` 里是公开测试。隐藏测试会检查上面的完整约定，你只能看到通过了几个。改代码之前先为要修的情况补上测试，不论改动来自你还是 AI。
