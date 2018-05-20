import babel from 'rollup-plugin-babel'
import builtins from 'rollup-plugin-node-builtins'
import commonjs from 'rollup-plugin-commonjs'
import globals from 'rollup-plugin-node-globals'
import json from 'rollup-plugin-json'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'

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
      exclude: 'node_modules/**',
      include: 'node_modules/megajs',
      presets: ['env', {
        targets: {
          // Data from https://caniuse.com/#feat=streams and https://caniuse.com/#feat=serviceworkers
          browsers: 'Edge >= 17, Firefox >= 59, Chrome >= 64, Safari > 11.1'
        },
        modules: false
      }]
    }),
    terser()
  ],
  dest: 'dist/sw.js'
}
