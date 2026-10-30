import type { Rect } from '../film/types';
import type { ShaderParams } from './params';

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){
  vUv = vec2((aPos.x + 1.0) * 0.5, (1.0 - aPos.y) * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uBright, uContrast, uSat, uWarm, uFade, uGrain, uGlow, uVig, uInt, uSplit, uLeak, uBw, uLeakCorner, uSlotN, uSeed;
uniform vec3 uShadow, uHigh, uLeakCol;
uniform vec4 uSlots[4];

float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

void main(){
  vec4 src = texture2D(uTex, vUv);
  if (src.a < 0.002) { gl_FragColor = vec4(0.0); return; }
  vec3 c = src.rgb;

  c += uBright * 0.25;
  c = (c - 0.5) * (1.0 + uContrast * 0.9) + 0.5;
  float l = luma(c);
  c = mix(vec3(l), c, 1.0 + uSat);
  if (uBw > 0.5) c = vec3(luma(c));
  c += vec3(uWarm * 0.09, uWarm * 0.02, -uWarm * 0.11);

  l = luma(c);
  c += uShadow * uSplit * (1.0 - smoothstep(0.0, 0.6, l));
  c = mix(c, c * uHigh, uSplit * smoothstep(0.35, 1.0, l));
  c = mix(c, c * 0.84 + 0.08, uFade);

  if (uGlow > 0.0) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982;
      vec2 o = vec2(cos(a), sin(a) * uRes.x / uRes.y) * 0.018;
      vec4 s1 = texture2D(uTex, vUv + o);
      vec4 s2 = texture2D(uTex, vUv + o * 2.2);
      acc += max(s1.rgb - 0.6, 0.0) * s1.a + max(s2.rgb - 0.62, 0.0) * s2.a * 0.7;
    }
    vec3 halo = acc / 14.0;
    c += halo * vec3(1.0, 0.5, 0.35) * uGlow * 3.2 + halo * uGlow;
  }

  for (int i = 0; i < 4; i++) {
    if (float(i) < uSlotN) {
      vec4 s = uSlots[i];
      if (vUv.x >= s.x && vUv.x <= s.x + s.z && vUv.y >= s.y && vUv.y <= s.y + s.w) {
        vec2 p = ((vUv - s.xy) / s.zw) * 2.0 - 1.0;
        c *= 1.0 - smoothstep(0.5, 1.5, length(p)) * uVig * 0.8;
        if (uLeak > 0.0) {
          vec2 cp = vec2(mod(uLeakCorner, 2.0) * 2.0 - 1.0, uLeakCorner < 1.5 ? -1.0 : 1.0);
          float k = pow(clamp(1.0 - distance(p, cp) / 1.5, 0.0, 1.0), 2.0);
          c += uLeakCol * k * uLeak * 0.9;
        }
      }
    }
  }

  vec2 gp = floor(vUv * vec2(520.0, 520.0 * uRes.y / uRes.x)) + uSeed;
  float n = (hash(gp) - 0.5) * 0.7 + (hash(gp * 1.7 + 13.1) - 0.5) * 0.3;
  l = luma(c);
  c += n * uGrain * 0.26 * (0.35 + (1.0 - abs(l - 0.5) * 1.6));

  c = mix(src.rgb, clamp(c, 0.0, 1.0), uInt);
  gl_FragColor = vec4(c * src.a, src.a);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/** The film-look pass. One shared instance renders previews, thumbnails and the final export. */
export class FilterGL {
  readonly canvas: HTMLCanvasElement;
  readonly maxSize: number;
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private tex: WebGLTexture;
  private loc = new Map<string, WebGLUniformLocation | null>();
  lost = false;

  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext, prog: WebGLProgram, tex: WebGLTexture) {
    this.canvas = canvas;
    this.gl = gl;
    this.prog = prog;
    this.tex = tex;
    this.maxSize = Math.min(8192, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
  }

  static create(): FilterGL | null {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: false });
      if (!gl) return null;
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      const prog = gl.createProgram();
      const tex = gl.createTexture();
      if (!vs || !fs || !prog || !tex) return null;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return new FilterGL(canvas, gl, prog, tex);
    } catch {
      return null;
    }
  }

  private u(name: string) {
    if (!this.loc.has(name)) this.loc.set(name, this.gl.getUniformLocation(this.prog, name));
    return this.loc.get(name) ?? null;
  }

  /** `slots` are in 0..1 uv space of `src` (origin top-left). */
  apply(src: HTMLCanvasElement, p: ShaderParams, slots: Rect[], seed = 0): HTMLCanvasElement | null {
    if (this.lost || src.width < 1 || src.height < 1 || Math.max(src.width, src.height) > this.maxSize) return null;
    const gl = this.gl;
    if (this.canvas.width !== src.width || this.canvas.height !== src.height) {
      this.canvas.width = src.width;
      this.canvas.height = src.height;
    }
    gl.viewport(0, 0, src.width, src.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const f = (n: string, v: number) => gl.uniform1f(this.u(n), v);
    gl.uniform2f(this.u('uRes'), src.width, src.height);
    f('uBright', p.brightness); f('uContrast', p.contrast); f('uSat', p.saturation); f('uWarm', p.warmth);
    f('uFade', p.fade); f('uGrain', p.grain); f('uGlow', p.glow); f('uVig', p.vignette); f('uInt', p.intensity);
    f('uSplit', p.split); f('uLeak', p.leak); f('uBw', p.bw ? 1 : 0); f('uLeakCorner', p.leakCorner); f('uSeed', seed);
    gl.uniform3fv(this.u('uShadow'), p.shadow);
    gl.uniform3fv(this.u('uHigh'), p.highlight);
    gl.uniform3fv(this.u('uLeakCol'), p.leakColor);
    const flat = new Float32Array(16);
    slots.slice(0, 4).forEach((r, i) => flat.set([r.x, r.y, r.w, r.h], i * 4));
    f('uSlotN', Math.min(4, slots.length));
    gl.uniform4fv(this.u('uSlots'), flat);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.canvas;
  }
}
