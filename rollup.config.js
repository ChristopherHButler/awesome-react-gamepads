import resolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

import packageJSON from './package.json';



const config = {
  input: './src/index.ts',
  output: [
    {
      file: packageJSON.main,
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
      strict: false,
      // globals: {
      //   react: "React",
      // }
    },
    {
      file: packageJSON.browser,
      format: 'umd',
      name: 'ARG',
      sourcemap: true,
      globals: {
        react: "React",
      }
    },
    {
      file: packageJSON.module,
      format: 'esm',
      name: 'ARG',
      sourcemap: true,
      globals: {
        react: "React",
      }
    },
  ],
  plugins: [
    typescript(),
    resolve({ extensions: ['.jsx', '.js', '.tsx', 'ts'] }),
    commonjs(),
    // json(),
  ],
  external: ['react', 'react-dom']
};

if (process.env.NODE_ENV === 'production') {
  config.plugins.push(terser());
}

export default config;