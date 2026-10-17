function sum(a) {
  return (b) => (b === undefined ? a : sum(a + b));
}
