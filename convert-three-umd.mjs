import fs from 'fs';

// Convert three.cjs to a browser-compatible UMD module
const src = fs.readFileSync('node_modules/three/build/three.cjs', 'utf8');

// Create a UMD wrapper that works in both browser and Node
const umd = `(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.THREE = {}));
})(this, (function (exports) {
${src.replace("'use strict';", '')}
}));`;

fs.writeFileSync('public/three.min.js', umd);
console.log('Created public/three.min.js (' + Math.round(umd.length / 1024) + 'KB)');
