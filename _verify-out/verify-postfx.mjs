var ut = Object.defineProperty;
var ct = (n, e, t) => e in n ? ut(n, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[e] = t;
var C = (n, e, t) => ct(n, typeof e != "symbol" ? e + "" : e, t);
import * as L from "three";
import { Mesh as ft, OrthographicCamera as pt, BufferGeometry as dt, Float32BufferAttribute as We, ShaderMaterial as B, UniformsUtils as G, Vector2 as A, WebGLRenderTarget as Y, HalfFloatType as q, NoBlending as K, Clock as mt, Color as ge, Vector3 as X, AdditiveBlending as gt, MeshBasicMaterial as vt, RawShaderMaterial as xt, ColorManagement as bt, SRGBTransfer as Mt, LinearToneMapping as Tt, ReinhardToneMapping as St, CineonToneMapping as Ct, ACESFilmicToneMapping as wt, AgXToneMapping as Pt, NeutralToneMapping as _t, Matrix4 as Xe, DepthTexture as Rt, DepthStencilFormat as Dt, UnsignedInt248Type as yt, NearestFilter as Ye, MeshNormalMaterial as Et, AddEquation as qe, ZeroFactor as Je, DstAlphaFactor as At, DstColorFactor as Nt, CustomBlending as Ut, MathUtils as Ft, DataTexture as Bt, RedFormat as zt, FloatType as Vt, RepeatWrapping as $e } from "three";
const me = {
  name: "CopyShader",
  uniforms: {
    tDiffuse: { value: null },
    opacity: { value: 1 }
  },
  vertexShader: (
    /* glsl */
    `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`
  )
};
class W {
  constructor() {
    this.isPass = !0, this.enabled = !0, this.needsSwap = !0, this.clear = !1, this.renderToScreen = !1;
  }
  setSize() {
  }
  render() {
    console.error("THREE.Pass: .render() must be implemented in derived pass.");
  }
  dispose() {
  }
}
const kt = new pt(-1, 1, 1, -1, 0, 1);
class Ot extends dt {
  constructor() {
    super(), this.setAttribute("position", new We([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)), this.setAttribute("uv", new We([0, 2, 0, 0, 2, 0], 2));
  }
}
const It = new Ot();
class Re {
  constructor(e) {
    this._mesh = new ft(It, e);
  }
  dispose() {
    this._mesh.geometry.dispose();
  }
  render(e) {
    e.render(this._mesh, kt);
  }
  get material() {
    return this._mesh.material;
  }
  set material(e) {
    this._mesh.material = e;
  }
}
class it extends W {
  constructor(e, t) {
    super(), this.textureID = t !== void 0 ? t : "tDiffuse", e instanceof B ? (this.uniforms = e.uniforms, this.material = e) : e && (this.uniforms = G.clone(e.uniforms), this.material = new B({
      name: e.name !== void 0 ? e.name : "unspecified",
      defines: Object.assign({}, e.defines),
      uniforms: this.uniforms,
      vertexShader: e.vertexShader,
      fragmentShader: e.fragmentShader
    })), this.fsQuad = new Re(this.material);
  }
  render(e, t, s) {
    this.uniforms[this.textureID] && (this.uniforms[this.textureID].value = s.texture), this.fsQuad.material = this.material, this.renderToScreen ? (e.setRenderTarget(null), this.fsQuad.render(e)) : (e.setRenderTarget(t), this.clear && e.clear(e.autoClearColor, e.autoClearDepth, e.autoClearStencil), this.fsQuad.render(e));
  }
  dispose() {
    this.material.dispose(), this.fsQuad.dispose();
  }
}
class et extends W {
  constructor(e, t) {
    super(), this.scene = e, this.camera = t, this.clear = !0, this.needsSwap = !1, this.inverse = !1;
  }
  render(e, t, s) {
    const i = e.getContext(), a = e.state;
    a.buffers.color.setMask(!1), a.buffers.depth.setMask(!1), a.buffers.color.setLocked(!0), a.buffers.depth.setLocked(!0);
    let r, o;
    this.inverse ? (r = 0, o = 1) : (r = 1, o = 0), a.buffers.stencil.setTest(!0), a.buffers.stencil.setOp(i.REPLACE, i.REPLACE, i.REPLACE), a.buffers.stencil.setFunc(i.ALWAYS, r, 4294967295), a.buffers.stencil.setClear(o), a.buffers.stencil.setLocked(!0), e.setRenderTarget(s), this.clear && e.clear(), e.render(this.scene, this.camera), e.setRenderTarget(t), this.clear && e.clear(), e.render(this.scene, this.camera), a.buffers.color.setLocked(!1), a.buffers.depth.setLocked(!1), a.buffers.color.setMask(!0), a.buffers.depth.setMask(!0), a.buffers.stencil.setLocked(!1), a.buffers.stencil.setFunc(i.EQUAL, 1, 4294967295), a.buffers.stencil.setOp(i.KEEP, i.KEEP, i.KEEP), a.buffers.stencil.setLocked(!0);
  }
}
class jt extends W {
  constructor() {
    super(), this.needsSwap = !1;
  }
  render(e) {
    e.state.buffers.stencil.setLocked(!1), e.state.buffers.stencil.setTest(!1);
  }
}
class Gt {
  constructor(e, t) {
    if (this.renderer = e, this._pixelRatio = e.getPixelRatio(), t === void 0) {
      const s = e.getSize(new A());
      this._width = s.width, this._height = s.height, t = new Y(this._width * this._pixelRatio, this._height * this._pixelRatio, { type: q }), t.texture.name = "EffectComposer.rt1";
    } else
      this._width = t.width, this._height = t.height;
    this.renderTarget1 = t, this.renderTarget2 = t.clone(), this.renderTarget2.texture.name = "EffectComposer.rt2", this.writeBuffer = this.renderTarget1, this.readBuffer = this.renderTarget2, this.renderToScreen = !0, this.passes = [], this.copyPass = new it(me), this.copyPass.material.blending = K, this.clock = new mt();
  }
  swapBuffers() {
    const e = this.readBuffer;
    this.readBuffer = this.writeBuffer, this.writeBuffer = e;
  }
  addPass(e) {
    this.passes.push(e), e.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }
  insertPass(e, t) {
    this.passes.splice(t, 0, e), e.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }
  removePass(e) {
    const t = this.passes.indexOf(e);
    t !== -1 && this.passes.splice(t, 1);
  }
  isLastEnabledPass(e) {
    for (let t = e + 1; t < this.passes.length; t++)
      if (this.passes[t].enabled)
        return !1;
    return !0;
  }
  render(e) {
    e === void 0 && (e = this.clock.getDelta());
    const t = this.renderer.getRenderTarget();
    let s = !1;
    for (let i = 0, a = this.passes.length; i < a; i++) {
      const r = this.passes[i];
      if (r.enabled !== !1) {
        if (r.renderToScreen = this.renderToScreen && this.isLastEnabledPass(i), r.render(this.renderer, this.writeBuffer, this.readBuffer, e, s), r.needsSwap) {
          if (s) {
            const o = this.renderer.getContext(), u = this.renderer.state.buffers.stencil;
            u.setFunc(o.NOTEQUAL, 1, 4294967295), this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, e), u.setFunc(o.EQUAL, 1, 4294967295);
          }
          this.swapBuffers();
        }
        et !== void 0 && (r instanceof et ? s = !0 : r instanceof jt && (s = !1));
      }
    }
    this.renderer.setRenderTarget(t);
  }
  reset(e) {
    if (e === void 0) {
      const t = this.renderer.getSize(new A());
      this._pixelRatio = this.renderer.getPixelRatio(), this._width = t.width, this._height = t.height, e = this.renderTarget1.clone(), e.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
    }
    this.renderTarget1.dispose(), this.renderTarget2.dispose(), this.renderTarget1 = e, this.renderTarget2 = e.clone(), this.writeBuffer = this.renderTarget1, this.readBuffer = this.renderTarget2;
  }
  setSize(e, t) {
    this._width = e, this._height = t;
    const s = this._width * this._pixelRatio, i = this._height * this._pixelRatio;
    this.renderTarget1.setSize(s, i), this.renderTarget2.setSize(s, i);
    for (let a = 0; a < this.passes.length; a++)
      this.passes[a].setSize(s, i);
  }
  setPixelRatio(e) {
    this._pixelRatio = e, this.setSize(this._width, this._height);
  }
  dispose() {
    this.renderTarget1.dispose(), this.renderTarget2.dispose(), this.copyPass.dispose();
  }
}
class Lt extends W {
  constructor(e, t, s = null, i = null, a = null) {
    super(), this.scene = e, this.camera = t, this.overrideMaterial = s, this.clearColor = i, this.clearAlpha = a, this.clear = !0, this.clearDepth = !1, this.needsSwap = !1, this._oldClearColor = new ge();
  }
  render(e, t, s) {
    const i = e.autoClear;
    e.autoClear = !1;
    let a, r;
    this.overrideMaterial !== null && (r = this.scene.overrideMaterial, this.scene.overrideMaterial = this.overrideMaterial), this.clearColor !== null && (e.getClearColor(this._oldClearColor), e.setClearColor(this.clearColor, e.getClearAlpha())), this.clearAlpha !== null && (a = e.getClearAlpha(), e.setClearAlpha(this.clearAlpha)), this.clearDepth == !0 && e.clearDepth(), e.setRenderTarget(this.renderToScreen ? null : s), this.clear === !0 && e.clear(e.autoClearColor, e.autoClearDepth, e.autoClearStencil), e.render(this.scene, this.camera), this.clearColor !== null && e.setClearColor(this._oldClearColor), this.clearAlpha !== null && e.setClearAlpha(a), this.overrideMaterial !== null && (this.scene.overrideMaterial = r), e.autoClear = i;
  }
}
const Qt = {
  uniforms: {
    tDiffuse: { value: null },
    luminosityThreshold: { value: 1 },
    smoothWidth: { value: 1 },
    defaultColor: { value: new ge(0) },
    defaultOpacity: { value: 0 }
  },
  vertexShader: (
    /* glsl */
    `

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`
  )
};
class J extends W {
  constructor(e, t, s, i) {
    super(), this.strength = t !== void 0 ? t : 1, this.radius = s, this.threshold = i, this.resolution = e !== void 0 ? new A(e.x, e.y) : new A(256, 256), this.clearColor = new ge(0, 0, 0), this.renderTargetsHorizontal = [], this.renderTargetsVertical = [], this.nMips = 5;
    let a = Math.round(this.resolution.x / 2), r = Math.round(this.resolution.y / 2);
    this.renderTargetBright = new Y(a, r, { type: q }), this.renderTargetBright.texture.name = "UnrealBloomPass.bright", this.renderTargetBright.texture.generateMipmaps = !1;
    for (let d = 0; d < this.nMips; d++) {
      const D = new Y(a, r, { type: q });
      D.texture.name = "UnrealBloomPass.h" + d, D.texture.generateMipmaps = !1, this.renderTargetsHorizontal.push(D);
      const m = new Y(a, r, { type: q });
      m.texture.name = "UnrealBloomPass.v" + d, m.texture.generateMipmaps = !1, this.renderTargetsVertical.push(m), a = Math.round(a / 2), r = Math.round(r / 2);
    }
    const o = Qt;
    this.highPassUniforms = G.clone(o.uniforms), this.highPassUniforms.luminosityThreshold.value = i, this.highPassUniforms.smoothWidth.value = 0.01, this.materialHighPassFilter = new B({
      uniforms: this.highPassUniforms,
      vertexShader: o.vertexShader,
      fragmentShader: o.fragmentShader
    }), this.separableBlurMaterials = [];
    const u = [3, 5, 7, 9, 11];
    a = Math.round(this.resolution.x / 2), r = Math.round(this.resolution.y / 2);
    for (let d = 0; d < this.nMips; d++)
      this.separableBlurMaterials.push(this.getSeperableBlurMaterial(u[d])), this.separableBlurMaterials[d].uniforms.invSize.value = new A(1 / a, 1 / r), a = Math.round(a / 2), r = Math.round(r / 2);
    this.compositeMaterial = this.getCompositeMaterial(this.nMips), this.compositeMaterial.uniforms.blurTexture1.value = this.renderTargetsVertical[0].texture, this.compositeMaterial.uniforms.blurTexture2.value = this.renderTargetsVertical[1].texture, this.compositeMaterial.uniforms.blurTexture3.value = this.renderTargetsVertical[2].texture, this.compositeMaterial.uniforms.blurTexture4.value = this.renderTargetsVertical[3].texture, this.compositeMaterial.uniforms.blurTexture5.value = this.renderTargetsVertical[4].texture, this.compositeMaterial.uniforms.bloomStrength.value = t, this.compositeMaterial.uniforms.bloomRadius.value = 0.1;
    const l = [1, 0.8, 0.6, 0.4, 0.2];
    this.compositeMaterial.uniforms.bloomFactors.value = l, this.bloomTintColors = [new X(1, 1, 1), new X(1, 1, 1), new X(1, 1, 1), new X(1, 1, 1), new X(1, 1, 1)], this.compositeMaterial.uniforms.bloomTintColors.value = this.bloomTintColors;
    const b = me;
    this.copyUniforms = G.clone(b.uniforms), this.blendMaterial = new B({
      uniforms: this.copyUniforms,
      vertexShader: b.vertexShader,
      fragmentShader: b.fragmentShader,
      blending: gt,
      depthTest: !1,
      depthWrite: !1,
      transparent: !0
    }), this.enabled = !0, this.needsSwap = !1, this._oldClearColor = new ge(), this.oldClearAlpha = 1, this.basic = new vt(), this.fsQuad = new Re(null);
  }
  dispose() {
    for (let e = 0; e < this.renderTargetsHorizontal.length; e++)
      this.renderTargetsHorizontal[e].dispose();
    for (let e = 0; e < this.renderTargetsVertical.length; e++)
      this.renderTargetsVertical[e].dispose();
    this.renderTargetBright.dispose();
    for (let e = 0; e < this.separableBlurMaterials.length; e++)
      this.separableBlurMaterials[e].dispose();
    this.compositeMaterial.dispose(), this.blendMaterial.dispose(), this.basic.dispose(), this.fsQuad.dispose();
  }
  setSize(e, t) {
    let s = Math.round(e / 2), i = Math.round(t / 2);
    this.renderTargetBright.setSize(s, i);
    for (let a = 0; a < this.nMips; a++)
      this.renderTargetsHorizontal[a].setSize(s, i), this.renderTargetsVertical[a].setSize(s, i), this.separableBlurMaterials[a].uniforms.invSize.value = new A(1 / s, 1 / i), s = Math.round(s / 2), i = Math.round(i / 2);
  }
  render(e, t, s, i, a) {
    e.getClearColor(this._oldClearColor), this.oldClearAlpha = e.getClearAlpha();
    const r = e.autoClear;
    e.autoClear = !1, e.setClearColor(this.clearColor, 0), a && e.state.buffers.stencil.setTest(!1), this.renderToScreen && (this.fsQuad.material = this.basic, this.basic.map = s.texture, e.setRenderTarget(null), e.clear(), this.fsQuad.render(e)), this.highPassUniforms.tDiffuse.value = s.texture, this.highPassUniforms.luminosityThreshold.value = this.threshold, this.fsQuad.material = this.materialHighPassFilter, e.setRenderTarget(this.renderTargetBright), e.clear(), this.fsQuad.render(e);
    let o = this.renderTargetBright;
    for (let u = 0; u < this.nMips; u++)
      this.fsQuad.material = this.separableBlurMaterials[u], this.separableBlurMaterials[u].uniforms.colorTexture.value = o.texture, this.separableBlurMaterials[u].uniforms.direction.value = J.BlurDirectionX, e.setRenderTarget(this.renderTargetsHorizontal[u]), e.clear(), this.fsQuad.render(e), this.separableBlurMaterials[u].uniforms.colorTexture.value = this.renderTargetsHorizontal[u].texture, this.separableBlurMaterials[u].uniforms.direction.value = J.BlurDirectionY, e.setRenderTarget(this.renderTargetsVertical[u]), e.clear(), this.fsQuad.render(e), o = this.renderTargetsVertical[u];
    this.fsQuad.material = this.compositeMaterial, this.compositeMaterial.uniforms.bloomStrength.value = this.strength, this.compositeMaterial.uniforms.bloomRadius.value = this.radius, this.compositeMaterial.uniforms.bloomTintColors.value = this.bloomTintColors, e.setRenderTarget(this.renderTargetsHorizontal[0]), e.clear(), this.fsQuad.render(e), this.fsQuad.material = this.blendMaterial, this.copyUniforms.tDiffuse.value = this.renderTargetsHorizontal[0].texture, a && e.state.buffers.stencil.setTest(!0), this.renderToScreen ? (e.setRenderTarget(null), this.fsQuad.render(e)) : (e.setRenderTarget(s), this.fsQuad.render(e)), e.setClearColor(this._oldClearColor, this.oldClearAlpha), e.autoClear = r;
  }
  getSeperableBlurMaterial(e) {
    const t = [];
    for (let s = 0; s < e; s++)
      t.push(0.39894 * Math.exp(-0.5 * s * s / (e * e)) / e);
    return new B({
      defines: {
        KERNEL_RADIUS: e
      },
      uniforms: {
        colorTexture: { value: null },
        invSize: { value: new A(0.5, 0.5) },
        // inverse texture size
        direction: { value: new A(0.5, 0.5) },
        gaussianCoefficients: { value: t }
        // precomputed Gaussian coefficients
      },
      vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
      fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`
    });
  }
  getCompositeMaterial(e) {
    return new B({
      defines: {
        NUM_MIPS: e
      },
      uniforms: {
        blurTexture1: { value: null },
        blurTexture2: { value: null },
        blurTexture3: { value: null },
        blurTexture4: { value: null },
        blurTexture5: { value: null },
        bloomStrength: { value: 1 },
        bloomFactors: { value: null },
        bloomTintColors: { value: null },
        bloomRadius: { value: 0 }
      },
      vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
      fragmentShader: `varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`
    });
  }
}
J.BlurDirectionX = new A(1, 0);
J.BlurDirectionY = new A(0, 1);
const Zt = {
  name: "OutputShader",
  uniforms: {
    tDiffuse: { value: null },
    toneMappingExposure: { value: 1 }
  },
  vertexShader: (
    /* glsl */
    `
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `
	
		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`
  )
};
class Ht extends W {
  constructor() {
    super();
    const e = Zt;
    this.uniforms = G.clone(e.uniforms), this.material = new xt({
      name: e.name,
      uniforms: this.uniforms,
      vertexShader: e.vertexShader,
      fragmentShader: e.fragmentShader
    }), this.fsQuad = new Re(this.material), this._outputColorSpace = null, this._toneMapping = null;
  }
  render(e, t, s) {
    this.uniforms.tDiffuse.value = s.texture, this.uniforms.toneMappingExposure.value = e.toneMappingExposure, (this._outputColorSpace !== e.outputColorSpace || this._toneMapping !== e.toneMapping) && (this._outputColorSpace = e.outputColorSpace, this._toneMapping = e.toneMapping, this.material.defines = {}, bt.getTransfer(this._outputColorSpace) === Mt && (this.material.defines.SRGB_TRANSFER = ""), this._toneMapping === Tt ? this.material.defines.LINEAR_TONE_MAPPING = "" : this._toneMapping === St ? this.material.defines.REINHARD_TONE_MAPPING = "" : this._toneMapping === Ct ? this.material.defines.CINEON_TONE_MAPPING = "" : this._toneMapping === wt ? this.material.defines.ACES_FILMIC_TONE_MAPPING = "" : this._toneMapping === Pt ? this.material.defines.AGX_TONE_MAPPING = "" : this._toneMapping === _t && (this.material.defines.NEUTRAL_TONE_MAPPING = ""), this.material.needsUpdate = !0), this.renderToScreen === !0 ? (e.setRenderTarget(null), this.fsQuad.render(e)) : (e.setRenderTarget(t), this.clear && e.clear(e.autoClearColor, e.autoClearDepth, e.autoClearStencil), this.fsQuad.render(e));
  }
  dispose() {
    this.material.dispose(), this.fsQuad.dispose();
  }
}
class Kt {
  constructor(e = Math) {
    this.grad3 = [
      [1, 1, 0],
      [-1, 1, 0],
      [1, -1, 0],
      [-1, -1, 0],
      [1, 0, 1],
      [-1, 0, 1],
      [1, 0, -1],
      [-1, 0, -1],
      [0, 1, 1],
      [0, -1, 1],
      [0, 1, -1],
      [0, -1, -1]
    ], this.grad4 = [
      [0, 1, 1, 1],
      [0, 1, 1, -1],
      [0, 1, -1, 1],
      [0, 1, -1, -1],
      [0, -1, 1, 1],
      [0, -1, 1, -1],
      [0, -1, -1, 1],
      [0, -1, -1, -1],
      [1, 0, 1, 1],
      [1, 0, 1, -1],
      [1, 0, -1, 1],
      [1, 0, -1, -1],
      [-1, 0, 1, 1],
      [-1, 0, 1, -1],
      [-1, 0, -1, 1],
      [-1, 0, -1, -1],
      [1, 1, 0, 1],
      [1, 1, 0, -1],
      [1, -1, 0, 1],
      [1, -1, 0, -1],
      [-1, 1, 0, 1],
      [-1, 1, 0, -1],
      [-1, -1, 0, 1],
      [-1, -1, 0, -1],
      [1, 1, 1, 0],
      [1, 1, -1, 0],
      [1, -1, 1, 0],
      [1, -1, -1, 0],
      [-1, 1, 1, 0],
      [-1, 1, -1, 0],
      [-1, -1, 1, 0],
      [-1, -1, -1, 0]
    ], this.p = [];
    for (let t = 0; t < 256; t++)
      this.p[t] = Math.floor(e.random() * 256);
    this.perm = [];
    for (let t = 0; t < 512; t++)
      this.perm[t] = this.p[t & 255];
    this.simplex = [
      [0, 1, 2, 3],
      [0, 1, 3, 2],
      [0, 0, 0, 0],
      [0, 2, 3, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 2, 3, 0],
      [0, 2, 1, 3],
      [0, 0, 0, 0],
      [0, 3, 1, 2],
      [0, 3, 2, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 3, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 2, 0, 3],
      [0, 0, 0, 0],
      [1, 3, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 3, 0, 1],
      [2, 3, 1, 0],
      [1, 0, 2, 3],
      [1, 0, 3, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 3, 1],
      [0, 0, 0, 0],
      [2, 1, 3, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 1, 3],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [3, 0, 1, 2],
      [3, 0, 2, 1],
      [0, 0, 0, 0],
      [3, 1, 2, 0],
      [2, 1, 0, 3],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [3, 1, 0, 2],
      [0, 0, 0, 0],
      [3, 2, 0, 1],
      [3, 2, 1, 0]
    ];
  }
  dot(e, t, s) {
    return e[0] * t + e[1] * s;
  }
  dot3(e, t, s, i) {
    return e[0] * t + e[1] * s + e[2] * i;
  }
  dot4(e, t, s, i, a) {
    return e[0] * t + e[1] * s + e[2] * i + e[3] * a;
  }
  noise(e, t) {
    let s, i, a;
    const r = 0.5 * (Math.sqrt(3) - 1), o = (e + t) * r, u = Math.floor(e + o), l = Math.floor(t + o), b = (3 - Math.sqrt(3)) / 6, d = (u + l) * b, D = u - d, m = l - d, w = e - D, y = t - m;
    let U, F;
    w > y ? (U = 1, F = 0) : (U = 0, F = 1);
    const M = w - U + b, T = y - F + b, x = w - 1 + 2 * b, P = y - 1 + 2 * b, _ = u & 255, R = l & 255, E = this.perm[_ + this.perm[R]] % 12, c = this.perm[_ + U + this.perm[R + F]] % 12, f = this.perm[_ + 1 + this.perm[R + 1]] % 12;
    let g = 0.5 - w * w - y * y;
    g < 0 ? s = 0 : (g *= g, s = g * g * this.dot(this.grad3[E], w, y));
    let v = 0.5 - M * M - T * T;
    v < 0 ? i = 0 : (v *= v, i = v * v * this.dot(this.grad3[c], M, T));
    let N = 0.5 - x * x - P * P;
    return N < 0 ? a = 0 : (N *= N, a = N * N * this.dot(this.grad3[f], x, P)), 70 * (s + i + a);
  }
  // 3D simplex noise
  noise3d(e, t, s) {
    let i, a, r, o;
    const l = (e + t + s) * 0.3333333333333333, b = Math.floor(e + l), d = Math.floor(t + l), D = Math.floor(s + l), m = 1 / 6, w = (b + d + D) * m, y = b - w, U = d - w, F = D - w, M = e - y, T = t - U, x = s - F;
    let P, _, R, E, c, f;
    M >= T ? T >= x ? (P = 1, _ = 0, R = 0, E = 1, c = 1, f = 0) : M >= x ? (P = 1, _ = 0, R = 0, E = 1, c = 0, f = 1) : (P = 0, _ = 0, R = 1, E = 1, c = 0, f = 1) : T < x ? (P = 0, _ = 0, R = 1, E = 0, c = 1, f = 1) : M < x ? (P = 0, _ = 1, R = 0, E = 0, c = 1, f = 1) : (P = 0, _ = 1, R = 0, E = 1, c = 1, f = 0);
    const g = M - P + m, v = T - _ + m, N = x - R + m, $ = M - E + 2 * m, ee = T - c + 2 * m, te = x - f + 2 * m, se = M - 1 + 3 * m, ie = T - 1 + 3 * m, S = x - 1 + 3 * m, Q = b & 255, Z = d & 255, H = D & 255, be = this.perm[Q + this.perm[Z + this.perm[H]]] % 12, Me = this.perm[Q + P + this.perm[Z + _ + this.perm[H + R]]] % 12, Te = this.perm[Q + E + this.perm[Z + c + this.perm[H + f]]] % 12, Se = this.perm[Q + 1 + this.perm[Z + 1 + this.perm[H + 1]]] % 12;
    let V = 0.6 - M * M - T * T - x * x;
    V < 0 ? i = 0 : (V *= V, i = V * V * this.dot3(this.grad3[be], M, T, x));
    let k = 0.6 - g * g - v * v - N * N;
    k < 0 ? a = 0 : (k *= k, a = k * k * this.dot3(this.grad3[Me], g, v, N));
    let O = 0.6 - $ * $ - ee * ee - te * te;
    O < 0 ? r = 0 : (O *= O, r = O * O * this.dot3(this.grad3[Te], $, ee, te));
    let I = 0.6 - se * se - ie * ie - S * S;
    return I < 0 ? o = 0 : (I *= I, o = I * I * this.dot3(this.grad3[Se], se, ie, S)), 32 * (i + a + r + o);
  }
  // 4D simplex noise
  noise4d(e, t, s, i) {
    const a = this.grad4, r = this.simplex, o = this.perm, u = (Math.sqrt(5) - 1) / 4, l = (5 - Math.sqrt(5)) / 20;
    let b, d, D, m, w;
    const y = (e + t + s + i) * u, U = Math.floor(e + y), F = Math.floor(t + y), M = Math.floor(s + y), T = Math.floor(i + y), x = (U + F + M + T) * l, P = U - x, _ = F - x, R = M - x, E = T - x, c = e - P, f = t - _, g = s - R, v = i - E, N = c > f ? 32 : 0, $ = c > g ? 16 : 0, ee = f > g ? 8 : 0, te = c > v ? 4 : 0, se = f > v ? 2 : 0, ie = g > v ? 1 : 0, S = N + $ + ee + te + se + ie, Q = r[S][0] >= 3 ? 1 : 0, Z = r[S][1] >= 3 ? 1 : 0, H = r[S][2] >= 3 ? 1 : 0, be = r[S][3] >= 3 ? 1 : 0, Me = r[S][0] >= 2 ? 1 : 0, Te = r[S][1] >= 2 ? 1 : 0, Se = r[S][2] >= 2 ? 1 : 0, V = r[S][3] >= 2 ? 1 : 0, k = r[S][0] >= 1 ? 1 : 0, O = r[S][1] >= 1 ? 1 : 0, I = r[S][2] >= 1 ? 1 : 0, Ke = r[S][3] >= 1 ? 1 : 0, Ee = c - Q + l, Ae = f - Z + l, Ne = g - H + l, Ue = v - be + l, Fe = c - Me + 2 * l, Be = f - Te + 2 * l, ze = g - Se + 2 * l, Ve = v - V + 2 * l, ke = c - k + 3 * l, Oe = f - O + 3 * l, Ie = g - I + 3 * l, je = v - Ke + 3 * l, Ge = c - 1 + 4 * l, Le = f - 1 + 4 * l, Qe = g - 1 + 4 * l, Ze = v - 1 + 4 * l, ae = U & 255, re = F & 255, oe = M & 255, ne = T & 255, rt = o[ae + o[re + o[oe + o[ne]]]] % 32, ot = o[ae + Q + o[re + Z + o[oe + H + o[ne + be]]]] % 32, nt = o[ae + Me + o[re + Te + o[oe + Se + o[ne + V]]]] % 32, lt = o[ae + k + o[re + O + o[oe + I + o[ne + Ke]]]] % 32, ht = o[ae + 1 + o[re + 1 + o[oe + 1 + o[ne + 1]]]] % 32;
    let le = 0.6 - c * c - f * f - g * g - v * v;
    le < 0 ? b = 0 : (le *= le, b = le * le * this.dot4(a[rt], c, f, g, v));
    let he = 0.6 - Ee * Ee - Ae * Ae - Ne * Ne - Ue * Ue;
    he < 0 ? d = 0 : (he *= he, d = he * he * this.dot4(a[ot], Ee, Ae, Ne, Ue));
    let ue = 0.6 - Fe * Fe - Be * Be - ze * ze - Ve * Ve;
    ue < 0 ? D = 0 : (ue *= ue, D = ue * ue * this.dot4(a[nt], Fe, Be, ze, Ve));
    let ce = 0.6 - ke * ke - Oe * Oe - Ie * Ie - je * je;
    ce < 0 ? m = 0 : (ce *= ce, m = ce * ce * this.dot4(a[lt], ke, Oe, Ie, je));
    let fe = 0.6 - Ge * Ge - Le * Le - Qe * Qe - Ze * Ze;
    return fe < 0 ? w = 0 : (fe *= fe, w = fe * fe * this.dot4(a[ht], Ge, Le, Qe, Ze)), 27 * (b + d + D + m + w);
  }
}
const Ce = {
  defines: {
    PERSPECTIVE_CAMERA: 1,
    KERNEL_SIZE: 32
  },
  uniforms: {
    tNormal: { value: null },
    tDepth: { value: null },
    tNoise: { value: null },
    kernel: { value: null },
    cameraNear: { value: null },
    cameraFar: { value: null },
    resolution: { value: new A() },
    cameraProjectionMatrix: { value: new Xe() },
    cameraInverseProjectionMatrix: { value: new Xe() },
    kernelRadius: { value: 8 },
    minDistance: { value: 5e-3 },
    maxDistance: { value: 0.05 }
  },
  vertexShader: (
    /* glsl */
    `

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;

		uniform vec3 kernel[ KERNEL_SIZE ];

		uniform vec2 resolution;

		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraInverseProjectionMatrix;

		uniform float kernelRadius;
		uniform float minDistance; // avoid artifacts caused by neighbour fragments with minimal depth difference
		uniform float maxDistance; // avoid the influence of fragments which are too far away

		varying vec2 vUv;

		#include <packing>

		float getDepth( const in vec2 screenPosition ) {

			return texture2D( tDepth, screenPosition ).x;

		}

		float getLinearDepth( const in vec2 screenPosition ) {

			#if PERSPECTIVE_CAMERA == 1

				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );

			#else

				return texture2D( tDepth, screenPosition ).x;

			#endif

		}

		float getViewZ( const in float depth ) {

			#if PERSPECTIVE_CAMERA == 1

				return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );

			#else

				return orthographicDepthToViewZ( depth, cameraNear, cameraFar );

			#endif

		}

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {

			float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];

			vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );

			clipPosition *= clipW; // unprojection.

			return ( cameraInverseProjectionMatrix * clipPosition ).xyz;

		}

		vec3 getViewNormal( const in vec2 screenPosition ) {

			return unpackRGBToNormal( texture2D( tNormal, screenPosition ).xyz );

		}

		void main() {

			float depth = getDepth( vUv );

			if ( depth == 1.0 ) {

				gl_FragColor = vec4( 1.0 ); // don't influence background
				
			} else {

				float viewZ = getViewZ( depth );

				vec3 viewPosition = getViewPosition( vUv, depth, viewZ );
				vec3 viewNormal = getViewNormal( vUv );

				vec2 noiseScale = vec2( resolution.x / 4.0, resolution.y / 4.0 );
				vec3 random = vec3( texture2D( tNoise, vUv * noiseScale ).r );

				// compute matrix used to reorient a kernel vector

				vec3 tangent = normalize( random - viewNormal * dot( random, viewNormal ) );
				vec3 bitangent = cross( viewNormal, tangent );
				mat3 kernelMatrix = mat3( tangent, bitangent, viewNormal );

				float occlusion = 0.0;

				for ( int i = 0; i < KERNEL_SIZE; i ++ ) {

					vec3 sampleVector = kernelMatrix * kernel[ i ]; // reorient sample vector in view space
					vec3 samplePoint = viewPosition + ( sampleVector * kernelRadius ); // calculate sample point

					vec4 samplePointNDC = cameraProjectionMatrix * vec4( samplePoint, 1.0 ); // project point and calculate NDC
					samplePointNDC /= samplePointNDC.w;

					vec2 samplePointUv = samplePointNDC.xy * 0.5 + 0.5; // compute uv coordinates

					float realDepth = getLinearDepth( samplePointUv ); // get linear depth from depth texture
					float sampleDepth = viewZToOrthographicDepth( samplePoint.z, cameraNear, cameraFar ); // compute linear depth of the sample view Z value
					float delta = sampleDepth - realDepth;

					if ( delta > minDistance && delta < maxDistance ) { // if fragment is before sample point, increase occlusion

						occlusion += 1.0;

					}

				}

				occlusion = clamp( occlusion / float( KERNEL_SIZE ), 0.0, 1.0 );

				gl_FragColor = vec4( vec3( 1.0 - occlusion ), 1.0 );

			}

		}`
  )
}, we = {
  defines: {
    PERSPECTIVE_CAMERA: 1
  },
  uniforms: {
    tDepth: { value: null },
    cameraNear: { value: null },
    cameraFar: { value: null }
  },
  vertexShader: `varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
  fragmentShader: `uniform sampler2D tDepth;

		uniform float cameraNear;
		uniform float cameraFar;

		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {

			#if PERSPECTIVE_CAMERA == 1

				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );

			#else

				return texture2D( tDepth, screenPosition ).x;

			#endif

		}

		void main() {

			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`
}, Pe = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new A() }
  },
  vertexShader: `varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
  fragmentShader: `uniform sampler2D tDiffuse;

		uniform vec2 resolution;

		varying vec2 vUv;

		void main() {

			vec2 texelSize = ( 1.0 / resolution );
			float result = 0.0;

			for ( int i = - 2; i <= 2; i ++ ) {

				for ( int j = - 2; j <= 2; j ++ ) {

					vec2 offset = ( vec2( float( i ), float( j ) ) ) * texelSize;
					result += texture2D( tDiffuse, vUv + offset ).r;

				}

			}

			gl_FragColor = vec4( vec3( result / ( 5.0 * 5.0 ) ), 1.0 );

		}`
};
class j extends W {
  constructor(e, t, s, i, a = 32) {
    super(), this.width = s !== void 0 ? s : 512, this.height = i !== void 0 ? i : 512, this.clear = !0, this.needsSwap = !1, this.camera = t, this.scene = e, this.kernelRadius = 8, this.kernel = [], this.noiseTexture = null, this.output = 0, this.minDistance = 5e-3, this.maxDistance = 0.1, this._visibilityCache = /* @__PURE__ */ new Map(), this.generateSampleKernel(a), this.generateRandomKernelRotations();
    const r = new Rt();
    r.format = Dt, r.type = yt, this.normalRenderTarget = new Y(this.width, this.height, {
      minFilter: Ye,
      magFilter: Ye,
      type: q,
      depthTexture: r
    }), this.ssaoRenderTarget = new Y(this.width, this.height, { type: q }), this.blurRenderTarget = this.ssaoRenderTarget.clone(), this.ssaoMaterial = new B({
      defines: Object.assign({}, Ce.defines),
      uniforms: G.clone(Ce.uniforms),
      vertexShader: Ce.vertexShader,
      fragmentShader: Ce.fragmentShader,
      blending: K
    }), this.ssaoMaterial.defines.KERNEL_SIZE = a, this.ssaoMaterial.uniforms.tNormal.value = this.normalRenderTarget.texture, this.ssaoMaterial.uniforms.tDepth.value = this.normalRenderTarget.depthTexture, this.ssaoMaterial.uniforms.tNoise.value = this.noiseTexture, this.ssaoMaterial.uniforms.kernel.value = this.kernel, this.ssaoMaterial.uniforms.cameraNear.value = this.camera.near, this.ssaoMaterial.uniforms.cameraFar.value = this.camera.far, this.ssaoMaterial.uniforms.resolution.value.set(this.width, this.height), this.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix), this.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse), this.normalMaterial = new Et(), this.normalMaterial.blending = K, this.blurMaterial = new B({
      defines: Object.assign({}, Pe.defines),
      uniforms: G.clone(Pe.uniforms),
      vertexShader: Pe.vertexShader,
      fragmentShader: Pe.fragmentShader
    }), this.blurMaterial.uniforms.tDiffuse.value = this.ssaoRenderTarget.texture, this.blurMaterial.uniforms.resolution.value.set(this.width, this.height), this.depthRenderMaterial = new B({
      defines: Object.assign({}, we.defines),
      uniforms: G.clone(we.uniforms),
      vertexShader: we.vertexShader,
      fragmentShader: we.fragmentShader,
      blending: K
    }), this.depthRenderMaterial.uniforms.tDepth.value = this.normalRenderTarget.depthTexture, this.depthRenderMaterial.uniforms.cameraNear.value = this.camera.near, this.depthRenderMaterial.uniforms.cameraFar.value = this.camera.far, this.copyMaterial = new B({
      uniforms: G.clone(me.uniforms),
      vertexShader: me.vertexShader,
      fragmentShader: me.fragmentShader,
      transparent: !0,
      depthTest: !1,
      depthWrite: !1,
      blendSrc: Nt,
      blendDst: Je,
      blendEquation: qe,
      blendSrcAlpha: At,
      blendDstAlpha: Je,
      blendEquationAlpha: qe
    }), this.fsQuad = new Re(null), this.originalClearColor = new ge();
  }
  dispose() {
    this.normalRenderTarget.dispose(), this.ssaoRenderTarget.dispose(), this.blurRenderTarget.dispose(), this.normalMaterial.dispose(), this.blurMaterial.dispose(), this.copyMaterial.dispose(), this.depthRenderMaterial.dispose(), this.fsQuad.dispose();
  }
  render(e, t, s) {
    switch (this.overrideVisibility(), this.renderOverride(e, this.normalMaterial, this.normalRenderTarget, 7829503, 1), this.restoreVisibility(), this.ssaoMaterial.uniforms.kernelRadius.value = this.kernelRadius, this.ssaoMaterial.uniforms.minDistance.value = this.minDistance, this.ssaoMaterial.uniforms.maxDistance.value = this.maxDistance, this.renderPass(e, this.ssaoMaterial, this.ssaoRenderTarget), this.renderPass(e, this.blurMaterial, this.blurRenderTarget), this.output) {
      case j.OUTPUT.SSAO:
        this.copyMaterial.uniforms.tDiffuse.value = this.ssaoRenderTarget.texture, this.copyMaterial.blending = K, this.renderPass(e, this.copyMaterial, this.renderToScreen ? null : s);
        break;
      case j.OUTPUT.Blur:
        this.copyMaterial.uniforms.tDiffuse.value = this.blurRenderTarget.texture, this.copyMaterial.blending = K, this.renderPass(e, this.copyMaterial, this.renderToScreen ? null : s);
        break;
      case j.OUTPUT.Depth:
        this.renderPass(e, this.depthRenderMaterial, this.renderToScreen ? null : s);
        break;
      case j.OUTPUT.Normal:
        this.copyMaterial.uniforms.tDiffuse.value = this.normalRenderTarget.texture, this.copyMaterial.blending = K, this.renderPass(e, this.copyMaterial, this.renderToScreen ? null : s);
        break;
      case j.OUTPUT.Default:
        this.copyMaterial.uniforms.tDiffuse.value = this.blurRenderTarget.texture, this.copyMaterial.blending = Ut, this.renderPass(e, this.copyMaterial, this.renderToScreen ? null : s);
        break;
      default:
        console.warn("THREE.SSAOPass: Unknown output type.");
    }
  }
  renderPass(e, t, s, i, a) {
    e.getClearColor(this.originalClearColor);
    const r = e.getClearAlpha(), o = e.autoClear;
    e.setRenderTarget(s), e.autoClear = !1, i != null && (e.setClearColor(i), e.setClearAlpha(a || 0), e.clear()), this.fsQuad.material = t, this.fsQuad.render(e), e.autoClear = o, e.setClearColor(this.originalClearColor), e.setClearAlpha(r);
  }
  renderOverride(e, t, s, i, a) {
    e.getClearColor(this.originalClearColor);
    const r = e.getClearAlpha(), o = e.autoClear;
    e.setRenderTarget(s), e.autoClear = !1, i = t.clearColor || i, a = t.clearAlpha || a, i != null && (e.setClearColor(i), e.setClearAlpha(a || 0), e.clear()), this.scene.overrideMaterial = t, e.render(this.scene, this.camera), this.scene.overrideMaterial = null, e.autoClear = o, e.setClearColor(this.originalClearColor), e.setClearAlpha(r);
  }
  setSize(e, t) {
    this.width = e, this.height = t, this.ssaoRenderTarget.setSize(e, t), this.normalRenderTarget.setSize(e, t), this.blurRenderTarget.setSize(e, t), this.ssaoMaterial.uniforms.resolution.value.set(e, t), this.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix), this.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse), this.blurMaterial.uniforms.resolution.value.set(e, t);
  }
  generateSampleKernel(e) {
    const t = this.kernel;
    for (let s = 0; s < e; s++) {
      const i = new X();
      i.x = Math.random() * 2 - 1, i.y = Math.random() * 2 - 1, i.z = Math.random(), i.normalize();
      let a = s / e;
      a = Ft.lerp(0.1, 1, a * a), i.multiplyScalar(a), t.push(i);
    }
  }
  generateRandomKernelRotations() {
    const s = new Kt(), i = 4 * 4, a = new Float32Array(i);
    for (let r = 0; r < i; r++) {
      const o = Math.random() * 2 - 1, u = Math.random() * 2 - 1, l = 0;
      a[r] = s.noise3d(o, u, l);
    }
    this.noiseTexture = new Bt(a, 4, 4, zt, Vt), this.noiseTexture.wrapS = $e, this.noiseTexture.wrapT = $e, this.noiseTexture.needsUpdate = !0;
  }
  overrideVisibility() {
    const e = this.scene, t = this._visibilityCache;
    e.traverse(function(s) {
      t.set(s, s.visible), (s.isPoints || s.isLine) && (s.visible = !1);
    });
  }
  restoreVisibility() {
    const e = this.scene, t = this._visibilityCache;
    e.traverse(function(s) {
      const i = t.get(s);
      s.visible = i;
    }), t.clear();
  }
}
j.OUTPUT = {
  Default: 0,
  SSAO: 1,
  Blur: 2,
  Depth: 3,
  Normal: 4
};
const h = {
  1945: {
    year: 1945,
    sepia: 0.55,
    saturation: 0.82,
    contrast: 1.05,
    brightness: 1,
    tint: [0.02, 0, -0.01],
    grain: 0.42,
    vignette: 0.38,
    bloomThreshold: 0.72,
    bloomStrength: 0.55,
    bloomRadius: 0.55,
    ssao: !1,
    label: "warm sepia"
  },
  1965: {
    year: 1965,
    sepia: 0.2,
    saturation: 1.28,
    contrast: 1.1,
    brightness: 1,
    tint: [0.01, 0, 0],
    grain: 0.28,
    vignette: 0.28,
    bloomThreshold: 0.55,
    bloomStrength: 0.95,
    bloomRadius: 0.7,
    ssao: !1,
    label: "saturated pop"
  },
  1985: {
    year: 1985,
    sepia: 0.04,
    saturation: 1.12,
    contrast: 1.12,
    brightness: 0.98,
    tint: [0.02, 0, 0.03],
    grain: 0.22,
    vignette: 0.3,
    bloomThreshold: 0.45,
    bloomStrength: 1.2,
    bloomRadius: 0.85,
    ssao: !1,
    label: "teal-magenta"
  },
  2005: {
    year: 2005,
    sepia: 0,
    saturation: 1,
    contrast: 1.04,
    brightness: 1,
    tint: [0, 0, 0],
    grain: 0.08,
    vignette: 0.16,
    bloomThreshold: 0.6,
    bloomStrength: 0.8,
    bloomRadius: 0.6,
    ssao: !1,
    label: "neutral"
  },
  2025: {
    year: 2025,
    sepia: 0,
    saturation: 1.05,
    contrast: 1.14,
    brightness: 1.06,
    tint: [0, 0, 0],
    grain: 0.02,
    vignette: 0.12,
    bloomThreshold: 0.5,
    bloomStrength: 1,
    bloomRadius: 0.7,
    ssao: !0,
    label: "crisp HDR"
  }
}, Wt = (
  /* glsl */
  `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
), Xt = (
  /* glsl */
  `
  uniform sampler2D tDiffuse;
  uniform float uSepia;
  uniform float uSaturation;
  uniform float uContrast;
  uniform float uBrightness;
  uniform vec3 uTint;
  uniform float uGrain;
  uniform float uVignette;
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    vec3 col = texel.rgb;

    // Color saturation.
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma), col, uSaturation);

    // Contrast around mid grey.
    col = (col - 0.5) * uContrast + 0.5;

    // Brightness (per-era exposure compensation).
    col *= uBrightness;

    // Warm sepia blend.
    vec3 sepia = vec3(
      dot(col, vec3(0.393, 0.769, 0.189)),
      dot(col, vec3(0.349, 0.686, 0.168)),
      dot(col, vec3(0.272, 0.534, 0.131))
    );
    col = mix(col, sepia, uSepia);

    // Teal-magenta push.
    col += uTint;

    // Animated film grain (spatial + temporal noise).
    float g = (noise2(vUv * uResolution * 0.32 + vec2(uTime * 1.7, uTime * 1.3)) - 0.5);
    col += g * uGrain;

    // Vignette.
    vec2 d = vUv - 0.5;
    float dist = length(d);
    col *= 1.0 - uVignette * smoothstep(0.3, 0.85, dist);

    gl_FragColor = vec4(col, texel.a);
  }
