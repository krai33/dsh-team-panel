import { defineConfig } from '/home/xiwa/gitlab/dsh-subagent-model-switch/node_modules/tsdown/dist/index.mjs'

/**
 * Client bundle for the DSH web module loader. Emits the closure-factory
 * artifact: `window.__ModuleLoader__.load({id, factory})`; platform externals
 * (react, primitives, slots, cordis) resolve through the injected require.
 */
export default defineConfig({
  entry: ['src/client/index.ts'],
  outDir: 'lib',
  outExtensions: () => ({ js: '.js' }),
  format: 'cjs',
  platform: 'neutral',
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    '@deepseek-ai/cordis',
    'zod',
    '@tanstack/react-virtual',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-dockkit',
  ],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-team-panel", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
  unbundle: false,
})
