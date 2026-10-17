function classNames(...args) {
  const names = [];
  const add = (arg) => {
    if (!arg) return;
    if (typeof arg === 'string' || typeof arg === 'number') names.push(String(arg));
    else if (Array.isArray(arg)) arg.forEach(add);
    else if (typeof arg === 'object') {
      for (const key of Object.keys(arg)) if (arg[key]) names.push(key);
    }
  };
  args.forEach(add);
  return names.join(' ');
}
