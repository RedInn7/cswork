# 用两个字母的模式匹配字符串
模式串 pattern 只由字母 a 和 b 组成。给 a 和 b 各指定一个字符串（可以是空串，但 a 和 b 对应的字符串不能相同），把模式中的每个 a、b 替换成对应的字符串后，如果正好得到 value，就说 value 匹配这个模式。给出若干组 pattern 和 value，判断是否匹配。

## 输入
第一行一个整数 t（1 ≤ t ≤ 20）。
接下来每组两行：第一行是 pattern（长度 1 到 1000），第二行是 value（由小写字母组成，长度 1 到 1000）。

## 输出
t 行，每行输出 true 或 false。

## 样例说明
abba 和 dogcatcatdog：a = dog，b = cat，匹配。
abba 和 dogcatcatfish：两端的 a 必须相同，不匹配。
abba 和 dogdogdogdog：a = dogdog、b 为空串，匹配。
aabbb 和 xxxxx：只能 a = b = x，但 a、b 不能相同，所以不匹配。

## 提示
- 设 a 出现 ca 次、b 出现 cb 次，枚举 a 的长度 la，b 的长度就由 ca·la + cb·lb = |value| 确定；再按模式切分 value，检查所有 a 段相同、所有 b 段相同且两者不同。
- 别忘了空串也是合法的映射，以及只有一种字母出现的模式。
