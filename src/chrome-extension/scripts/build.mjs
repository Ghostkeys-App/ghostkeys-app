// scripts/build.mjs
import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const options = {
    entryPoints: {
        background: 'src/background.js',
        popup: 'src/popup.js',
    },
    bundle: true,
    format: 'esm',
    target: ['chrome112'],
    outdir: 'dist',
    sourcemap: false,
    minify: false,
    logLevel: 'info',
    define: { 'process.env.NODE_ENV': '"production"' },
};

if (isWatch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('esbuild: watching for changes…');
} else {
    await esbuild.build(options);
    console.log('esbuild: build complete');
}