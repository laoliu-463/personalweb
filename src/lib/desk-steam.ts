// 只渲染杯口上方的小区域，原画不经过滤镜或逐帧处理。
const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentSource = `
precision mediump float;
varying vec2 uv;
uniform float time;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), u.x),
             mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float value = 0.0;
  float weight = 0.5;
  for (int i = 0; i < 4; i++) {
    value += weight * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.1;
    weight *= 0.5;
  }
  return value;
}
void main() {
  float h = uv.y;
  float t = time * 0.38;
  float drift = (noise(vec2(h * 3.1 - t, t * 0.35)) - 0.5) * (0.1 + h * 0.65);
  float curl = sin(h * 9.0 - t * 1.9) * h * 0.08;
  float x = (uv.x - 0.5) * 2.0 - drift - curl;
  float width = 0.035 + pow(h, 0.8) * 0.36;
  float warp = fbm(vec2(x * 4.0, h * 5.0 - t)) - 0.45;
  float plume = exp(-pow((x + warp * h * 0.22) / width, 2.0));
  float detail = fbm(vec2(x * 13.0 + warp, h * 8.0 - t * 1.8));
  float strands = smoothstep(0.31, 0.66, detail);
  float fade = smoothstep(0.0, 0.035, h) * (1.0 - smoothstep(0.43, 0.98, h));
  float wisps = smoothstep(0.32, 0.64, fbm(vec2(x * 4.0 + 1.7, h * 5.5 - t * 1.3)));
  float density = strands * (0.25 + wisps * 0.75);
  float alpha = plume * fade * density * 0.55;
  gl_FragColor = vec4(vec3(0.94, 0.93, 0.88) * alpha, alpha);
}`;

export function createDeskSteam(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;

  function compile(type: number, source: string) {
    if (!gl) return null;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  }

  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    if (program) gl.deleteProgram(program);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const buffer = gl.createBuffer();
  if (!buffer) { gl.deleteProgram(program); return null; }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, canvas.width, canvas.height);
  const time = gl.getUniformLocation(program, 'time');
  let running = false;
  let frame = 0;
  let previous = 0;
  let elapsed = 5.4;

  function draw(now: number) {
    if (!running || !gl) return;
    // 环境效果只需每秒 30 帧，暂停后不补算离开的时间。
    if (now - previous >= 1000 / 30) {
      elapsed += Math.min((now - previous) / 1000, 0.1);
      previous = now;
      gl.uniform1f(time, elapsed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    frame = requestAnimationFrame(draw);
  }

  const setRunning = (next: boolean) => {
    if (running === next) return;
    running = next;
    if (next) { previous = performance.now(); frame = requestAnimationFrame(draw); }
    else cancelAnimationFrame(frame);
  };
  const onContextLost = (event: Event) => { event.preventDefault(); setRunning(false); canvas.hidden = true; };
  canvas.addEventListener('webglcontextlost', onContextLost);

  return {
    setRunning,
    dispose() {
      setRunning(false);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
