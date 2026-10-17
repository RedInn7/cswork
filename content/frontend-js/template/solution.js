function renderTemplate(template, data) {
  return template.replace(/\{\{\s*([\w$.]+)\s*\}\}/g, (_, path) => {
    let value = data;
    for (const key of path.split('.')) {
      if (value === null || value === undefined) break;
      value = value[key];
    }
    return value === null || value === undefined ? '' : String(value);
  });
}
