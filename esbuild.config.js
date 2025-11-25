const esbuild = require('esbuild');
const fs = require('fs');
const minify = require('html-minifier').minify;

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const isWatch = process.argv.includes('--watch');
const isMinify = process.argv.includes('--minify');

const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
const targetFormat = targetArg ? targetArg.split('=')[1] : 'umd';

const baseConfig = {
    entryPoints: ['./src/entry.ts'],
    bundle: true,
    minify: isMinify,
    sourcemap: true,
    alias: { '@': './src' },
    loader: { '.html': 'text', '.svg': 'text' },
    plugins: [
        {
            name: 'CSSMinifyPlugin',
            setup(build) {
                build.onLoad({ filter: /\.css$/ }, async (args) => {
                    const file = fs.readFileSync(args.path, 'utf8');
                    const css = await esbuild.transform(file, {
                        loader: 'css',
                        minify: true,
                    });
                    return { loader: 'text', contents: css.code };
                });
            },
        },
        {
            name: 'HTMLMinifyPlugin',
            setup(build) {
                build.onLoad({ filter: /\.(html|svg)$/ }, async (args) => {
                    const file = fs.readFileSync(args.path, 'utf8');
                    const html = minify(file, {
                        removeComments: true,
                        removeEmptyAttributes: true,
                        collapseWhitespace: true,
                    }).trim();
                    return { loader: 'text', contents: html };
                });
            },
        },
    ],
    banner: {
        js: `/*!
* Accessibility Widget v${packageJson.version}
* Based on "Sienna Accessibility Widget" by bennyluk (MIT License)
${
    packageJson.modifiedByCompany
        ? ` * Modified by ${
              packageJson.modifiedByCompany
          }, ${new Date().getFullYear()}${
              packageJson.modifiedByAuthor
                  ? ` (${packageJson.modifiedByAuthor})`
                  : ''
          }`
        : ''
}
* License: ${packageJson.license}
* Repository: ${packageJson.repository.url}
* 
* Original: (c) ${new Date().getFullYear()} ${packageJson.author}
* Original Repository: ${
            packageJson.originalRepository?.url || packageJson.repository.url
        }
*/`,
    },
};

// Build targets
const version = packageJson.version;
const targets = {
    esm: { format: 'esm', outfile: 'dist/accessibility-widget.esm.js' },
    cjs: { format: 'cjs', outfile: 'dist/accessibility-widget.cjs.js' },
    umd: {
        format: 'iife',
        outfile: 'dist/accessibility-widget.umd.js',
        globalName: 'AccessibilityWidget',
    },
    // Optional: Versioned UMD file for explicit versioning
    'umd-versioned': {
        format: 'iife',
        outfile: `dist/accessibility-widget-${version}.umd.js`,
        globalName: 'AccessibilityWidget',
    },
};

const buildTarget = targets[targetFormat];

async function build() {
    if (isWatch) {
        const ctx = await esbuild.context({ ...baseConfig, ...buildTarget });
        await ctx.watch();
        console.log(`⚡ Watching ${buildTarget.outfile}...`);
    } else {
        console.log('🏗️  Building all formats...');
        // Build all targets except umd-versioned (optional, uncomment if needed)
        const targetsToBuild = Object.entries(targets).filter(
            ([key]) => key !== 'umd-versioned'
        );
        await Promise.all(
            targetsToBuild.map(([, target]) =>
                esbuild.build({ ...baseConfig, ...target })
            )
        );
        console.log(`✅ Build complete: ${buildTarget.outfile}`);
        console.log(`📦 Version: ${version}`);
    }
}

build().catch(() => process.exit(1));
