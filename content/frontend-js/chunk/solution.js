function chunk(array, size = 1) {
  const step = Math.floor(size);
  if (!(step >= 1)) return [];
  const out = [];
  for (let i = 0; i < array.length; i += step) out.push(array.slice(i, i + step));
  return out;
}
