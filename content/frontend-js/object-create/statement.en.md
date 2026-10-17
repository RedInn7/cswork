Without `Object.create`, implement `objectCreate(proto, properties)`:

- return a new object whose prototype is `proto`;
- with `proto` `null`, the new object has no prototype;
- if `proto` is neither an object nor `null` (`undefined` included), throw a `TypeError`;
- when `properties` is given, define them on the new object from their descriptors (as `Object.defineProperties` does).

```js
const animal = { speak() { return `${this.name} makes a sound`; } };
const dog = objectCreate(animal);
dog.name = 'Rex';
dog.speak();  // 'Rex makes a sound'

const bare = objectCreate(null);
'toString' in bare; // false
```

During the tests `Object.create` is replaced by a function that throws.
