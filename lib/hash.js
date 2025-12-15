// quick and dirty function for hashing simple JSON serializable objects
const hash = (obj) => {
  if (obj === null || obj === undefined) {
    return 0;
  }

  let result = 0;

  switch (typeof obj) {
    case 'object':
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          result = (result + hash(obj[i])) << 0;
        }
      } else {
        for (let [key, value] of Object.entries(obj)) {
          result = ((result + hash(key)) ^ hash(value)) << 0;
        }
      }
      break;
    case 'string':
      for (let i = 0; i < obj.length; i++) {
        result = (31 * result + obj.charCodeAt(i)) << 0;
      }
      break;
    case 'number':
      if (Number.isSafeInteger(obj)) {
        result += obj;
      } else {
        const buf = new ArrayBuffer(8);
        new Float64Array(buf)[0] = obj;
        const [a, b] = new Int32Array(buf);
        result += a ^ b;
      }
      break;
    case 'boolean':
      result += obj ? 1 : 0;
      break;
    default:
      throw new TypeError(`Unhanded type ${typeof obj}`);
  }

  return result;
};

module.exports = {
  hash
};
