import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIRTUAL_EMPTY_APPLET_CONFIG_ID = '\0virtual:empty-firebase-applet-config';

function stripSandboxFirebaseConfigPlugin(shouldStrip: boolean): Plugin {
  return {
    name: 'strip-sandbox-firebase-config',
    enforce: 'pre',
    resolveId(source) {
      if (shouldStrip && source.endsWith('firebase-applet-config.json')) {
        return VIRTUAL_EMPTY_APPLET_CONFIG_ID;
      }
      return null;
    },
    load(id) {
      if (id === VIRTUAL_EMPTY_APPLET_CONFIG_ID) {
        return 'export default {};';
      }
      return null;
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // Use '/Al-Madina-Electronics-Appliances/' (or VITE_BASE) only for builds;
  // keep '/' for local development serve regardless of container VITE_BASE env vars.
  const isBuild = command === 'build';
  const base = isBuild ? (process.env.VITE_BASE || '/Al-Madina-Electronics-Appliances/') : '/';

  // Strip workspace sandbox firebase-applet-config.json ONLY during external production builds
  // (GitHub Actions CI/Pages or explicit clean VITE_FIREBASE_PROJECT_ID builds for another project),
  // never during AI Studio dev server or fallback preview builds.
  const rawEnvProject = (process.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const hasCleanEnvProject =
    Boolean(rawEnvProject) && !rawEnvProject.startsWith('"') && !rawEnvProject.endsWith(',');
  const shouldStripSandboxConfig =
    command === 'build' &&
    (process.env.GITHUB_ACTIONS === 'true' ||
      process.env.VITE_STRIP_SANDBOX_CONFIG === 'true' ||
      (hasCleanEnvProject && rawEnvProject !== 'gen-lang-client-0548186480'));

  return {
    base,
    plugins: [stripSandboxFirebaseConfigPlugin(shouldStripSandboxConfig), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      ws: process.env.DISABLE_HMR === 'true' ? false : undefined,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
