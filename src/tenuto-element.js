class TenutoScore extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    let compile_tenuto_json;
    try {
      // Initialize the Wasm module dynamically
      // @ts-ignore
      const wasmPath = import.meta.env.BASE_URL + 'pkg/tenutoc.js';
      const wasm = await import(/* @vite-ignore */ wasmPath);
      await wasm.default();
      compile_tenuto_json = wasm.compile_tenuto_json;
    } catch (e) {
      console.warn('[TenutoScore] Wasm module missing at /pkg/tenutoc.js. Using mock fallback.');
      compile_tenuto_json = () => ({ ir: [], errors: [] });
    }

    try {
      // Extract the raw Tenuto text
      let sourceText = '';
      const src = this.getAttribute('src');
      if (src) {
        const response = await fetch(src);
        if (response.ok) {
          sourceText = await response.text();
        } else {
          console.error(`Failed to fetch src: ${src}`);
        }
      } else {
        sourceText = this.textContent || '';
      }

      if (sourceText.trim()) {
        // Pass the text into compile_tenuto_json()
        const jsonPayload = compile_tenuto_json(sourceText);
        
        // Log the resulting JSON physics payload
        console.log('[TenutoScore] Compiled JSON Payload:', jsonPayload);
        
        // Display a simple message in the shadow DOM
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              padding: 1rem;
              border: 1px solid #ccc;
              border-radius: 4px;
              font-family: monospace;
              background: #f9f9f9;
            }
          </style>
          <div>Tenuto Score Compiled Successfully. Check console for JSON payload.</div>
        `;
      }
    } catch (error) {
      console.error('[TenutoScore] Compilation Error:', error);
      this.shadowRoot.innerHTML = `<div style="color: red;">Compilation Error: ${error}</div>`;
    }
  }
}

customElements.define('tenuto-score', TenutoScore);
