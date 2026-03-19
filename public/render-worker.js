let gl = null;
let program = null;
let gridProgram = null;
let uTimeLoc = null;
let uResLoc = null;
let uPitchOffsetLoc = null;
let uGridTimeLoc = null;
let uGridResLoc = null;
let uGridPitchOffsetLoc = null;
let instanceBuffer = null;
let quadBuffer = null;
let numInstances = 0;

let isPlaying = false;
let absoluteStartTime = 0;
let outputLatencyMs = 0;
let visualTime = 0.0;
let currentPitchOffset = 0;

let pendingNotes = null;

self.onmessage = (e) => {
    const { type } = e.data;
    
    if (type === 'INIT') {
        gl = e.data.canvas.getContext('webgl2', { antialias: true, alpha: false });
        if (!gl) {
            console.error("WebGL2 is not supported or canvas is invalid.");
            return;
        }
        initWebGL();
        if (pendingNotes) {
            updateInstances(pendingNotes);
            pendingNotes = null;
        }
    } else if (type === 'RESIZE' && gl) {
        gl.canvas.width = e.data.width; 
        gl.canvas.height = e.data.height; 
        gl.viewport(0, 0, e.data.width, e.data.height);
    } else if (type === 'UPDATE_NOTES') {
        if (!gl || !program) {
            pendingNotes = e.data.notes;
        } else {
            updateInstances(e.data.notes);
        }
    } else if (type === 'START_PLAYBACK') {
        isPlaying = true;
        absoluteStartTime = e.data.absoluteStartTime;
        outputLatencyMs = e.data.latencyMs;
    } else if (type === 'STOP_PLAYBACK') {
        isPlaying = false;
        visualTime = 0.0;
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
            
            // worldX represents the actual time in seconds at this pixel
            float worldX = (v_uv.x * u_resolution.x) + u_currentTime - viewOffset;
            
            // worldY represents the actual MIDI pitch at this pixel
            float worldY = (v_uv.y * u_resolution.y) + u_pitchOffset;
            
            // Grid lines (1 unit = 1 second or 1 semitone)
            float gridX = fract(worldX);
            float gridY = fract(worldY);
            
            // Pixel-perfect line thickness based on screen space derivatives
            vec2 fwidth_world = fwidth(vec2(worldX, worldY));
            float lineThicknessX = max(0.02, fwidth_world.x * 1.5);
            float lineThicknessY = max(0.05, fwidth_world.y * 1.5);
            
            float isLineX = 1.0 - smoothstep(0.0, lineThicknessX, gridX);
            float isLineY = 1.0 - smoothstep(0.0, lineThicknessY, gridY);
            
            // Highlight C notes (midi % 12 == 0)
            float isC = 1.0 - step(0.5, mod(worldY + 0.5, 12.0));
            
            // Highlight beats (assuming 120 BPM for now, so 1 beat = 0.5s)
            float isBeat = 1.0 - step(0.5, mod(worldX + 0.125, 0.5) * 4.0);
            
            vec3 bgColor = vec3(0.05, 0.05, 0.06);
            vec3 lineColor = vec3(0.12, 0.12, 0.15);
            vec3 cLineColor = vec3(0.2, 0.2, 0.25);
            vec3 beatLineColor = vec3(0.15, 0.15, 0.18);
            
            vec3 finalColor = bgColor;
            
            // Apply horizontal lines (pitches)
            finalColor = mix(finalColor, lineColor, isLineY);
            finalColor = mix(finalColor, cLineColor, isLineY * isC);
            
            // Apply vertical lines (time)
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
        
        void main() {
            v_duration = max(0.001, a_duration); 
            v_uv = a_position; 
            
            float x = a_startTime + (a_position.x * v_duration);
            float y = a_pitch + (a_position.y * 0.8) + 0.1; // 0.8 height for padding, 0.1 offset to center vertically
            
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
        out vec4 outColor;
        
        void main() {
            // Rounded corners approximation
            vec2 center = v_uv - 0.5;
            float dist = length(max(abs(center) - vec2(0.5 - 0.1, 0.5 - 0.2), 0.0));
            if (dist > 0.1) discard;
            
            // Active Neon Glow Styling
            float isPlayed = step(v_uv.x, 0.0); 
            vec3 baseColor = vec3(0.1, 0.7, 0.9);
            vec3 highlight = vec3(0.2, 0.9, 1.0);
            
            // Gradient
            vec3 finalColor = mix(baseColor, highlight, v_uv.y);
            finalColor += (isPlayed * 0.3);
            
            outColor = vec4(finalColor, 1.0);
        }`;
        
    const gridVs = compileShader(gl.VERTEX_SHADER, gridVsSource);
    const gridFs = compileShader(gl.FRAGMENT_SHADER, gridFsSource);
    gridProgram = gl.createProgram();
    gl.attachShader(gridProgram, gridVs);
    gl.attachShader(gridProgram, gridFs);
    gl.linkProgram(gridProgram);
    
    uGridTimeLoc = gl.getUniformLocation(gridProgram, "u_currentTime");
    uGridResLoc = gl.getUniformLocation(gridProgram, "u_resolution");
    uGridPitchOffsetLoc = gl.getUniformLocation(gridProgram, "u_pitchOffset");

    const vs = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    program = gl.createProgram(); 
    gl.attachShader(program, vs); 
    gl.attachShader(program, fs); 
    gl.linkProgram(program);
    
    uTimeLoc = gl.getUniformLocation(program, "u_currentTime"); 
    uResLoc = gl.getUniformLocation(program, "u_resolution");
    uPitchOffsetLoc = gl.getUniformLocation(program, "u_pitchOffset");
    
    const quadVertices = new Float32Array([
        0, 0,   1, 0,   0, 1,
        0, 1,   1, 0,   1, 1
    ]);
    
    quadBuffer = gl.createBuffer(); 
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer); 
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    
    instanceBuffer = gl.createBuffer(); 
    gl.enable(gl.BLEND); 
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    renderLoop();
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
    
    numInstances = notes.length; 
    if (numInstances === 0) return;
    
    const instanceData = new Float32Array(numInstances * 3);
    let minPitch = 127, maxPitch = 0;
    
    notes.forEach((n, i) => {
        instanceData[i*3+0] = n.time; 
        instanceData[i*3+1] = n.duration; 
        instanceData[i*3+2] = n.midi; 
        if (n.midi < minPitch) minPitch = n.midi; 
        if (n.midi > maxPitch) maxPitch = n.midi;
    });
    
    currentPitchOffset = Math.max(0, minPitch - 6);
    
    gl.useProgram(program);
    gl.uniform2f(uResLoc, 8.0, Math.max(24, (maxPitch - minPitch) + 12));
    gl.uniform1f(uPitchOffsetLoc, currentPitchOffset);
    
    gl.useProgram(gridProgram);
    gl.uniform2f(uGridResLoc, 8.0, Math.max(24, (maxPitch - minPitch) + 12));
    gl.uniform1f(uGridPitchOffsetLoc, currentPitchOffset);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    
    // Do not subtract currentPitchOffset from instanceData here anymore, 
    // because we are doing it in the vertex shader now!
    
    gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.STATIC_DRAW);
}

function renderLoop() {
    if (!gl || !program || !gridProgram) return;
    
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); 
    gl.clearColor(0.05, 0.05, 0.06, 1.0); 
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    if (isPlaying) {
        const currentAbsoluteTime = performance.timeOrigin + performance.now();
        visualTime = Math.max(0, (currentAbsoluteTime - absoluteStartTime - outputLatencyMs) / 1000.0);
    }
    
    // 1. Draw Grid
    gl.useProgram(gridProgram);
    gl.uniform1f(uGridTimeLoc, visualTime);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const gridPosLoc = gl.getAttribLocation(gridProgram, "a_position");
    gl.enableVertexAttribArray(gridPosLoc);
    gl.vertexAttribPointer(gridPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(gridPosLoc, 0); // Not instanced
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    // 2. Draw Notes
    if (numInstances > 0) {
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
    
    requestAnimationFrame(renderLoop);
}
