import { build } from 'esbuild';
import { minify } from 'terser';
import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs';
import path from 'path';

async function buildAndMinify() {
    try {
        console.log('🔨 Building with esbuild...');

        // Step 1: Bundle with esbuild
        await build({
            entryPoints: ['src/index.ts'],
            bundle: true,
            format: 'esm',
            platform: 'neutral',
            treeShaking: true,
            outfile: 'dist/index.temp.js',
            minify: true, // Basic minification
            target: 'es2020',
        });

        console.log('⚡ Applying advanced minification with terser...');

        // Step 2: Advanced minification with terser
        const bundledCode = fs.readFileSync('dist/index.temp.js', 'utf8');
        const terserResult = await minify(bundledCode, {
            compress: {
                passes: 3, // Multiple compression passes
                pure_getters: true,
                unsafe: true,
                unsafe_comps: true,
                unsafe_math: true,
                unsafe_methods: true,
                drop_console: true, // Remove console statements
                drop_debugger: true,
                dead_code: true,
                booleans_as_integers: true,
            },
            mangle: {
                toplevel: true, // Mangle top-level variable names
                properties: {
                    regex: /^_/, // Only mangle properties starting with _
                },
            },
            format: {
                comments: false, // Remove all comments
                ecma: 2020,
            },
            ecma: 2020,
            module: true,
        });

        console.log('🔒 Applying lightweight obfuscation...');

        // Step 3: Lightweight obfuscation optimized for size
        const obfuscationResult = JavaScriptObfuscator.obfuscate(terserResult.code, {
            compact: true, // Compact code output (minimal whitespace)
            controlFlowFlattening: false, // DISABLED - saves ~3-4kb
            deadCodeInjection: false, // Don't inject dead code
            debugProtection: false,
            disableConsoleOutput: false, // Keep console available
            identifierNamesGenerator: 'hexadecimal', // Shorter than mangled-shuffled
            log: false,
            numbersToExpressions: false, // DISABLED - saves size
            renameGlobals: false, // Don't break exports
            selfDefending: false,
            simplify: true,
            splitStrings: false,
            stringArray: true, // Keep for basic obfuscation
            stringArrayCallsTransform: false, // DISABLED - saves size
            stringArrayEncoding: [], // DISABLED - base64 adds overhead
            stringArrayIndexShift: false, // DISABLED
            stringArrayRotate: false, // DISABLED
            stringArrayShuffle: true, // Keep, minimal overhead
            stringArrayWrappersCount: 0, // DISABLED - saves size
            stringArrayWrappersChainedCalls: false,
            stringArrayThreshold: 0.4, // Reduced to 40%
            target: 'node',
            transformObjectKeys: false, // DISABLED
            unicodeEscapeSequence: false,
        });

        // Write the final obfuscated code
        fs.writeFileSync('dist/index.js', obfuscationResult.getObfuscatedCode());

        // Clean up temp file
        fs.unlinkSync('dist/index.temp.js');

        // Get final size
        const stats = fs.statSync('dist/index.js');
        const sizeKB = (stats.size / 1024).toFixed(2);

        console.log(`✅ Build complete! Final size: ${sizeKB}kb`);

    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

buildAndMinify();
