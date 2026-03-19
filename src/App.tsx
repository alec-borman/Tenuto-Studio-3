import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Square, Code, FileCode, Upload } from 'lucide-react';
import * as Tone from 'tone';
import { registerTenutoLanguage } from './editor/tenutoLanguage';

const DEFAULT_CODE = `tenuto "3.0" {
  meta @{ title: "The Producer Suite", tempo: 130, time: "4/4" }
  
  group "Strings" {
    def vln1 "Violin I" style=standard patch="gm_violin"
    def vln2 "Violin II" style=standard patch="gm_violin"
  }
  
  def pno "Keys" style=standard patch="gm_epiano"
  
  measure 1 {
    vln1: c5:4.slur d5:8 e5:4.tie e5:8 |
    vln2: e4:4.p g4:8 c5:4.f c5:8 |
    pno: <[
      v1: [c4 e4 g4]:2.marc [d4 f4 a4]:4 | 
      v2: c3:1 | 
    ]>
  }

  measure 2 {
    vln1: <[ c5:8 d5:8 e5:8 ]>:3/2 f5:4 g5:4 |
    vln2: c4:4.grace d4:4 e4:4 f4:4 |
    pno: <[
      v1: c4:8 d4:8.cross(vln2) e4:8.cross(vln2) f4:8 |
      v2: c3:2 g3:2 |
    ]>
  }
}`;

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [svgScore, setSvgScore] = useState<string | null>(null);
  const [status, setStatus] = useState('Booting compiler...');
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);
  const renderWorkerRef = useRef<Worker | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  
  // Audio state
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);

  useEffect(() => {
    // Initialize Audio
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination();

    // Initialize Compiler Worker
    workerRef.current = new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      const { type, payload, status: workerStatus, error } = e.data;
      
      if (type === 'STATUS') {
        setStatus(workerStatus === 'READY' ? 'Compiler Ready' : `Error: ${error}`);
        if (workerStatus === 'READY') {
          compileCode(DEFAULT_CODE);
        }
      } else if (type === 'SUCCESS') {
        setStatus(`Compiled successfully in ${payload.durationMs}ms`);
        setSvgScore(payload.svg);
        setDiagnostics([]);
        
        // Parse the compiled MIDI bytes and send to WebGL renderer
        if (renderWorkerRef.current && payload.midi) {
          try {
            import('@tonejs/midi').then(({ Midi }) => {
              const midi = new Midi(payload.midi);
              const notes: any[] = [];
              
              // Clear previous audio part
              if (partRef.current) {
                partRef.current.dispose();
                partRef.current = null;
              }
              
              const audioEvents: any[] = [];
              
              midi.tracks.forEach(track => {
                track.notes.forEach(note => {
                  notes.push({
                    time: note.time,
                    duration: note.duration,
                    midi: note.midi
                  });
                  
                  audioEvents.push({
                    time: note.time,
                    note: note.name,
                    duration: note.duration,
                    velocity: note.velocity
                  });
                });
              });
              
              // Setup new audio part
              if (audioEvents.length > 0) {
                partRef.current = new Tone.Part((time, event) => {
                  synthRef.current?.triggerAttackRelease(
                    event.note, 
                    event.duration, 
                    time, 
                    event.velocity
                  );
                }, audioEvents).start(0);
              }
              
              renderWorkerRef.current?.postMessage({ type: 'UPDATE_NOTES', notes });
            });
          } catch (err) {
            console.error("Failed to parse MIDI for WebGL playback:", err);
          }
        }
      } else if (type === 'ERROR') {
        setStatus('Compilation failed');
        if (payload.diagnostics) {
          setDiagnostics(payload.diagnostics);
        } else {
          setDiagnostics([{
            line: 1,
            column: 1,
            message: payload.message || 'Unknown error',
            severity: 'error'
          }]);
        }
      } else if (type === 'DECOMPILE_SUCCESS') {
        setCode(payload.code);
        setStatus('Decompiled successfully');
      }
    };

    // Initialize Render Worker
    renderWorkerRef.current = new Worker('/render-worker.js');
    
    let canvas: HTMLCanvasElement | null = null;
    
    if (canvasContainerRef.current) {
      // Dynamically create canvas to avoid transferControlToOffscreen issues in React Strict Mode
      canvas = document.createElement('canvas');
      canvas.className = "absolute inset-0 w-full h-full";
      canvasContainerRef.current.appendChild(canvas);
      
      try {
        const offscreen = canvas.transferControlToOffscreen();
        renderWorkerRef.current.postMessage({ 
          type: 'INIT', 
          canvas: offscreen,
          width: canvasContainerRef.current.clientWidth,
          height: canvasContainerRef.current.clientHeight
        }, [offscreen]);
      } catch (err) {
        console.error("Failed to transfer control to offscreen canvas:", err);
      }
    }

    return () => {
      workerRef.current?.terminate();
      renderWorkerRef.current?.terminate();
      if (canvas && canvasContainerRef.current) {
        canvasContainerRef.current.removeChild(canvas);
      }
      if (partRef.current) {
        partRef.current.dispose();
      }
      if (synthRef.current) {
        synthRef.current.dispose();
      }
    };
  }, []);

  const compileCode = (source: string) => {
    setStatus('Compiling...');
    workerRef.current?.postMessage({ type: 'CODE_CHANGED', code: source });
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerTenutoLanguage(monaco);
  };

  useEffect(() => {
    if (monacoRef.current && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const markers = diagnostics.map(diag => ({
          severity: monacoRef.current.MarkerSeverity.Error,
          startLineNumber: diag.line,
          startColumn: diag.column,
          endLineNumber: diag.line,
          endColumn: diag.column + 5, // Approximate word length for squiggle
          message: diag.message
        }));
        monacoRef.current.editor.setModelMarkers(model, 'tenuto', markers);
      }
    }
  }, [diagnostics]);

  const handleEditorChange = (value: string | undefined) => {
    if (value) {
      setCode(value);
      compileCode(value);
    }
  };

  const handlePlay = async () => {
    // Tone.js requires a user interaction to start the AudioContext
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.start();
    setIsPlaying(true);
    
    // Send absolute time to WebGL worker for synchronization
    renderWorkerRef.current?.postMessage({ 
      type: 'START_PLAYBACK', 
      absoluteStartTime: performance.timeOrigin + performance.now(),
      latencyMs: Tone.context.lookAhead * 1000
    });
  };

  const handleStop = () => {
    Tone.Transport.stop();
    setIsPlaying(false);
    renderWorkerRef.current?.postMessage({ type: 'STOP_PLAYBACK' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        setStatus('Decompiling MIDI...');
        workerRef.current?.postMessage({ type: 'DECOMPILE', midi_bytes: uint8Array });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center font-bold text-white">T</div>
          <h1 className="text-xl font-semibold tracking-tight">Tenuto Studio</h1>
          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs text-zinc-400 border border-zinc-700 ml-2">v3.0.1</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-zinc-400 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status.includes('Error') || status.includes('failed') ? 'bg-red-500' : status.includes('Compiling') ? 'bg-yellow-500' : 'bg-emerald-500'}`}></div>
            {status}
          </div>
          
          <div className="h-6 w-px bg-zinc-800 mx-2"></div>
          
          <button 
            onClick={isPlaying ? handleStop : handlePlay}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md font-medium transition-colors ${isPlaying ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'}`}
          >
            {isPlaying ? <Square size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Editor */}
        <div className="w-1/2 flex flex-col border-r border-zinc-800">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Code size={16} />
              <span>Source Code (.ten)</span>
            </div>
            
            <label className="flex items-center gap-2 px-3 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 rounded cursor-pointer transition-colors">
              <Upload size={14} />
              Decompile MIDI
              <input type="file" accept=".mid,.midi" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
          
          <div className="flex-1 relative">
            <Editor
              height="100%"
              defaultLanguage="tenuto"
              theme="vs-dark"
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 24,
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
              }}
            />
            
            {/* Diagnostics Panel */}
            {diagnostics.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-red-950/90 border-t border-red-900 p-4 max-h-48 overflow-y-auto backdrop-blur-md z-20">
                <h3 className="text-red-400 font-semibold text-sm mb-2">Compilation Errors</h3>
                <ul className="space-y-2">
                  {diagnostics.map((diag, i) => (
                    <li key={i} className="text-sm text-red-200 font-mono">
                      <span className="text-red-500 mr-2">[{diag.line}:{diag.column}]</span>
                      {diag.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Visualizers */}
        <div className="w-1/2 flex flex-col bg-zinc-50">
          {/* Top Half: SVG Engraver (Phase 8) */}
          <div className="flex-1 flex flex-col border-b border-zinc-200">
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-200 border-b border-zinc-300 text-zinc-700">
              <FileCode size={16} />
              <span className="text-sm font-medium">TEAS Engraver (SVG)</span>
            </div>
            <div className="flex-1 overflow-auto p-8 flex justify-center bg-white shadow-inner">
              {svgScore ? (
                <div 
                  className="w-full max-w-2xl bg-white shadow-lg border border-zinc-200"
                  dangerouslySetInnerHTML={{ __html: svgScore }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-400">
                  No visual score generated
                </div>
              )}
            </div>
          </div>
          
          {/* Bottom Half: WebGL Piano Roll */}
          <div className="h-64 flex flex-col bg-zinc-950">
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-zinc-300">
              <Play size={16} />
              <span className="text-sm font-medium">WebGL Playback Engine</span>
            </div>
            <div className="flex-1 relative" ref={canvasContainerRef}>
              {/* Playhead overlay */}
              {isPlaying && (
                <div className="absolute top-0 bottom-0 w-px bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] z-10" style={{ left: '15%' }}></div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
