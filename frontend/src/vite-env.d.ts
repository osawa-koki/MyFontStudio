/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "hash" なら HashRouter（GitHub Pages）、それ以外は BrowserRouter */
  readonly VITE_ROUTER?: string;
}
