import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Square, Code, FileCode, Upload } from 'lucide-react';
import * as Tone from 'tone';
import { registerTenutoLanguage } from './editor/tenutoLanguage';
import { AudioEngine } from './audio/engine';

import { Diagnostic } from './compiler/diagnostics';

const DEFAULT_CODE = `tenuto "3.0" {
  meta @{ title: "The Producer Suite", tempo: 130, time: "4/4" }
  
  def vln1 "Violin I" style=standard patch=gm_piano
  def vln2 "Violin II" style=standard patch=gm_piano
  def sub "Sub Bass" style=synth env=@{ a: 5ms, d: 1s, s: 100%, r: 50ms }
  def vox "Vocal Chops" style=concrete src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
  
  measure 1 {
    vln1: c5:4.slur "Ah" d:8 e:4.tie e:8 |
    vln2: e4:4.p "Ooh" g4:8 c5:4.f.push(20) c5:8.pull(10) |
    sub: c2:2.glide(500ms) g2:2 |
    vox: c4:4.slice(1) c4:4.slice(2) c4:4.slice(3) c4:4.slice(4) |
  }
}`;

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [svgScore, setSvgScore] = useState<string | null>(null);
  const [musicXml, setMusicXml] = useState<string | null>(null);
  const [status, setStatus] = useState('Booting compiler...');
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);
  const renderWorkerRef = useRef<Worker | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  
  // Audio state
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const audioEventsRef = useRef<any[]>([]);
  const playbackStateRef = useRef<{
    isPlaying: boolean;
    startTime: number;
    nextEventIndex: number;
    timerId: number | null;
  }>({
    isPlaying: false,
    startTime: 0,
    nextEventIndex: 0,
    timerId: null
  });

  useEffect(() => {
    audioEngineRef.current = new AudioEngine();
  }, []);

  const scheduleAudio = () => {
    const state = playbackStateRef.current;
    if (!state.isPlaying) return;

    const context = Tone.getContext().rawContext as AudioContext;
    const currentTime = context.currentTime;
    const lookahead = 0.1; // 100ms lookahead

    // Calculate current playback time relative to start
    const playbackTime = currentTime - state.startTime;

    // Schedule events that fall within the lookahead window
    while (
      state.nextEventIndex < audioEventsRef.current.length &&
      audioEventsRef.current[state.nextEventIndex].time <= playbackTime + lookahead
    ) {
      const event = audioEventsRef.current[state.nextEventIndex];
      
      if (audioEngineRef.current) {
        audioEngineRef.current.schedule(event, state.startTime);
      }
      
      state.nextEventIndex++;
    }

    // Stop playback if all events are scheduled and played
    if (state.nextEventIndex >= audioEventsRef.current.length) {
      // We could stop here, but let's just let it finish playing
      // We'll stop the timer though
      if (state.timerId !== null) {
        window.clearInterval(state.timerId);
        state.timerId = null;
      }
      // We don't set isPlaying to false immediately because notes are still sounding
      setTimeout(() => {
        setIsPlaying(false);
        renderWorkerRef.current?.postMessage({ type: 'STOP_PLAYBACK' });
      }, 2000); // Wait 2 seconds for tails
      return;
    }
  };

  useEffect(() => {
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
        setMusicXml(payload.musicxml);
        setDiagnostics(payload.diagnostics || []);
        
        // Parse the compiled MIDI bytes and send to WebGL renderer
        if (renderWorkerRef.current && payload.midi) {
          try {
            import('@tonejs/midi').then(async ({ Midi }) => {
              const midi = new Midi(payload.midi);
              const notes: any[] = [];
              
              // Clear previous audio part
              audioEventsRef.current = [];
              
              // Ensure AudioContext is available
              const context = Tone.getContext().rawContext as AudioContext;
              
              // Load instruments
              for (let i = 0; i < midi.tracks.length; i++) {
                const track = midi.tracks[i];
                track.notes.forEach(note => {
                  notes.push({
                    time: note.time,
                    duration: note.duration,
                    midi: note.midi
                  });
                });
              }
              
              if (payload.audioEvents && audioEngineRef.current) {
                audioEventsRef.current = payload.audioEvents;
                await audioEngineRef.current.loadInstruments(payload.audioEvents);
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
            status: 'fatal',
            code: 'E0000',
            type: 'Unknown Error',
            location: { line: 1, column: 1 },
            diagnostics: {
              message: payload.message || 'Unknown error'
            }
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
      if (audioEngineRef.current) {
        audioEngineRef.current.stopAll();
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
        const markers = diagnostics.map(diag => {
          let severity = monacoRef.current.MarkerSeverity.Error;
          if (diag.status === 'warning') {
            severity = monacoRef.current.MarkerSeverity.Warning;
          }
          
          let message = `[${diag.code}] ${diag.type}: ${diag.diagnostics.message}`;
          if (diag.diagnostics.suggestion) {
            message += `\nSuggestion: ${diag.diagnostics.suggestion}`;
          }

          return {
            severity,
            startLineNumber: diag.location.line,
            startColumn: diag.location.column,
            endLineNumber: diag.location.line,
            endColumn: diag.location.column + 5, // Approximate word length for squiggle
            message
          };
        });
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

  const syncTimeRef = useRef<number | null>(null);

  const syncTime = () => {
    if (playbackStateRef.current.isPlaying) {
      const context = Tone.getContext().rawContext as AudioContext;
      renderWorkerRef.current?.postMessage({
        type: 'SYNC_TIME',
        currentTime: context.currentTime,
        startTime: playbackStateRef.current.startTime
      });
      syncTimeRef.current = requestAnimationFrame(syncTime);
    }
  };

  const handlePlay = async () => {
    // Tone.js requires a user interaction to start the AudioContext
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    
    if (audioEngineRef.current) {
      audioEngineRef.current.stopAll();
    }
    
    const context = Tone.getContext().rawContext as AudioContext;
    
    if (playbackStateRef.current.timerId !== null) {
      window.clearInterval(playbackStateRef.current.timerId);
    }
    
    playbackStateRef.current = {
      isPlaying: true,
      startTime: context.currentTime + 0.1, // Start slightly in the future
      nextEventIndex: 0,
      timerId: window.setInterval(scheduleAudio, 25) // Run every 25ms
    };
    
    setIsPlaying(true);
    
    if (syncTimeRef.current !== null) {
      cancelAnimationFrame(syncTimeRef.current);
    }
    syncTimeRef.current = requestAnimationFrame(syncTime);
    
    // Send absolute time to WebGL worker for synchronization
    renderWorkerRef.current?.postMessage({ 
      type: 'START_PLAYBACK', 
      startTime: playbackStateRef.current.startTime
    });
  };

  const handleStop = () => {
    if (playbackStateRef.current.timerId !== null) {
      window.clearInterval(playbackStateRef.current.timerId);
      playbackStateRef.current.timerId = null;
    }
    playbackStateRef.current.isPlaying = false;
    
    if (syncTimeRef.current !== null) {
      cancelAnimationFrame(syncTimeRef.current);
      syncTimeRef.current = null;
    }
    
    if (audioEngineRef.current) {
      audioEngineRef.current.stopAll();
    }
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

  const handleDownloadMusicXML = () => {
    if (!musicXml) return;
    const blob = new Blob([musicXml], { type: 'application/vnd.recordare.musicxml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'score.musicxml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
              <div className="absolute bottom-0 left-0 right-0 bg-zinc-950/90 border-t border-zinc-800 p-4 max-h-48 overflow-y-auto backdrop-blur-md z-20">
                <h3 className="text-zinc-400 font-semibold text-sm mb-2">Diagnostics</h3>
                <ul className="space-y-2">
                  {diagnostics.map((diag, i) => (
                    <li key={i} className={`text-sm font-mono ${diag.status === 'fatal' ? 'text-red-200' : 'text-yellow-200'}`}>
                      <span className={`${diag.status === 'fatal' ? 'text-red-500' : 'text-yellow-500'} mr-2`}>
                        [{diag.location.line}:{diag.location.column}] {diag.code} ({diag.type})
                      </span>
                      {diag.diagnostics.message}
                      {diag.diagnostics.suggestion && (
                        <div className="mt-1 ml-6 text-zinc-400 italic">
                          Suggestion: {diag.diagnostics.suggestion}
                        </div>
                      )}
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
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-200 border-b border-zinc-300 text-zinc-700">
              <div className="flex items-center gap-2">
                <FileCode size={16} />
                <span className="text-sm font-medium">TEAS Engraver (SVG)</span>
              </div>
              <button 
                onClick={handleDownloadMusicXML}
                disabled={!musicXml}
                className={`text-xs font-medium px-3 py-1 rounded transition-colors ${musicXml ? 'bg-zinc-300 hover:bg-zinc-400 text-zinc-800' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}
              >
                Download MusicXML
              </button>
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
