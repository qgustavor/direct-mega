import babel from 'rollup-plugin-babel'
import commonjs from 'rollup-plugin-commonjs'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'

export default {
  entry: 'src/splitter.js',
  format: 'iife',
  plugins: [
    commonjs({
      include: 'node_modules/**'
    }),
    resolve({
      jsnext: true,
      browser: true
    }),
    babel({
      exclude: 'node_modules/**',
      include: 'node_modules/megajs'
    }),
    terser()
  ],
  dest: 'dist/splitter.js'
}
