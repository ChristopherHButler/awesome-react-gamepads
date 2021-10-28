// import resolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
// import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';



const config = {
  input: './src/index.ts',
  output: [
    // {
    //   file: 'lib/cjs/index.js',
    //   format: 'cjs',
    //   name: 'ARG',
    //   sourcemap: true,
    // },
    {
      file: 'lib/index.js',
      format: 'umd',
      name: 'ARG',
      sourcemap: true,
    },
    // {
    //   file: 'lib/esm/index.js',
    //   format: 'esm',
    //   name: 'ARG',
    //   sourcemap: true,
    // },
  ],
  plugins: [
    typescript(),
    // resolve({ extensions: ['.jsx', '.js'] }),
    // commonjs(),
    // json(),
  ],
  external: ['react', 'react-dom']
};

if (process.env.NODE_ENV === 'production') {
  config.plugins.push(terser());
}

export default config;