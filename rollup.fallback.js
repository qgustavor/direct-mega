import globals from 'rollup-plugin-node-globals'
import builtins from 'rollup-plugin-node-builtins'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import json from 'rollup-plugin-json'
import babel from 'rollup-plugin-babel'
import uglify from 'rollup-plugin-uglify'

export default {
  entry: 'src/fallback.js',
  format: 'iife',
  plugins: [
    globals(),
    builtins(),
    resolve({
      jsnext: true,
      browser: true
    }),
    json(),
    commonjs({
      include: 'node_modules/**'
    }),
    babel({
      exclude: 'node_modules/**'
    }),
    uglify()
  ],
  dest: 'dist/fallback.js'
}
