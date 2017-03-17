import babel from 'rollup-plugin-babel'
import builtins from 'rollup-plugin-node-builtins'
import commonjs from 'rollup-plugin-commonjs'
import globals from 'rollup-plugin-node-globals'
import json from 'rollup-plugin-json'
import resolve from 'rollup-plugin-node-resolve'
import uglify from 'rollup-plugin-uglify'

export default {
  entry: 'src/sw.js',
  format: 'iife',
  plugins: [
    json(),
    commonjs({
      include: 'node_modules/**'
    }),
    globals(),
    builtins(),
    resolve({
      jsnext: true,
      browser: true
    }),
    babel({
      exclude: 'node_modules/**'
    }),
    uglify()
  ],
  dest: 'dist/sw.js'
}
