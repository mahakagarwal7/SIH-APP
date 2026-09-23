// query-string 7 calls a CommonJS function; the patched upstream decoder is ESM.
module.exports = require('decode-uri-component-fixed').default;
