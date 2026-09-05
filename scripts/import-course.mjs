import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
// Run explicitly against an instructor-owned checkout. No network content import.
const root = process.argv[2];
if (!root)
  throw new Error('Usage: node scripts/import-course.mjs /path/to/gomall');
const definitions = [
  [
    '00-overview',
    '系统全景：角色与交易链路',
    '后端基础',
    '从业务角色理解接口、服务和数据边界',
  ],
  [
    '00-overview-architecture',
    '系统架构：可靠交易的底座',
    '后端基础',
    '分层、库存预占与事务消息',
  ],
  ['01-user-auth', '用户与鉴权的业务边界', '后端基础', '认证、授权和令牌撤销'],
  [
    '02-payment-up',
    '余额支付与资金事务',
    '交易系统',
    '锁顺序、原子支付与复式流水',
  ],
  [
    '03-payment-down',
    '幂等、熔断与支付对账',
    '交易系统',
    '应对重复请求与不确定结果',
  ],
  [
    '04-payment-clearing',
    '清算与资金托管',
    '交易系统',
    '统一支付渠道、建立清算边界',
  ],
  [
    '05-payment-settlement',
    '卖家结算与退款竞争',
    '交易系统',
    '从完成订单到释放托管资金',
  ],
  [
    '06-product-display',
    '商品展示与缓存',
    '搜索与进阶',
    '分页、缓存失效和可信价格',
  ],
  [
    '07-product-search',
    '商品搜索与索引同步',
    '搜索与进阶',
    '搜索查询、排序和索引一致性',
  ],
  [
    '08-product-search-hybrid',
    '混合召回与搜索降级',
    '搜索与进阶',
    '关键词与语义检索如何协作',
  ],
  [
    '09-cart-to-order',
    '从购物车到订单',
    '交易系统',
    '库存预占、权威计价与补偿',
  ],
  [
    '10-payment-web3',
    'Web3 支付与签名验证',
    '搜索与进阶',
    '付款意图、验签与链上确认',
  ],
  [
    '11-payment-web3-settlement',
    '链上对账与可靠结算',
    '搜索与进阶',
    '区块回扫、重试与幂等消费',
  ],
  ['12-inventory', '库存与防超卖', '搜索与进阶', '两桶库存、Redis Lua 与恢复'],
  [
    '13-preorder',
    '预售定金与时间状态机',
    '搜索与进阶',
    '定金、尾款、逾期与取消',
  ],
  ['14-middleware', '接入层护栏', '搜索与进阶', '鉴权、限流与缓存中间件'],
  [
    '15-middleware-transaction',
    '交易韧性与中间件顺序',
    '搜索与进阶',
    '熔断、幂等与故障边界',
  ],
];
mkdirSync('content/lectures', { recursive: true });
const seed = definitions.map(([id, title, section, summary], i) => {
  const source = readFileSync(join(root, 'docs/lecture', id + '.md'), 'utf8');
  // Keep original relative references resolvable without publishing hidden resources.
  const body = source.replace(
    /\]\((?!https?:|#|mailto:)([^)]+)\)/g,
    (_, path) =>
      `](${new URL(path, 'https://github.com/RedInn7/gomall/blob/main/docs/lecture/').href})`,
  );
  writeFileSync('content/lectures/' + id + '.md', body);
  return {
    id,
    title,
    section,
    summary,
    position: i + 1,
    source: 'docs/lecture/' + id + '.md',
  };
});
writeFileSync('content/catalog.json', JSON.stringify(seed, null, 2) + '\n');
console.log(
  `Imported ${seed.length} instructor-owned handouts. No videos or student data imported.`,
);
