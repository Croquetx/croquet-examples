import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
export default {
    input: 'tweet.js',
    output: {
        file: 'q.js',
        format: 'es',
    },
    plugins: [
        resolve( { browser: true }),
        commonjs(),
    ],
};
