/* The Monet, screened in CMYK at the classic press angles (Y 0°, C 15°, K 45°, M 75°).
   Inks are printed at 38% of full strength so the plate can only ever sit darker than
   the green: cream measures 5.27:1 against the worst case (solid yellow), so the text
   needs no scrim anywhere on the field.
   Resolution follows attention: wherever you look the screen refines and the painting
   resolves; away from you it stays coarse and abstract. The four plates also separate
   in depth as you move, so the print reads as a stack of inked sheets rather than one
   flat image. Type your address and the plates pull into register. All of it eased —
   nothing jitters, and it settles to still with no idle loop. */
(function () {
  var canvas = document.querySelector('.hero__print');
  if (!canvas || !window.MONET) return;

  var gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl) return;

  var VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAG = [
    'precision highp float;',
    'uniform sampler2D uTex;',
    'uniform vec2  uRes, uUvScale, uUvOffset, uShift, uMouse;',
    'uniform float uCell, uAlpha, uLensR, uLens, uFocus;',

    'vec2 rot(vec2 p, float a){ float s = sin(a), c = cos(a); return mat2(c, -s, s, c) * p; }',

    'vec4 inksAt(vec2 px){',
    '  vec2 uv = clamp(px / uRes * uUvScale + uUvOffset, 0.0, 1.0);',
    '  uv.x = 1.0 - uv.x;',
    '  vec3 rgb = texture2D(uTex, uv).rgb;',
    '  float k = 1.0 - max(max(rgb.r, rgb.g), rgb.b);',
    '  vec3 cmy = (1.0 - rgb - k) / max(1.0 - k, 1e-4);',
    '  return vec4(clamp(cmy, 0.0, 1.0), clamp(k, 0.0, 1.0));',
    '}',

    'float dot_(vec2 px, float angle, int channel, float cell){',
    '  vec2 p = rot(px, angle) / cell;',
    '  vec2 c = floor(p) + 0.5;',
    '  vec4 ink = inksAt(rot(c * cell, -angle));',
    '  float v = channel == 0 ? ink.x : channel == 1 ? ink.y : channel == 2 ? ink.z : ink.w;',
    '  float r = sqrt(clamp(v, 0.0, 1.0)) * 0.74;',
    '  return 1.0 - smoothstep(r - 0.07, r + 0.07, length(p - c));',
    '}',

    'void lay(inout vec3 col, inout float a, vec3 ink, float cov){',
    '  col = col * (1.0 - cov) + ink * cov;',
    '  a   = a   * (1.0 - cov) + cov;',
    '}',

    'vec4 plate(vec2 px, float cell, vec2 sh){',
    '  vec3 col = vec3(0.0); float a = 0.0;',
    '  lay(col, a, vec3(0.38, 0.36, 0.17), dot_(px,                        0.0,    2, cell));',
    '  lay(col, a, vec3(0.11, 0.30, 0.38), dot_(px + sh * vec2( 1.0, 0.6),  0.2618, 0, cell));',
    '  lay(col, a, vec3(0.38, 0.17, 0.27), dot_(px + sh * vec2(-0.8, 0.45), 1.3090, 1, cell));',
    '  lay(col, a, vec3(0.13, 0.12, 0.11), dot_(px + sh * vec2( 0.3,-0.55), 0.7854, 3, cell));',
    '  return vec4(col, a);',
    '}',

    'void main(){',
    '  vec2 px = gl_FragCoord.xy;',
    '  px.y = uRes.y - px.y;',
    /* a wide, soft field of attention: 1 where you are looking, 0 far away */
    '  float d = distance(px, uMouse) / uLensR;',
    '  float attn = uLens * (1.0 - smoothstep(0.0, 1.0, d * d));',
    /* typing pulls the plates into register and tightens the screen */
    '  vec2  sh   = uShift * (1.0 - uFocus * 0.92);',
    '  float cell = uCell * mix(1.0, 0.72, uFocus);',
    '  vec4 sharp = plate(px, cell,       sh);',
    '  vec4 broad = plate(px, cell * 2.9, sh * 2.1);',
    '  vec4 p = mix(broad, sharp, max(attn, 1.0 - uLens));',
    '  float al = min(uAlpha * mix(0.82, 1.25, attn) * mix(1.0, 1.15, uFocus), 1.0);',
    '  gl_FragColor = vec4(p.rgb * al, p.a * al);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(sh)); return null; }
    return sh;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var u = {};
  ['uTex','uRes','uUvScale','uUvOffset','uCell','uAlpha','uShift','uMouse','uLensR','uLens','uFocus']
    .forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  function dpr() { return Math.min(window.devicePixelRatio || 1, 2); }

  var imgW = 1, imgH = 1, ready = false;
  var mouse = [-9999, -9999];
  var shift = [0, 0], tShift = [0, 0];
  var lens = 0, tLens = 0;
  var radius = 520, tRadius = 520;
  var focus = 0, tFocus = 0;            // how far the plates have pulled into register
  var raf = null;

  var img = new Image();
  img.onload = function () {
    imgW = img.naturalWidth; imgH = img.naturalHeight;
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(u.uTex, 0);
    ready = true;
    canvas.classList.add('is-printed');
    draw();
  };
  img.src = window.MONET;

  function draw() {
    if (!ready) return;
    var d = dpr();
    var w = Math.max(1, Math.round(canvas.clientWidth * d));
    var h = Math.max(1, Math.round(canvas.clientHeight * d));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);

    var sCanvas = w / h, sImg = imgW / imgH, sx = 1, sy = 1;   // object-fit: cover
    if (sCanvas > sImg) { sy = sImg / sCanvas; } else { sx = sCanvas / sImg; }

    gl.uniform2f(u.uRes, w, h);
    gl.uniform2f(u.uUvScale, sx, sy);
    gl.uniform2f(u.uUvOffset, (1 - sx) / 2, (1 - sy) / 2);
    gl.uniform1f(u.uCell, 7 * d);
    gl.uniform1f(u.uAlpha, 0.78);
    gl.uniform2f(u.uShift, shift[0] * d, shift[1] * d);
    gl.uniform2f(u.uMouse, mouse[0] * d, mouse[1] * d);
    gl.uniform1f(u.uLensR, radius * d);
    gl.uniform1f(u.uLens, lens);
    gl.uniform1f(u.uFocus, focus);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(draw, 120);
  });

  var hero = canvas.parentElement;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
              !window.matchMedia('(pointer: fine)').matches;
  if (still || !hero) return;

  function step() {
    shift[0] += (tShift[0] - shift[0]) * 0.075;
    shift[1] += (tShift[1] - shift[1]) * 0.075;
    lens     += (tLens     - lens)     * 0.065;
    radius   += (tRadius   - radius)   * 0.07;
    focus    += (tFocus    - focus)    * 0.07;
    draw();
    var rest = Math.abs(tShift[0] - shift[0]) + Math.abs(tShift[1] - shift[1]) +
               Math.abs(tLens - lens) * 6 + Math.abs(tRadius - radius) * 0.02 +
               Math.abs(tFocus - focus) * 6;
    if (rest > 0.01) {
      raf = requestAnimationFrame(step);
    } else {
      shift[0] = tShift[0]; shift[1] = tShift[1]; lens = tLens; radius = tRadius;
      focus = tFocus;
      draw();
      raf = null;
    }
  }
  function wake() { if (!raf) raf = requestAnimationFrame(step); }

  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect();
    mouse[0] = e.clientX - r.left;
    mouse[1] = e.clientY - r.top;
    // depth: each plate rides a little further than the one below it
    tShift[0] = (mouse[0] / r.width  - 0.5) * 2 * 5.5;
    tShift[1] = (mouse[1] / r.height - 0.5) * 2 * 5.5;
    tLens = 1;
    wake();
  });
  hero.addEventListener('pointerleave', function () {
    tLens = 0; tShift[0] = 0; tShift[1] = 0; tRadius = 520;
    wake();
  });
  hero.addEventListener('pointerdown', function () { tRadius = 240; wake(); });
  window.addEventListener('pointerup', function () { tRadius = 520; wake(); });

  /* type your address and the press comes into register behind you */
  var field = hero.querySelector('input[type="email"]');
  if (field) {
    field.addEventListener('input', function () {
      tFocus = Math.min(1, field.value.length / 14);
      wake();
    });
    field.form.addEventListener('submit', function () {
      tFocus = 1; tRadius = 900;
      setTimeout(function () { tRadius = 520; wake(); }, 520);
      wake();
    });
  }
})();
