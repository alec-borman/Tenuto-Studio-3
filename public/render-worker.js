let gl = null;
let program = null;
let gridProgram = null;
let particleProgram = null;

let uTimeLoc = null;
let uResLoc = null;
let uPitchOffsetLoc = null;

let uGridTimeLoc = null;
let uGridResLoc = null;
let uGridPitchOffsetLoc = null;

let uParticleTimeLoc = null;
let uParticleResLoc = null;
let uParticlePitchOffsetLoc = null;

let instanceBuffer = null;
let quadBuffer = null;
let particleBuffer = null;

let numInstances = 0;

let isPlaying = false;
let audioStartTime = 0;
let visualTime = 0.0;
let lastVisualTime = 0.0;
let lastSyncVisualTime = 0.0;
let lastSyncPerfTime = 0.0;
let currentPitchOffset = 0;

let noteData = [];
let particles = []; // { x, y, vx, vy, life, maxLife, scale }

let pendingNotes = null;

self.onmessage = (e) => {
  const { type } = e.data;

  if (type === "INIT") {
    gl = e.data.canvas.getContext("webgl2", { antialias: true, alpha: false });
    if (!gl) {
      console.error("WebGL2 is not supported or canvas is invalid.");
      return;
    }
    initWebGL();
    if (pendingNotes) {
      updateInstances(pendingNotes);
      pendingNotes = null;
    }
  } else if (type === "RESIZE" && gl) {
    gl.canvas.width = e.data.width;
    gl.canvas.height = e.data.height;
    gl.viewport(0, 0, e.data.width, e.data.height);
  } else if (type === "UPDATE_NOTES") {
    if (!gl || !program) {
      pendingNotes = e.data.notes;
    } else {
      updateInstances(e.data.notes);
    }
  } else if (type === "START_PLAYBACK") {
    isPlaying = true;
    audioStartTime = e.data.startTime;
    visualTime = 0.0;
    lastVisualTime = 0.0;
    lastSyncPerfTime = 0.0;
    lastSyncVisualTime = 0.0;
    particles = [];
  } else if (type === "STOP_PLAYBACK") {
    isPlaying = false;
    visualTime = 0.0;
    lastVisualTime = 0.0;
    lastSyncPerfTime = 0.0;
    lastSyncVisualTime = 0.0;
    particles = [];
  } else if (type === "SYNC_TIME") {
    if (isPlaying) {
      lastSyncVisualTime = Math.max(0, e.data.currentTime - e.data.startTime);
      lastSyncPerfTime = performance.now();
    }
  }
};

