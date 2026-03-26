import * as Tone from 'tone';
import { AudioEngine } from '../audio/engine';
import { CompilerRequest, CompilerResponse } from '../compiler.worker';

export class TenutoScore extends HTMLElement {
  private shadow: ShadowRoot;
  private worker: Worker | null = null;
  private audioEngine: AudioEngine | null = null;
  private audioEvents: any[] = [];
  private isPlaying = false;
  private playButton: HTMLButtonElement;
  private container: HTMLDivElement;
  private statusLabel: HTMLSpanElement;

  static get observedAttributes() {
    return ['src'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    
    // Styles
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        font-family: system-ui, -apple-system, sans-serif;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #ffffff;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      }
      .toolbar {
        display: flex;
        align-items: center;
        padding: 0.75rem 1rem;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        gap: 1rem;
      }
      button {
        padding: 0.5rem 1rem;
        background: #10b981;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      button:hover:not(:disabled) {
        background: #059669;
      }
      button:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }
      .status {
        font-size: 0.875rem;
        color: #6b7280;
      }
      .score-container {
        padding: 1rem;
        overflow-x: auto;
        min-height: 150px;
        display: flex;
        justify-content: center;
      }
      svg {
        max-width: 100%;
        height: auto;
      }
    `;
    
    this.playButton = document.createElement('button');
    this.playButton.textContent = 'Play';
    this.playButton.disabled = true;
    this.playButton.addEventListener('click', () => this.togglePlayback());

    this.statusLabel = document.createElement('span');
    this.statusLabel.className = 'status';
    this.statusLabel.textContent = 'Initializing...';

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.appendChild(this.playButton);
    toolbar.appendChild(this.statusLabel);

    this.container = document.createElement('div');
    this.container.className = 'score-container';

    this.shadow.appendChild(style);
    this.shadow.appendChild(toolbar);
    this.shadow.appendChild(this.container);
  }

  async connectedCallback() {
    this.worker = new Worker(new URL('../compiler.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.audioEngine = new AudioEngine();

    const src = this.getAttribute('src');
    if (src) {
      await this.loadScore(src);
    } else {
      this.statusLabel.textContent = 'No src attribute provided.';
    }
  }

  disconnectedCallback() {
    if (this.worker) {
      this.worker.terminate();
    }
    if (this.audioEngine) {
      this.audioEngine.stopAll();
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'src' && oldValue !== newValue && newValue) {
      this.loadScore(newValue);
    }
  }

  private async loadScore(url: string) {
    try {
      this.statusLabel.textContent = 'Fetching score...';
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
      const code = await response.text();
      
      this.statusLabel.textContent = 'Compiling...';
      this.worker?.postMessage({ type: 'CODE_CHANGED', code } as CompilerRequest);
    } catch (err: any) {
      this.statusLabel.textContent = `Error: ${err.message}`;
    }
  }

  private handleWorkerMessage(e: MessageEvent<CompilerResponse>) {
    const { type, payload, status, error } = e.data;
    if (type === 'SUCCESS') {
      this.container.innerHTML = payload.svgs.join('');
      this.audioEvents = payload.audioEvents;
      this.playButton.disabled = false;
      this.statusLabel.textContent = 'Ready';
    } else if (type === 'ERROR') {
      this.statusLabel.textContent = `Compilation Error: ${error || payload?.message}`;
    }
  }

  private async togglePlayback() {
    if (!this.audioEngine) return;
    
    if (this.isPlaying) {
      this.audioEngine.stopAll();
      this.isPlaying = false;
      this.playButton.textContent = 'Play';
      this.statusLabel.textContent = 'Ready';
      return;
    }

    try {
      this.playButton.disabled = true;
      this.statusLabel.textContent = 'Loading assets...';
      
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }

      await this.audioEngine.loadInstruments(this.audioEvents);
      
      const context = Tone.getContext().rawContext as AudioContext;
      const startTime = context.currentTime + 0.1;
      
      this.audioEngine.play(this.audioEvents, startTime);
      
      this.isPlaying = true;
      this.playButton.textContent = 'Stop';
      this.playButton.disabled = false;
      this.statusLabel.textContent = 'Playing...';
    } catch (err: any) {
      this.statusLabel.textContent = `Playback error: ${err.message}`;
      this.playButton.disabled = false;
    }
  }
}

customElements.define('tenuto-score', TenutoScore);
