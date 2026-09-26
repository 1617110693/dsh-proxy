import { defineConfig } from 'tsdown'

/** Must equal the package name: the host's ModuleLoader looks the client up by it. */
const CLIENT_ID = 'dsh-network-proxy'

export default defineConfig([
  // Host plugin: ESM for the Cordis loader; runtime dependencies stay external.
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'node22',
    dts: true,
    clean: true,
    fixedExtension: false,
    deps: { neverBundle: [/^@deepseek-ai\//, 'undici'] },
  },
  // Browser half: one self-contained file in the ModuleLoader format; React comes from the host.
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'client',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    dts: false,
    clean: true,
    deps: { neverBundle: ['react'] },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(CLIENT_ID)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;`,
      footer: 'return module.exports; } });',
    },
  },
])