function initWebGL() {
  // --- Grid Shader ---
  const gridVsSource = `#version 300 es
        in vec2 a_position;
        out vec2 v_uv;
        void main() {
            v_uv = a_position;
            gl_Position = vec4(a_position * 2.0 - 1.0, 0.0, 1.0);
        }`;

  const gridFsSource = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        uniform float u_currentTime;
        uniform vec2 u_resolution;
        uniform float u_pitchOffset;
        out vec4 outColor;
        
        void main() {
            float viewOffset = u_resolution.x * 0.15;
            
            float worldX = (v_uv.x * u_resolution.x) + u_currentTime - viewOffset;
            float worldY = (v_uv.y * u_resolution.y) + u_pitchOffset;
            
            float gridX = fract(worldX);
            float gridY = fract(worldY);
            
            vec2 fwidth_world = fwidth(vec2(worldX, worldY));
            float lineThicknessX = max(0.02, fwidth_world.x * 1.5);
            float lineThicknessY = max(0.05, fwidth_world.y * 1.5);
            
            float isLineX = 1.0 - smoothstep(0.0, lineThicknessX, gridX);
            float isLineY = 1.0 - smoothstep(0.0, lineThicknessY, gridY);
            
            float isC = 1.0 - step(0.5, mod(worldY + 0.5, 12.0));
            float isBeat = 1.0 - step(0.5, mod(worldX + 0.125, 0.5) * 4.0);
            
            vec3 bgColor = vec3(0.05, 0.05, 0.06);
            vec3 lineColor = vec3(0.12, 0.12, 0.15);
            vec3 cLineColor = vec3(0.2, 0.2, 0.25);
            vec3 beatLineColor = vec3(0.15, 0.15, 0.18);
            
            vec3 finalColor = bgColor;
            
            finalColor = mix(finalColor, lineColor, isLineY);
            finalColor = mix(finalColor, cLineColor, isLineY * isC);
            
            finalColor = mix(finalColor, lineColor, isLineX);
            finalColor = mix(finalColor, beatLineColor, isLineX * isBeat);
            
            outColor = vec4(finalColor, 1.0);
        }`;

  // --- Notes Shader ---
  const vertexShaderSource = `#version 300 es
        in vec2 a_position; 
        in float a_startTime; 
        in float a_duration; 
        in float a_pitch;
        
        uniform float u_currentTime; 
        uniform vec2 u_resolution;
        uniform float u_pitchOffset;
        
        out float v_duration; 
        out vec2 v_uv;
        out float v_isActive;
        out vec2 v_worldPos;
        out vec2 v_noteCenter;
        out vec2 v_noteSize;
        
        void main() {
            v_duration = max(0.001, a_duration); 
            v_uv = a_position; 
            
            // Check if note is currently playing
            v_isActive = step(a_startTime, u_currentTime) * step(u_currentTime, a_startTime + v_duration);
            
            // Expand quad for bloom if active
            float paddingX = v_isActive * 0.3;
            float paddingY = v_isActive * 0.4;
            
            float x = a_startTime + (a_position.x * v_duration);
            float y = a_pitch + (a_position.y * 0.8) + 0.1;
            
            v_noteCenter = vec2(a_startTime + v_duration * 0.5, a_pitch + 0.5);
            v_noteSize = vec2(v_duration, 0.8);
            
            x += (a_position.x - 0.5) * paddingX * 2.0;
            y += (a_position.y - 0.5) * paddingY * 2.0;
            
            v_worldPos = vec2(x, y);
            
            float viewOffset = u_resolution.x * 0.15;
            x = x - u_currentTime + viewOffset;
            y = y - u_pitchOffset;
            
            float clipX = (x / u_resolution.x) * 2.0 - 1.0;
            float clipY = (y / u_resolution.y) * 2.0 - 1.0;
            
            gl_Position = vec4(clipX, clipY, 0.0, 1.0);
        }`;

  const fragmentShaderSource = `#version 300 es
        precision highp float; 
        in float v_duration; 
        in vec2 v_uv; 
        in float v_isActive;
        in vec2 v_worldPos;
        in vec2 v_noteCenter;
        in vec2 v_noteSize;
        uniform float u_currentTime;
        out vec4 outColor;
        
        void main() {
            vec2 d = abs(v_worldPos - v_noteCenter) - (v_noteSize * 0.5 - 0.1);
            float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
            
            if (v_isActive < 0.5 && dist > 0.1) discard;
            
            vec3 baseColor = vec3(0.1, 0.7, 0.9);
            vec3 highlight = vec3(0.2, 0.9, 1.0);
            vec3 finalColor = mix(baseColor, highlight, clamp(v_uv.y, 0.0, 1.0));
            
            if (v_isActive > 0.5) {
                // Bloom effect
                float pulse = sin(u_currentTime * 30.0) * 0.5 + 0.5;
                vec3 activeGlow = vec3(1.0, 1.0, 1.0);
                
                if (dist > 0.1) {
                    // Outside the note body, draw glow
                    float glowAlpha = max(0.0, 1.0 - (dist - 0.1) * 5.0);
                    finalColor = mix(vec3(0.0), highlight * 2.0, glowAlpha * (0.5 + pulse * 0.5));
                } else {
                    // Inside the note body
                    finalColor = mix(finalColor, activeGlow, 0.4 + pulse * 0.4);
                }
            }
            
            outColor = vec4(finalColor, 1.0);
        }`;

  // --- Particle Shader ---
  const particleVsSource = `#version 300 es
        in vec2 a_position;
        in vec2 a_offset;
        in float a_life;
        in float a_scale;
        
        uniform float u_currentTime;
        uniform vec2 u_resolution;
        uniform float u_pitchOffset;
        
        out float v_life;
        out vec2 v_uv;
        
        void main() {
            v_life = a_life;
            v_uv = a_position;
            
            float viewOffset = u_resolution.x * 0.15;
            float x = a_offset.x - u_currentTime + viewOffset;
            float y = a_offset.y - u_pitchOffset;
            
            float aspect = u_resolution.y / u_resolution.x;
            x += (a_position.x - 0.5) * a_scale;
            y += (a_position.y - 0.5) * a_scale * aspect;
            
            float clipX = (x / u_resolution.x) * 2.0 - 1.0;
            float clipY = (y / u_resolution.y) * 2.0 - 1.0;
            
            gl_Position = vec4(clipX, clipY, 0.0, 1.0);
        }`;

  const particleFsSource = `#version 300 es
        precision highp float;
        in float v_life;
        in vec2 v_uv;
        out vec4 outColor;
        
        void main() {
            vec2 center = v_uv - 0.5;
            float dist = length(center) * 2.0;
            if (dist > 1.0) discard;
            
            float alpha = (1.0 - dist) * v_life;
            vec3 color = mix(vec3(1.0, 0.3, 0.1), vec3(1.0, 0.9, 0.4), v_life);
            
            outColor = vec4(color * alpha, alpha); // Additive blending ready
        }`;

  gridProgram = createProgram(gridVsSource, gridFsSource);
  uGridTimeLoc = gl.getUniformLocation(gridProgram, "u_currentTime");
  uGridResLoc = gl.getUniformLocation(gridProgram, "u_resolution");
  uGridPitchOffsetLoc = gl.getUniformLocation(gridProgram, "u_pitchOffset");

  program = createProgram(vertexShaderSource, fragmentShaderSource);
  uTimeLoc = gl.getUniformLocation(program, "u_currentTime");
  uResLoc = gl.getUniformLocation(program, "u_resolution");
  uPitchOffsetLoc = gl.getUniformLocation(program, "u_pitchOffset");

  particleProgram = createProgram(particleVsSource, particleFsSource);
  uParticleTimeLoc = gl.getUniformLocation(particleProgram, "u_currentTime");
  uParticleResLoc = gl.getUniformLocation(particleProgram, "u_resolution");
  uParticlePitchOffsetLoc = gl.getUniformLocation(
    particleProgram,
    "u_pitchOffset",
  );

  const quadVertices = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

  quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

  instanceBuffer = gl.createBuffer();
  particleBuffer = gl.createBuffer();

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending for everything

  renderLoop();
}

function createProgram(vsSource, fsSource) {
  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  return prog;
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function updateInstances(notes) {
  if (!gl || !program) return;

  noteData = notes;
  numInstances = notes.length;
  if (numInstances === 0) return;

  const instanceData = new Float32Array(numInstances * 3);
  let minPitch = 127,
    maxPitch = 0;

  notes.forEach((n, i) => {
    instanceData[i * 3 + 0] = n.time;
    instanceData[i * 3 + 1] = n.duration;
    instanceData[i * 3 + 2] = n.midi;
    if (n.midi < minPitch) minPitch = n.midi;
    if (n.midi > maxPitch) maxPitch = n.midi;
  });

  currentPitchOffset = Math.max(0, minPitch - 6);

  const resX = 8.0;
  const resY = Math.max(24, maxPitch - minPitch + 12);

  gl.useProgram(program);
  gl.uniform2f(uResLoc, resX, resY);
  gl.uniform1f(uPitchOffsetLoc, currentPitchOffset);

  gl.useProgram(gridProgram);
  gl.uniform2f(uGridResLoc, resX, resY);
  gl.uniform1f(uGridPitchOffsetLoc, currentPitchOffset);

  gl.useProgram(particleProgram);
  gl.uniform2f(uParticleResLoc, resX, resY);
  gl.uniform1f(uParticlePitchOffsetLoc, currentPitchOffset);

  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.STATIC_DRAW);
}

function spawnParticles(time, pitch) {
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.0 + 1.0;
    particles.push({
      x: time,
      y: pitch + 0.5, // center of note
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 2.0, // scale Y speed
      life: 1.0,
      maxLife: 0.3 + Math.random() * 0.4,
      scale: 0.1 + Math.random() * 0.2,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt / p.maxLife;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function renderLoop() {
  if (!gl || !program || !gridProgram) return;

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.05, 0.05, 0.06, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (isPlaying && lastSyncPerfTime > 0) {
    const elapsedSinceSync = (performance.now() - lastSyncPerfTime) / 1000.0;
    visualTime = lastSyncVisualTime + elapsedSinceSync;
  }

  const dt = Math.max(0, visualTime - lastVisualTime);

  if (isPlaying && noteData) {
    // Check for new hits
    noteData.forEach((n) => {
      if (n.time > lastVisualTime && n.time <= visualTime) {
        spawnParticles(n.time, n.midi);
      }
    });

    updateParticles(dt);
  }

  lastVisualTime = visualTime;

  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // 1. Draw Grid
  gl.useProgram(gridProgram);
  gl.uniform1f(uGridTimeLoc, visualTime);

  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  const gridPosLoc = gl.getAttribLocation(gridProgram, "a_position");
  gl.enableVertexAttribArray(gridPosLoc);
  gl.vertexAttribPointer(gridPosLoc, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(gridPosLoc, 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // 2. Draw Notes
  if (numInstances > 0) {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive for bloom

    gl.useProgram(program);
    gl.uniform1f(uTimeLoc, visualTime);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(posLoc, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);

    const setAttr = (name, size, stride, offset) => {
      const loc = gl.getAttribLocation(program, name);
      if (loc === -1) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(loc, 1);
    };

    setAttr("a_startTime", 1, 12, 0);
    setAttr("a_duration", 1, 12, 4);
    setAttr("a_pitch", 1, 12, 8);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, numInstances);
  }

  // 3. Draw Particles
  if (particles.length > 0) {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive

    gl.useProgram(particleProgram);
    gl.uniform1f(uParticleTimeLoc, visualTime);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const posLoc = gl.getAttribLocation(particleProgram, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(posLoc, 0);

    const pData = new Float32Array(particles.length * 4);
    particles.forEach((p, i) => {
      pData[i * 4 + 0] = p.x;
      pData[i * 4 + 1] = p.y;
      pData[i * 4 + 2] = p.life;
      pData[i * 4 + 3] = p.scale;
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, pData, gl.DYNAMIC_DRAW);

    const setPAttr = (name, size, stride, offset) => {
      const loc = gl.getAttribLocation(particleProgram, name);
      if (loc === -1) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(loc, 1);
    };

    setPAttr("a_offset", 2, 16, 0);
    setPAttr("a_life", 1, 16, 8);
    setPAttr("a_scale", 1, 16, 12);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, particles.length);
  }

  requestAnimationFrame(renderLoop);
}
