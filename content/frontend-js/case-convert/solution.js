function camelToSnake(text) {
  return text
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function snakeToCamel(text) {
  return text.replace(/(?<=[^_])_+([a-z\d])/g, (_, letter) => letter.toUpperCase());
}
