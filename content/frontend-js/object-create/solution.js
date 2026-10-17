function objectCreate(proto, properties) {
  if (proto !== null && typeof proto !== 'object' && typeof proto !== 'function')
    throw new TypeError('Object prototype may only be an Object or null: ' + String(proto));
  let object;
  if (proto === null) object = Object.setPrototypeOf({}, null);
  else {
    function Empty() {}
    Empty.prototype = proto;
    object = new Empty();
  }
  if (properties !== undefined) Object.defineProperties(object, properties);
  return object;
}
