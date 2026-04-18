import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const config = {
  input: './src/index.ts',
  output: [
    {
      file: './lib/index.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    {
      file: './lib/index.umd.js',
      format: 'umd',
      name: 'AwesomeReactGamepads',
      sourcemap: true,
      globals: { react: 'React' },
    },
    {
      file: './lib/index.es.js',
      format: 'esm',
      sourcemap: true,
    },
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declarationDir: './lib',
      exclude: ['src/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    }),
    resolve({ extensions: ['.jsx', '.js', '.tsx', '.ts'] }),
    commonjs(),
    ...(process.env.NODE_ENV === 'production' ? [terser()] : []),
  ],
  external: ['react', 'react-dom'],
};

export default config;