`
), Yt = {
  uniforms: {
    tDiffuse: { value: null },
    uSepia: { value: 0.55 },
    uSaturation: { value: 0.82 },
    uContrast: { value: 1.05 },
    uBrightness: { value: 1 },
    uTint: { value: new L.Vector3(0.02, 0, -0.01) },
    uGrain: { value: 0.42 },
    uVignette: { value: 0.38 },
    uTime: { value: 0 },
    uResolution: { value: new L.Vector2(1, 1) }
  },
  vertexShader: Wt,
  fragmentShader: Xt
};
class at {
  constructor() {
    C(this, "pass");
    C(this, "era", 1945);
    C(this, "from", h[1945]);
    C(this, "to", h[1945]);
    C(this, "time", 0);
    this.pass = new it(Yt), this.pass.enabled = !1;
  }
  get currentYear() {
    return this.era;
  }
  bootstrap() {
    this.pass.enabled = !0, this.applyBlend(1);
  }
  update(e, t, s) {
    this.time += s, e !== this.era && (this.from = this.to, this.to = h[e], this.era = e), this.applyBlend(t);
  }
  setSize(e, t) {
    this.pass.uniforms.uResolution.value.set(e, t);
  }
  dispose() {
    this.pass.enabled = !1, this.pass.dispose();
  }
  /** Lerp every grade uniform from `from` to `to` at eased `t`. */
  applyBlend(e) {
    const t = Math.max(0, Math.min(1, e)), s = this.pass.uniforms, i = this.from, a = this.to, r = (o, u) => o + (u - o) * t;
    s.uSepia.value = r(i.sepia, a.sepia), s.uSaturation.value = r(i.saturation, a.saturation), s.uContrast.value = r(i.contrast, a.contrast), s.uBrightness.value = r(i.brightness, a.brightness), s.uTint.value.set(
      r(i.tint[0], a.tint[0]),
      r(i.tint[1], a.tint[1]),
      r(i.tint[2], a.tint[2])
    ), s.uGrain.value = r(i.grain, a.grain), s.uVignette.value = r(i.vignette, a.vignette), s.uTime.value = this.time;
  }
}
class qt {
  constructor() {
    C(this, "grading", new at());
    C(this, "_composer");
    C(this, "renderPass");
    C(this, "bloomPass");
    C(this, "outputPass");
    C(this, "ssaoPass", null);
    C(this, "era", 1945);
    C(this, "width", 1);
    C(this, "height", 1);
    C(this, "disposed", !1);
  }
  get currentYear() {
    return this.era;
  }
  get composer() {
    if (!this._composer)
      throw new Error("PostPipeline: composer not bootstrapped yet");
    return this._composer;
  }
  bootstrap(e, t, s) {
    if (this._composer)
      return;
    const i = e.getSize(new L.Vector2());
    this.width = i.width, this.height = i.height, this._composer = new Gt(e), this._composer.setPixelRatio(
      Math.min(typeof window < "u" ? window.devicePixelRatio : 1, 2)
    ), this._composer.setSize(this.width, this.height), this.renderPass = new Lt(t, s), this._composer.addPass(this.renderPass), this.ssaoPass = new j(t, s, this.width, this.height), this.ssaoPass.enabled = !1, this.ssaoPass.kernelRadius = 8, this.ssaoPass.minDistance = 0.02, this.ssaoPass.maxDistance = 0.12, this._composer.addPass(this.ssaoPass), this.bloomPass = new J(
      new L.Vector2(this.width, this.height),
      h[this.era].bloomStrength,
      h[this.era].bloomRadius,
      h[this.era].bloomThreshold
    ), this._composer.addPass(this.bloomPass), this._composer.addPass(this.grading.pass), this.outputPass = new Ht(), this._composer.addPass(this.outputPass), this.grading.bootstrap();
  }
  setSize(e, t) {
    this.width = e, this.height = t, this._composer && (this._composer.setSize(e, t), this.bloomPass.setSize(e, t), this.ssaoPass && this.ssaoPass.setSize(e, t)), this.grading.setSize(e, t);
  }
  update(e, t, s) {
    if (this.disposed)
      return;
    if (!this._composer)
      throw new Error("PostPipeline: bootstrap() must be called before update()");
    this.era = e, this.ssaoPass && (this.ssaoPass.enabled = h[e].ssao);
    const i = h[e];
    this.bloomPass.strength = i.bloomStrength, this.bloomPass.radius = i.bloomRadius, this.bloomPass.threshold = i.bloomThreshold, this.grading.update(e, t, s), this._composer.render();
  }
  dispose() {
    this.disposed || (this.disposed = !0, this.grading.dispose(), this._composer && this._composer.dispose());
  }
}
const Jt = () => {
  const n = { r: 0, g: 0, b: 0, a: 1 }, e = {
    get(t, s) {
      return s === "getRenderTarget" ? () => null : s === "getClearColor" ? () => n : s === "getClearAlpha" ? () => 1 : s === "getSize" ? (i) => i.set(800, 600) : s === "getPixelRatio" ? () => 1 : s === "toneMapping" ? L.NoToneMapping : s === "toneMappingExposure" ? 1 : s === "outputColorSpace" ? L.SRGBColorSpace : s === "isWebGLRenderer" ? !0 : () => {
      };
    },
    set() {
      return !0;
    }
  };
  return new Proxy({}, e);
}, _e = [];
function p(n, e) {
  n || _e.push(e);
}
const De = [1945, 1965, 1985, 2005, 2025], pe = De.map((n) => h[n].sepia), de = De.map((n) => h[n].grain), tt = De.map((n) => h[n].saturation);
p(pe[0] > pe[1] && pe[1] > pe[4], "sepia should fall 1945 -> 2025");
p(pe[4] === 0, "2025 should have zero sepia (crisp HDR)");
p(de[0] > de[1] && de[1] > de[4], "grain should fall 1945 -> 2025");
p(de[4] <= 0.02, "2025 should have minimal grain");
p(tt[1] > tt[0], "1965 should be more saturated than 1945 (pop)");
p(h[1985].tint[2] > 0, "1985 should push magenta (teal-magenta)");
p(h[2025].ssao === !0, "2025 should enable SSAO-lite");
p(h[1945].ssao === !1, "1945 should not enable SSAO-lite");
p(h[1985].bloomThreshold < h[1945].bloomThreshold, "1985 neon should glow at a lower bloom threshold than 1945");
const $t = Jt(), es = new L.Scene(), ts = new L.PerspectiveCamera(60, 800 / 600, 0.1, 2e3), z = new qt();
z.bootstrap($t, es, ts);
const ve = z.composer.passes;
p(ve.length === 5, `expected 5 passes, got ${ve.length}`);
p(z.grading.pass.enabled === !0, "EraGrading pass should be enabled after bootstrap");
p(ve.includes(z.grading.pass), "EraGrading pass should be present exactly once in the chain");
p(z.currentYear === 1945, "pipeline should start at 1945");
const ss = ve.filter((n) => n === z.grading.pass).length;
p(ss === 1, "grading pass should appear exactly once");
const xe = new at();
xe.bootstrap();
xe.update(1985, 0.5, 0.016);
const ye = xe.pass.uniforms, He = ye.uSepia.value;
p(He > h[1985].sepia && He < h[1945].sepia, "mid-morph sepia should blend between eras");
p(Math.abs(He - (h[1945].sepia + h[1985].sepia) / 2) < 1e-6, "mid-morph sepia should be the linear midpoint");
xe.update(1985, 1, 0.016);
p(Math.abs(ye.uSepia.value - h[1985].sepia) < 1e-6, "complete morph should reach 1985 sepia");
p(Math.abs(ye.uGrain.value - h[1985].grain) < 1e-6, "complete morph should reach 1985 grain");
p(Math.abs(ye.uSaturation.value - h[1985].saturation) < 1e-6, "complete morph should reach 1985 saturation");
z.update(2025, 1, 0.016);
var st;
const is = (st = z.ssaoPass) == null ? void 0 : st.enabled;
p(is === !0, "SSAO should be enabled for 2025");
z.dispose();
xe.dispose();
p(z.grading.pass.enabled === !1, "grading pass should be disabled after dispose");
const as = {
  modules: [
    { path: "src/postfx/pipeline.ts", name: "PostPipeline", registrations: 1, lifecycleCalls: { bootstrap: 1, update: 1, dispose: 1 } },
    { path: "src/postfx/grading.ts", name: "EraGrading", registrations: 1, lifecycleCalls: { bootstrap: 1, update: 2, dispose: 1 } }
  ],
  passChain: ve.map((n) => n.constructor.name),
  eraGrades: De.map((n) => ({ year: n, label: h[n].label, sepia: h[n].sepia, grain: h[n].grain, bloomThreshold: h[n].bloomThreshold, ssao: h[n].ssao })),
  morphBlendVerified: _e.length === 0,
  errors: _e
};
console.log(JSON.stringify(as, null, 2));
_e.length > 0 && process.exit(1);
