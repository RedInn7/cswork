function parseQuery(query) {
  const decode = (text) => decodeURIComponent(text.replace(/\+/g, ' '));
  const result = {};
  for (const piece of query.replace(/^\?/, '').split('&')) {
    if (!piece) continue;
    const at = piece.indexOf('=');
    const key = decode(at < 0 ? piece : piece.slice(0, at));
    const value = at < 0 ? '' : decode(piece.slice(at + 1));
    if (!Object.prototype.hasOwnProperty.call(result, key)) result[key] = value;
    else if (Array.isArray(result[key])) result[key].push(value);
    else result[key] = [result[key], value];
  }
  return result;
}
