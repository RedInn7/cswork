test.public('adds up the chain', () => {
  expect(sum(1)(2)(3)()).toBe(6);
});

test.public('a single number', () => {
  expect(sum(5)()).toBe(5);
});

test('intermediate functions can be reused', () => {
  const s = sum(1)(2);
  expect(s(3)()).toBe(6);
  expect(s(10)()).toBe(13);
  expect(s()).toBe(3);
});

test('separate chains do not share a total', () => {
  const a = sum(100);
  const b = sum(1);
  expect(a(1)()).toBe(101);
  expect(b(1)()).toBe(2);
});

test('zeros and negatives count', () => {
  expect(sum(0)(0)()).toBe(0);
  expect(sum(-5)(2)(0)()).toBe(-3);
});

test('a long chain', () => {
  let chain = sum(0);
  for (let i = 1; i <= 100; i++) chain = chain(i);
  expect(chain()).toBe(5050);
});
