(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,36574,e=>{"use strict";var t=e.i(43476),i=e.i(71645);let s=`#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_imageAspectRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

out vec2 v_objectUV;
out vec2 v_objectBoxSize;
out vec2 v_responsiveUV;
out vec2 v_responsiveBoxGivenSize;
out vec2 v_patternUV;
out vec2 v_patternBoxSize;
out vec2 v_imageUV;

vec3 getBoxSize(float boxRatio, vec2 givenBoxSize) {
  vec2 box = vec2(0.);
  // fit = none
  box.x = boxRatio * min(givenBoxSize.x / boxRatio, givenBoxSize.y);
  float noFitBoxWidth = box.x;
  if (u_fit == 1.) { // fit = contain
    box.x = boxRatio * min(u_resolution.x / boxRatio, u_resolution.y);
  } else if (u_fit == 2.) { // fit = cover
    box.x = boxRatio * max(u_resolution.x / boxRatio, u_resolution.y);
  }
  box.y = box.x / boxRatio;
  return vec3(box, noFitBoxWidth);
}

void main() {
  gl_Position = a_position;

  vec2 uv = gl_Position.xy * .5;
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * 3.14159265358979323846 / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);


  // ===================================================

  float fixedRatio = 1.;
  vec2 fixedRatioBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );

  v_objectBoxSize = getBoxSize(fixedRatio, fixedRatioBoxGivenSize).xy;
  vec2 objectWorldScale = u_resolution.xy / v_objectBoxSize;

  v_objectUV = uv;
  v_objectUV *= objectWorldScale;
  v_objectUV += boxOrigin * (objectWorldScale - 1.);
  v_objectUV += graphicOffset;
  v_objectUV /= u_scale;
  v_objectUV = graphicRotation * v_objectUV;

  // ===================================================

  v_responsiveBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  float responsiveRatio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
  vec2 responsiveBoxSize = getBoxSize(responsiveRatio, v_responsiveBoxGivenSize).xy;
  vec2 responsiveBoxScale = u_resolution.xy / responsiveBoxSize;

  #ifdef ADD_HELPERS
  v_responsiveHelperBox = uv;
  v_responsiveHelperBox *= responsiveBoxScale;
  v_responsiveHelperBox += boxOrigin * (responsiveBoxScale - 1.);
  #endif

  v_responsiveUV = uv;
  v_responsiveUV *= responsiveBoxScale;
  v_responsiveUV += boxOrigin * (responsiveBoxScale - 1.);
  v_responsiveUV += graphicOffset;
  v_responsiveUV /= u_scale;
  v_responsiveUV.x *= responsiveRatio;
  v_responsiveUV = graphicRotation * v_responsiveUV;
  v_responsiveUV.x /= responsiveRatio;

  // ===================================================

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 patternBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;

  vec3 boxSizeData = getBoxSize(patternBoxRatio, patternBoxGivenSize);
  v_patternBoxSize = boxSizeData.xy;
  float patternBoxNoFitBoxWidth = boxSizeData.z;
  vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;

  v_patternUV = uv;
  v_patternUV += graphicOffset / patternBoxScale;
  v_patternUV += boxOrigin;
  v_patternUV -= boxOrigin / patternBoxScale;
  v_patternUV *= u_resolution.xy;
  v_patternUV /= u_pixelRatio;
  if (u_fit > 0.) {
    v_patternUV *= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
  }
  v_patternUV /= u_scale;
  v_patternUV = graphicRotation * v_patternUV;
  v_patternUV += boxOrigin / patternBoxScale;
  v_patternUV -= boxOrigin;
  // x100 is a default multiplier between vertex and fragmant shaders
  // we use it to avoid UV presision issues
  v_patternUV *= .01;

  // ===================================================

  vec2 imageBoxSize;
  if (u_fit == 1.) { // contain
    imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) { // cover
    imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  v_imageUV = uv;
  v_imageUV *= imageBoxScale;
  v_imageUV += boxOrigin * (imageBoxScale - 1.);
  v_imageUV += graphicOffset;
  v_imageUV /= u_scale;
  v_imageUV.x *= u_imageAspectRatio;
  v_imageUV = graphicRotation * v_imageUV;
  v_imageUV.x /= u_imageAspectRatio;

  v_imageUV += .5;
  v_imageUV.y = 1. - v_imageUV.y;
}`,o=8294400;class a{parentElement;canvasElement;gl;program=null;uniformLocations={};fragmentShader;rafId=null;lastRenderTime=0;currentFrame=0;speed=0;currentSpeed=0;providedUniforms;mipmaps=[];hasBeenDisposed=!1;resolutionChanged=!0;textures=new Map;minPixelRatio;maxPixelCount;isSafari=(function(){let e=navigator.userAgent.toLowerCase();return e.includes("safari")&&!e.includes("chrome")&&!e.includes("android")})();uniformCache={};textureUnitMap=new Map;ownerDocument;constructor(e,t,i,s,a=0,r=0,l=2,c=o,m=[]){if(e?.nodeType===1)this.parentElement=e;else throw Error("Paper Shaders: parent element must be an HTMLElement");if(this.ownerDocument=e.ownerDocument,!this.ownerDocument.querySelector("style[data-paper-shader]")){const e=this.ownerDocument.createElement("style");e.innerHTML=n,e.setAttribute("data-paper-shader",""),this.ownerDocument.head.prepend(e)}const u=this.ownerDocument.createElement("canvas");this.canvasElement=u,this.parentElement.prepend(u),this.fragmentShader=t,this.providedUniforms=i,this.mipmaps=m,this.currentFrame=r,this.minPixelRatio=l,this.maxPixelCount=c;const p=u.getContext("webgl2",s);if(!p)throw Error("Paper Shaders: WebGL is not supported in this browser");this.gl=p,this.initProgram(),this.setupPositionAttribute(),this.setupUniforms(),this.setUniformValues(this.providedUniforms),this.setupResizeObserver(),visualViewport?.addEventListener("resize",this.handleVisualViewportChange),this.setSpeed(a),this.parentElement.setAttribute("data-paper-shader",""),this.parentElement.paperShaderMount=this,this.ownerDocument.addEventListener("visibilitychange",this.handleDocumentVisibilityChange)}initProgram=()=>{let e=function(e,t,i){let s=e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT),o=s?s.precision:null;o&&o<23&&(t=t.replace(/precision\s+(lowp|mediump)\s+float;/g,"precision highp float;"),i=i.replace(/precision\s+(lowp|mediump)\s+float/g,"precision highp float").replace(/\b(uniform|varying|attribute)\s+(lowp|mediump)\s+(\w+)/g,"$1 highp $3"));let a=r(e,e.VERTEX_SHADER,t),n=r(e,e.FRAGMENT_SHADER,i);if(!a||!n)return null;let l=e.createProgram();return l?(e.attachShader(l,a),e.attachShader(l,n),e.linkProgram(l),e.getProgramParameter(l,e.LINK_STATUS))?(e.detachShader(l,a),e.detachShader(l,n),e.deleteShader(a),e.deleteShader(n),l):(console.error("Unable to initialize the shader program: "+e.getProgramInfoLog(l)),e.deleteProgram(l),e.deleteShader(a),e.deleteShader(n),null):null}(this.gl,s,this.fragmentShader);e&&(this.program=e)};setupPositionAttribute=()=>{let e=this.gl.getAttribLocation(this.program,"a_position"),t=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,t),this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),this.gl.STATIC_DRAW),this.gl.enableVertexAttribArray(e),this.gl.vertexAttribPointer(e,2,this.gl.FLOAT,!1,0,0)};setupUniforms=()=>{let e={u_time:this.gl.getUniformLocation(this.program,"u_time"),u_pixelRatio:this.gl.getUniformLocation(this.program,"u_pixelRatio"),u_resolution:this.gl.getUniformLocation(this.program,"u_resolution")};Object.entries(this.providedUniforms).forEach(([t,i])=>{if(e[t]=this.gl.getUniformLocation(this.program,t),i instanceof HTMLImageElement){let i=`${t}AspectRatio`;e[i]=this.gl.getUniformLocation(this.program,i)}}),this.uniformLocations=e};renderScale=1;parentWidth=0;parentHeight=0;parentDevicePixelWidth=0;parentDevicePixelHeight=0;devicePixelsSupported=!1;resizeObserver=null;setupResizeObserver=()=>{this.resizeObserver=new ResizeObserver(([e])=>{if(e?.borderBoxSize[0]){let t=e.devicePixelContentBoxSize?.[0];void 0!==t&&(this.devicePixelsSupported=!0,this.parentDevicePixelWidth=t.inlineSize,this.parentDevicePixelHeight=t.blockSize),this.parentWidth=e.borderBoxSize[0].inlineSize,this.parentHeight=e.borderBoxSize[0].blockSize}this.handleResize()}),this.resizeObserver.observe(this.parentElement)};handleVisualViewportChange=()=>{this.resizeObserver?.disconnect(),this.setupResizeObserver()};handleResize=()=>{let e=0,t=0,i=Math.max(1,window.devicePixelRatio),s=visualViewport?.scale??1;if(this.devicePixelsSupported){let o=Math.max(1,this.minPixelRatio/i);e=this.parentDevicePixelWidth*o*s,t=this.parentDevicePixelHeight*o*s}else{var o;let a,r,n=Math.max(i,this.minPixelRatio)*s;this.isSafari&&(n*=Math.max(1,(o=this.ownerDocument,(r=Math.round(100*(a=outerWidth/((visualViewport?.scale??1)*(visualViewport?.width??window.innerWidth)+(window.innerWidth-o.documentElement.clientWidth)))))%5==0?r/100:33===r?1/3:67===r?2/3:133===r?4/3:a))),e=Math.round(this.parentWidth)*n,t=Math.round(this.parentHeight)*n}let a=Math.min(1,Math.sqrt(this.maxPixelCount)/Math.sqrt(e*t)),r=Math.round(e*a),n=Math.round(t*a),l=r/Math.round(this.parentWidth);(this.canvasElement.width!==r||this.canvasElement.height!==n||this.renderScale!==l)&&(this.renderScale=l,this.canvasElement.width=r,this.canvasElement.height=n,this.resolutionChanged=!0,this.gl.viewport(0,0,this.gl.canvas.width,this.gl.canvas.height),this.render(performance.now()))};render=e=>{if(this.hasBeenDisposed)return;if(null===this.program)return void console.warn("Tried to render before program or gl was initialized");let t=e-this.lastRenderTime;this.lastRenderTime=e,0!==this.currentSpeed&&(this.currentFrame+=t*this.currentSpeed),this.gl.clear(this.gl.COLOR_BUFFER_BIT),this.gl.useProgram(this.program),this.gl.uniform1f(this.uniformLocations.u_time,.001*this.currentFrame),this.resolutionChanged&&(this.gl.uniform2f(this.uniformLocations.u_resolution,this.gl.canvas.width,this.gl.canvas.height),this.gl.uniform1f(this.uniformLocations.u_pixelRatio,this.renderScale),this.resolutionChanged=!1),this.gl.drawArrays(this.gl.TRIANGLES,0,6),0!==this.currentSpeed?this.requestRender():this.rafId=null};requestRender=()=>{null!==this.rafId&&cancelAnimationFrame(this.rafId),this.rafId=requestAnimationFrame(this.render)};setTextureUniform=(e,t)=>{if(!t.complete||0===t.naturalWidth)throw Error(`Paper Shaders: image for uniform ${e} must be fully loaded`);let i=this.textures.get(e);i&&this.gl.deleteTexture(i),this.textureUnitMap.has(e)||this.textureUnitMap.set(e,this.textureUnitMap.size);let s=this.textureUnitMap.get(e);this.gl.activeTexture(this.gl.TEXTURE0+s);let o=this.gl.createTexture();this.gl.bindTexture(this.gl.TEXTURE_2D,o),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR),this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,t),this.mipmaps.includes(e)&&(this.gl.generateMipmap(this.gl.TEXTURE_2D),this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR_MIPMAP_LINEAR));let a=this.gl.getError();if(a!==this.gl.NO_ERROR||null===o)return void console.error("Paper Shaders: WebGL error when uploading texture:",a);this.textures.set(e,o);let r=this.uniformLocations[e];if(r){this.gl.uniform1i(r,s);let i=`${e}AspectRatio`,o=this.uniformLocations[i];if(o){let e=t.naturalWidth/t.naturalHeight;this.gl.uniform1f(o,e)}}};areUniformValuesEqual=(e,t)=>e===t||!!(Array.isArray(e)&&Array.isArray(t))&&e.length===t.length&&e.every((e,i)=>this.areUniformValuesEqual(e,t[i]));setUniformValues=e=>{this.gl.useProgram(this.program),Object.entries(e).forEach(([e,t])=>{let i=t;if(t instanceof HTMLImageElement&&(i=`${t.src.slice(0,200)}|${t.naturalWidth}x${t.naturalHeight}`),this.areUniformValuesEqual(this.uniformCache[e],i))return;this.uniformCache[e]=i;let s=this.uniformLocations[e];if(!s)return void console.warn(`Uniform location for ${e} not found`);if(t instanceof HTMLImageElement)this.setTextureUniform(e,t);else if(Array.isArray(t)){let i=null,o=null;if(void 0!==t[0]&&Array.isArray(t[0])){let s=t[0].length;if(!t.every(e=>e.length===s))return void console.warn(`All child arrays must be the same length for ${e}`);i=t.flat(),o=s}else o=(i=t).length;switch(o){case 2:this.gl.uniform2fv(s,i);break;case 3:this.gl.uniform3fv(s,i);break;case 4:this.gl.uniform4fv(s,i);break;case 9:this.gl.uniformMatrix3fv(s,!1,i);break;case 16:this.gl.uniformMatrix4fv(s,!1,i);break;default:console.warn(`Unsupported uniform array length: ${o}`)}}else"number"==typeof t?this.gl.uniform1f(s,t):"boolean"==typeof t?this.gl.uniform1i(s,+!!t):console.warn(`Unsupported uniform type for ${e}: ${typeof t}`)})};getCurrentFrame=()=>this.currentFrame;setFrame=e=>{this.currentFrame=e,this.lastRenderTime=performance.now(),this.render(performance.now())};setSpeed=(e=1)=>{this.speed=e,this.setCurrentSpeed(this.ownerDocument.hidden?0:e)};setCurrentSpeed=e=>{this.currentSpeed=e,null===this.rafId&&0!==e&&(this.lastRenderTime=performance.now(),this.rafId=requestAnimationFrame(this.render)),null!==this.rafId&&0===e&&(cancelAnimationFrame(this.rafId),this.rafId=null)};setMaxPixelCount=(e=o)=>{this.maxPixelCount=e,this.handleResize()};setMinPixelRatio=(e=2)=>{this.minPixelRatio=e,this.handleResize()};setUniforms=e=>{this.setUniformValues(e),this.providedUniforms={...this.providedUniforms,...e},this.render(performance.now())};handleDocumentVisibilityChange=()=>{this.setCurrentSpeed(this.ownerDocument.hidden?0:this.speed)};dispose=()=>{this.hasBeenDisposed=!0,null!==this.rafId&&(cancelAnimationFrame(this.rafId),this.rafId=null),this.gl&&this.program&&(this.textures.forEach(e=>{this.gl.deleteTexture(e)}),this.textures.clear(),this.gl.deleteProgram(this.program),this.program=null,this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null),this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,null),this.gl.bindRenderbuffer(this.gl.RENDERBUFFER,null),this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null),this.gl.getError()),this.resizeObserver&&(this.resizeObserver.disconnect(),this.resizeObserver=null),visualViewport?.removeEventListener("resize",this.handleVisualViewportChange),this.ownerDocument.removeEventListener("visibilitychange",this.handleDocumentVisibilityChange),this.uniformLocations={},this.canvasElement.remove(),delete this.parentElement.paperShaderMount}}function r(e,t,i){let s=e.createShader(t);return s?(e.shaderSource(s,i),e.compileShader(s),e.getShaderParameter(s,e.COMPILE_STATUS))?s:(console.error("An error occurred compiling the shaders: "+e.getShaderInfoLog(s)),e.deleteShader(s),null):null}let n=`@layer paper-shaders {
  :where([data-paper-shader]) {
    isolation: isolate;
    position: relative;

    & canvas {
      contain: strict;
      display: block;
      position: absolute;
      inset: 0;
      z-index: -1;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      corner-shape: inherit;
    }
  }
}`;function l(e){if(e.naturalWidth<1024&&e.naturalHeight<1024){if(e.naturalWidth<1||e.naturalHeight<1)return;let t=e.naturalWidth/e.naturalHeight;e.width=Math.round(t>1?1024*t:1024),e.height=Math.round(t>1?1024:1024/t)}}async function c(e){let t={},i=[];return Object.entries(e).forEach(([e,s])=>{if("string"==typeof s){let o=s||"data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";if(!(e=>{try{if(e.startsWith("/"))return!0;return new URL(e),!0}catch{return!1}})(o))return void console.warn(`Uniform "${e}" has invalid URL "${o}". Skipping image loading.`);let a=new Promise((i,s)=>{let a=new Image;(e=>{try{if(e.startsWith("/"))return!1;return new URL(e,window.location.origin).origin!==window.location.origin}catch{return!1}})(o)&&(a.crossOrigin="anonymous"),a.onload=()=>{l(a),t[e]=a,i()},a.onerror=()=>{console.error(`Could not set uniforms. Failed to load image at ${o}`),s()},a.src=o});i.push(a)}else s instanceof HTMLImageElement&&l(s),t[e]=s}),await Promise.all(i),t}let m=(0,i.forwardRef)(function({fragmentShader:e,uniforms:s,webGlContextAttributes:o,speed:r=0,frame:n=0,width:l,height:m,minPixelRatio:u,maxPixelCount:p,mipmaps:h,style:d,...g},f){var x;let y,v,[b,j]=(0,i.useState)(!1),_=(0,i.useRef)(null),w=(0,i.useRef)(null),S=(0,i.useRef)(o);(0,i.useEffect)(()=>((async()=>{let t=await c(s);_.current&&!w.current&&(w.current=new a(_.current,e,t,S.current,r,n,u,p,h),j(!0))})(),()=>{w.current?.dispose(),w.current=null}),[e]),(0,i.useEffect)(()=>{let e=!1;return(async()=>{let t=await c(s);e||w.current?.setUniforms(t)})(),()=>{e=!0}},[s,b]),(0,i.useEffect)(()=>{w.current?.setSpeed(r)},[r,b]),(0,i.useEffect)(()=>{w.current?.setMaxPixelCount(p)},[p,b]),(0,i.useEffect)(()=>{w.current?.setMinPixelRatio(u)},[u,b]),(0,i.useEffect)(()=>{w.current?.setFrame(n)},[n,b]);let R=(x=[_,f],y=i.useRef(void 0),v=i.useCallback(e=>{let t=x.map(t=>{if(null!=t){if("function"==typeof t){let i=t(e);return"function"==typeof i?i:()=>{t(null)}}return t.current=e,()=>{t.current=null}}});return()=>{t.forEach(e=>e?.())}},x),i.useMemo(()=>x.every(e=>null==e)?null:e=>{y.current&&(y.current(),y.current=void 0),null!=e&&(y.current=v(e))},x));return(0,t.jsx)("div",{ref:R,style:void 0!==l||void 0!==m?{width:"string"==typeof l&&!1===isNaN(+l)?+l:l,height:"string"==typeof m&&!1===isNaN(+m)?+m:m,...d}:d,...g})});m.displayName="ShaderMount";let u={fit:"none",scale:1,rotation:0,offsetX:0,offsetY:0,originX:.5,originY:.5,worldWidth:0,worldHeight:0},p={none:0,contain:1,cover:2};function h(e){if(Array.isArray(e))return 4===e.length?e:3===e.length?[...e,1]:g;if("string"!=typeof e)return g;let t,i,s,o=1;if(e.startsWith("#")){var a;[t,i,s,o]=(3===(a=(a=e).replace(/^#/,"")).length&&(a=a.split("").map(e=>e+e).join("")),6===a.length&&(a+="ff"),[parseInt(a.slice(0,2),16)/255,parseInt(a.slice(2,4),16)/255,parseInt(a.slice(4,6),16)/255,parseInt(a.slice(6,8),16)/255])}else if(e.startsWith("rgb")){let a;[t,i,s,o]=(a=e.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\s*\)$/i))?[parseInt(a[1]??"0")/255,parseInt(a[2]??"0")/255,parseInt(a[3]??"0")/255,void 0===a[4]?1:parseFloat(a[4])]:[0,0,0,1]}else{let a;if(!e.startsWith("hsl"))return console.error("Unsupported color format",e),g;[t,i,s,o]=function(e){let t,i,s,[o,a,r,n]=e,l=o/360,c=a/100,m=r/100;if(0===a)t=i=s=m;else{let e=(e,t,i)=>(i<0&&(i+=1),i>1&&(i-=1),i<1/6)?e+(t-e)*6*i:i<.5?t:i<2/3?e+(t-e)*(2/3-i)*6:e,o=m<.5?m*(1+c):m+c-m*c,a=2*m-o;t=e(a,o,l+1/3),i=e(a,o,l),s=e(a,o,l-1/3)}return[t,i,s,n]}((a=e.match(/^hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([0-9.]+))?\s*\)$/i))?[parseInt(a[1]??"0"),parseInt(a[2]??"0"),parseInt(a[3]??"0"),void 0===a[4]?1:parseFloat(a[4])]:[0,0,0,1])}return[d(t,0,1),d(i,0,1),d(s,0,1),d(o,0,1)]}let d=(e,t,i)=>Math.min(Math.max(e,t),i),g=[0,0,0,1],f=`
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
`,x=`
  color += 1. / 256. * (fract(sin(dot(.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - .5);
`,y=`
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`,v=`#version 300 es
precision mediump float;

uniform float u_time;

uniform vec4 u_colorBack;
uniform vec4 u_colorFront;
uniform float u_density;
uniform float u_distortion;
uniform float u_strokeWidth;
uniform float u_strokeCap;
uniform float u_strokeTaper;
uniform float u_noise;
uniform float u_noiseFrequency;
uniform float u_softness;

in vec2 v_patternUV;

out vec4 fragColor;

${f}
${y}

void main() {
  vec2 uv = 2. * v_patternUV;

  float t = u_time;
  float l = length(uv);
  float density = clamp(u_density, 0., 1.);
  l = pow(max(l, 1e-6), density);
  float angle = atan(uv.y, uv.x) - t;
  float angleNormalised = angle / TWO_PI;

  angleNormalised += .125 * u_noise * snoise(16. * pow(u_noiseFrequency, 3.) * uv);

  float offset = l + angleNormalised;
  offset -= u_distortion * (sin(4. * l - .5 * t) * cos(PI + l + .5 * t));
  float stripe = fract(offset);

  float shape = 2. * abs(stripe - .5);
  float width = 1. - clamp(u_strokeWidth, .005 * u_strokeTaper, 1.);


  float wCap = mix(width, (1. - stripe) * (1. - step(.5, stripe)), (1. - clamp(l, 0., 1.)));
  width = mix(width, wCap, u_strokeCap);
  width *= (1. - clamp(u_strokeTaper, 0., 1.) * l);

  float fw = fwidth(offset);
  float fwMult = 4. - 3. * (smoothstep(.05, .4, 2. * u_strokeWidth) * smoothstep(.05, .4, 2. * (1. - u_strokeWidth)));
  float pixelSize = mix(fwMult * fw, fwidth(shape), clamp(fw, 0., 1.));
  pixelSize = mix(pixelSize, .002, u_strokeCap * (1. - clamp(l, 0., 1.)));

  float res = smoothstep(width - pixelSize - u_softness, width + pixelSize + u_softness, shape);

  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;

  vec3 color = fgColor * res;
  float opacity = fgOpacity * res;

  color += bgColor * (1. - opacity);
  opacity += bgOpacity * (1. - opacity);

  ${x}

  fragColor = vec4(color, opacity);
}
`,b={name:"Default",params:{...u,scale:1,colorBack:"#001429",colorFront:"#79D1FF",density:1,distortion:0,strokeWidth:.5,strokeTaper:0,strokeCap:0,noise:0,noiseFrequency:0,softness:0,speed:1,frame:0}},j=(0,i.memo)(function({speed:e=b.params.speed,frame:i=b.params.frame,colorBack:s=b.params.colorBack,colorFront:o=b.params.colorFront,density:a=b.params.density,distortion:r=b.params.distortion,strokeWidth:n=b.params.strokeWidth,strokeTaper:l=b.params.strokeTaper,strokeCap:c=b.params.strokeCap,noiseFrequency:u=b.params.noiseFrequency,noise:d=b.params.noise,softness:g=b.params.softness,fit:f=b.params.fit,rotation:x=b.params.rotation,scale:y=b.params.scale,originX:j=b.params.originX,originY:_=b.params.originY,offsetX:w=b.params.offsetX,offsetY:S=b.params.offsetY,worldWidth:R=b.params.worldWidth,worldHeight:E=b.params.worldHeight,...A}){let U={u_colorBack:h(s),u_colorFront:h(o),u_density:a,u_distortion:r,u_strokeWidth:n,u_strokeTaper:l,u_strokeCap:c,u_noiseFrequency:u,u_noise:d,u_softness:g,u_fit:p[f],u_scale:y,u_rotation:x,u_offsetX:w,u_offsetY:S,u_originX:j,u_originY:_,u_worldWidth:R,u_worldHeight:E};return(0,t.jsx)(m,{...A,speed:e,frame:i,fragmentShader:v,uniforms:U})},function(e,t){for(let i in e){if("colors"===i){let i=Array.isArray(e.colors),s=Array.isArray(t.colors);if(!i||!s){if(!1===Object.is(e.colors,t.colors))return!1;continue}if(e.colors?.length!==t.colors?.length||!e.colors?.every((e,i)=>e===t.colors?.[i]))return!1;continue}if(!1===Object.is(e[i],t[i]))return!1}return!0});function _(e){return/^(https?:)?\/\//.test(e)||e.startsWith("data:")?e:`/miyo-lab${e}`}e.i(47167);let w="미요툰, 미요앱 시리즈로 미요 세계관을 위한 실험실",S="/assets/miyo-profile.png",R="더드미요 캐릭터",E="/assets/miyo-miniroom.png",A="미요 미니룸",U=[{id:"instructor",title:"소개",blocks:[{kind:"text",lines:["안녕하세요, 이준혁입니다 🍀","학창 시절엔 물리를 배운 적이 없었습니다. 그런데 지금은, 그 물리를 가르치는 교사가 되었고 이제는 좋아하게 되어버렸습니다. 돌고 돌아 물리에 진심이 된 교직 경력 10년차 교사입니다.","수업 시간에는 물리를, 수업이 끝나면 캐릭터 '미요'를 그리고 이야기를 만듭니다. 미요툰 작가이자, 미요 세계관을 앱으로 옮기는 미요앱 개발자로도 활동하고 있습니다. 요즘은 바이브 코딩으로 학급 경영과 수업에 필요한 도구들을 직접 만드는 재미에도 푹 빠져 있습니다."]},{kind:"list",heading:"하고 있는 일들",items:["고등학교 3학년 담임 & 물리 교과 지도","아주대학교 AI융합교육과 석사 졸업","평택시 진학지도 리더교사 운영진 (2023~현재)","화성·평택·용인·안성 찾아가는 1:1 맞춤형 진로진학 컨설팅","평택·용인·안성 진학박람회 진학컨설팅 부스 운영","경기도 물리교육 연구회 / AX교육전환 전국단위 연구회 (2026)","하이러닝 연구학교 및 AI서논술형 연구회 (2025~현재)","Dorms 교사 커뮤니티 활동 (2026)"]},{kind:"list",heading:"강의 경력",items:["2026 경기진협 의치한약수 전형 분석 자료 제작","2026 물리 신규교사 대상 하이러닝 및 에듀테크 교사 연수","2026 안산 양지고 하이러닝 및 에듀테크 교사 연수","2026 행정혁신 생성형 Gemini 활용법 행정직원 연수"]},{kind:"contact",items:[{label:"📩 Email",value:"ljh6479z@gmail.com",href:"mailto:ljh6479z@gmail.com"},{label:"📷 미요툰",value:"@me_yotoon",href:"https://www.instagram.com/me_yotoon"},{label:"📷 미요앱",value:"@me_yoapp",href:"https://www.instagram.com/me_yoapp/"}]}]},{id:"miyotoon",title:"미요툰 소개",subtitle:"그림으로 남기는 기록",blocks:[{kind:"text",lines:["미요툰은 미요 캐릭터들이 등장하는 짧은 만화입니다.","수업하다 만난 순간, 배우다 겪은 실수를 한 컷으로 남깁니다.","새 에피소드는 인스타그램 @me_yotoon 에 먼저 올라갑니다."]}]},{id:"miyoapp",title:"미요앱 소개",subtitle:"직접 만드는 작은 도구",blocks:[{kind:"text",lines:["미요앱은 수업에 바로 쓰려고 만든 작은 웹 도구 모음입니다.","설치 없이 링크만 열면 되는 가벼운 형태를 지향합니다.","완성한 앱은 미요앱 탭에 하나씩 올릴 예정입니다."]}]}],N=[{id:"liftlog",category:"앱",title:"더드미요의 운동추천",summary:"더드미요 트레이너와 대화하며 운동을 기록하고 타이머로 세트를 관리합니다.",date:"2026.08.11",href:"https://liftlog-qayq.onrender.com/",preview:{src:"/assets/miyo/miyo-00.jpg",alt:"더드미요 캐릭터"}},{id:"aseating",category:"앱",title:"갓미요의 스마트AI 자리배치",summary:"교실 자리를 조건에 맞게 자동으로 배치해 주는 교사용 도구입니다.",date:"2026.08.11",href:"https://sn-aseating.vercel.app/login.html",preview:{src:"/assets/miyo/miyo-03.jpg",alt:"갓미요 캐릭터"}},{id:"osaka-trip",category:"앱",title:"야르미요의 여행플래너",summary:"여행 일정을 D-day와 함께 모아 보는 플래너입니다.",date:"2026.08.11",href:"https://pcallpang.github.io/miyo-trip/",preview:{src:"/assets/miyo/miyo-14.jpg",alt:"야르미요 캐릭터"}}],B=[{id:"miyo-00",name:"더드미요",src:"/assets/miyo/miyo-00.jpg"},{id:"miyo-01",name:"미요",src:"/assets/miyo/miyo-01.jpg"},{id:"miyo-02",name:"미요X (사춘기)",src:"/assets/miyo/miyo-02.jpg"},{id:"miyo-03",name:"갓미요",src:"/assets/miyo/miyo-03.jpg"},{id:"miyo-04",name:"삐질미요",src:"/assets/miyo/miyo-04.jpg"},{id:"miyo-05",name:"맑눈광미요",src:"/assets/miyo/miyo-05.jpg"},{id:"miyo-06",name:"무뚝미요",src:"/assets/miyo/miyo-06.jpg"},{id:"miyo-07",name:"빡미요",src:"/assets/miyo/miyo-07.jpg"},{id:"miyo-08",name:"넵미요",src:"/assets/miyo/miyo-08.jpg"},{id:"miyo-09",name:"훈수미요",src:"/assets/miyo/miyo-09.jpg"},{id:"miyo-10",name:"핑프미요",src:"/assets/miyo/miyo-10.jpg"},{id:"miyo-11",name:"무지개반사미요",src:"/assets/miyo/miyo-11.jpg"},{id:"miyo-12",name:"앵무미요",src:"/assets/miyo/miyo-12.jpg"},{id:"miyo-13",name:"왜요미요",src:"/assets/miyo/miyo-13.jpg"},{id:"miyo-14",name:"야르미요",src:"/assets/miyo/miyo-14.jpg"},{id:"miyo-15",name:"갸루미요",src:"/assets/miyo/miyo-15.jpg"}],z=[{id:"miyotoon",label:"미요툰 인스타그램",href:"https://www.instagram.com/me_yotoon"},{id:"miyoapp",label:"미요앱 인스타그램",href:"https://www.instagram.com/me_yoapp/"},{id:"dorms",label:"도름스쿨 내 교실",href:"https://dorms.school/channels/3fad9324-3dee-49ae-8b5c-0a6686d85add"}],T=[{id:1,author:"김선생",text:"미요Lab 너무 기대됩니다! 화이팅!",date:"2026.08.09"},{id:2,author:"미요팬",text:"미요앱 시리즈 언제 나오나요? 현기증 나요",date:"2026.08.08"},{id:3,author:"박교사",text:"더드미요 표정 볼 때마다 웃겨요 ㅋㅋㅋ",date:"2026.08.07"},{id:4,author:"코딩하는쌤",text:"미니룸에 있는 캐릭터들 다 이름이 있나요? 궁금해요",date:"2026.08.05"},{id:5,author:"최학생",text:"선생님 홈피 너무 예뻐요 퍼가요~♡",date:"2026.08.01"}],k=[{kind:"group",id:"dorms-activity",number:"01",name:"도름스 커뮤니티 나의 활동",description:"DoRms school 내 교실",thumb:{kind:"image",src:"/assets/dorms-community.png",alt:"DoRms community"},items:[{name:"DoRms 내 교실",description:"DoRms school 내 교실 채널입니다.",href:"https://dorms.school/channels/3fad9324-3dee-49ae-8b5c-0a6686d85add",thumb:{kind:"image",src:"/assets/dorms-community.png",alt:"DoRms community"}}]},{kind:"link",id:"insta-miyotoon",number:"02",name:"미요툰 인스타그램 me_yotoon",description:"@me_yotoon",href:"https://www.instagram.com/me_yotoon",thumb:{kind:"icon",icon:"instagram"}},{kind:"link",id:"insta-miyoapp",number:"03",name:"미요앱 인스타그램 me_yoapp",description:"@me_yoapp",href:"https://www.instagram.com/me_yoapp/",thumb:{kind:"icon",icon:"instagram"}}],P=[{id:"ep01",label:"1화",title:"",thumb:"/assets/miyotoon/ep01/thumb.jpg",cuts:["/assets/miyotoon/ep01/cut-01.jpg","/assets/miyotoon/ep01/cut-02.jpg","/assets/miyotoon/ep01/cut-03.jpg","/assets/miyotoon/ep01/cut-04.jpg"]},{id:"ep02",label:"2화",title:"",thumb:"/assets/miyotoon/ep02/thumb.jpg",cuts:["/assets/miyotoon/ep02/cut-01.jpg","/assets/miyotoon/ep02/cut-02.jpg","/assets/miyotoon/ep02/cut-03.jpg","/assets/miyotoon/ep02/cut-04.jpg","/assets/miyotoon/ep02/cut-05.jpg"]},{id:"ep03",label:"3화",title:"",thumb:"/assets/miyotoon/ep03/thumb.jpg",cuts:["/assets/miyotoon/ep03/cut-01.jpg","/assets/miyotoon/ep03/cut-02.jpg","/assets/miyotoon/ep03/cut-03.jpg","/assets/miyotoon/ep03/cut-04.jpg","/assets/miyotoon/ep03/cut-05.jpg","/assets/miyotoon/ep03/cut-06.jpg"]},{id:"ep04",label:"4화",title:"",thumb:"/assets/miyotoon/ep04/thumb.jpg",cuts:["/assets/miyotoon/ep04/cut-01.jpg","/assets/miyotoon/ep04/cut-02.jpg","/assets/miyotoon/ep04/cut-03.jpg","/assets/miyotoon/ep04/cut-04.jpg","/assets/miyotoon/ep04/cut-05.jpg","/assets/miyotoon/ep04/cut-06.jpg"]},{id:"ep05",label:"5화",title:"",thumb:"/assets/miyotoon/ep05/thumb.jpg",cuts:["/assets/miyotoon/ep05/cut-01.jpg","/assets/miyotoon/ep05/cut-02.jpg","/assets/miyotoon/ep05/cut-03.jpg","/assets/miyotoon/ep05/cut-04.jpg","/assets/miyotoon/ep05/cut-05.jpg","/assets/miyotoon/ep05/cut-06.jpg"]},{id:"ep06",label:"6화",title:"",thumb:"/assets/miyotoon/ep06/thumb.jpg",cuts:["/assets/miyotoon/ep06/cut-01.jpg","/assets/miyotoon/ep06/cut-02.jpg","/assets/miyotoon/ep06/cut-03.jpg","/assets/miyotoon/ep06/cut-04.jpg","/assets/miyotoon/ep06/cut-05.jpg","/assets/miyotoon/ep06/cut-06.jpg"]},{id:"ep07",label:"7화",title:"",thumb:"/assets/miyotoon/ep07/thumb.jpg",cuts:["/assets/miyotoon/ep07/cut-01.jpg","/assets/miyotoon/ep07/cut-02.jpg","/assets/miyotoon/ep07/cut-03.jpg","/assets/miyotoon/ep07/cut-04.jpg","/assets/miyotoon/ep07/cut-05.jpg","/assets/miyotoon/ep07/cut-06.jpg"]},{id:"ep08",label:"8화",title:"",thumb:"/assets/miyotoon/ep08/thumb.jpg",cuts:["/assets/miyotoon/ep08/cut-01.jpg","/assets/miyotoon/ep08/cut-02.jpg","/assets/miyotoon/ep08/cut-03.jpg","/assets/miyotoon/ep08/cut-04.jpg","/assets/miyotoon/ep08/cut-05.jpg","/assets/miyotoon/ep08/cut-06.jpg","/assets/miyotoon/ep08/cut-07.jpg"]},{id:"ep09",label:"9화",title:"",thumb:"/assets/miyotoon/ep09/thumb.jpg",cuts:["/assets/miyotoon/ep09/cut-01.jpg","/assets/miyotoon/ep09/cut-02.jpg","/assets/miyotoon/ep09/cut-03.jpg","/assets/miyotoon/ep09/cut-04.jpg","/assets/miyotoon/ep09/cut-05.jpg","/assets/miyotoon/ep09/cut-06.jpg"]},{id:"ep10",label:"10화",title:"",thumb:"/assets/miyotoon/ep10/thumb.jpg",cuts:["/assets/miyotoon/ep10/cut-01.jpg","/assets/miyotoon/ep10/cut-02.jpg","/assets/miyotoon/ep10/cut-03.jpg","/assets/miyotoon/ep10/cut-04.jpg","/assets/miyotoon/ep10/cut-05.jpg","/assets/miyotoon/ep10/cut-06.jpg"]},{id:"ep11",label:"11화",title:"",thumb:"/assets/miyotoon/ep11/thumb.jpg",cuts:["/assets/miyotoon/ep11/cut-01.jpg","/assets/miyotoon/ep11/cut-02.jpg","/assets/miyotoon/ep11/cut-03.jpg","/assets/miyotoon/ep11/cut-04.jpg","/assets/miyotoon/ep11/cut-05.jpg","/assets/miyotoon/ep11/cut-06.jpg"]},{id:"ep12",label:"12화",title:"",thumb:"/assets/miyotoon/ep12/thumb.jpg",cuts:["/assets/miyotoon/ep12/cut-01.jpg","/assets/miyotoon/ep12/cut-02.jpg","/assets/miyotoon/ep12/cut-03.jpg","/assets/miyotoon/ep12/cut-04.jpg","/assets/miyotoon/ep12/cut-05.jpg","/assets/miyotoon/ep12/cut-06.jpg"]},{id:"ep13",label:"13화",title:"",thumb:"/assets/miyotoon/ep13/thumb.jpg",cuts:["/assets/miyotoon/ep13/cut-01.jpg","/assets/miyotoon/ep13/cut-02.jpg","/assets/miyotoon/ep13/cut-03.jpg","/assets/miyotoon/ep13/cut-04.jpg","/assets/miyotoon/ep13/cut-05.jpg","/assets/miyotoon/ep13/cut-06.jpg"]},{id:"extra",label:"번외편",title:"",thumb:"/assets/miyotoon/extra/thumb.jpg",cuts:["/assets/miyotoon/extra/cut-01.jpg","/assets/miyotoon/extra/cut-02.jpg","/assets/miyotoon/extra/cut-03.jpg","/assets/miyotoon/extra/cut-04.jpg","/assets/miyotoon/extra/cut-05.jpg","/assets/miyotoon/extra/cut-06.jpg","/assets/miyotoon/extra/cut-07.jpg","/assets/miyotoon/extra/cut-08.jpg","/assets/miyotoon/extra/cut-09.jpg","/assets/miyotoon/extra/cut-10.jpg","/assets/miyotoon/extra/cut-11.jpg","/assets/miyotoon/extra/cut-12.jpg","/assets/miyotoon/extra/cut-13.jpg","/assets/miyotoon/extra/cut-14.jpg","/assets/miyotoon/extra/cut-15.jpg"]}],V="#F4F7F4",F="#2F4A38",C="#547A60",D="#4CA771",M=["홈","프로필","미요툰","미요앱","사진첩"],L={fit:"none",scale:1.3,rotation:0,offsetX:0,offsetY:0,originX:.5,originY:.5,worldWidth:0,worldHeight:0,density:.5,colorBack:V,colorFront:D,distortion:0,strokeWidth:.5,strokeTaper:0,strokeCap:0,noise:1,noiseFrequency:.25,softness:0,speed:.75,frame:0,maxPixelCount:15e5},I={"--cream":V,"--ink":F,"--brown":C,"--display":"'Pretendard', 'Noto Sans KR', system-ui, sans-serif","--body":"'Pretendard', 'Noto Sans KR', system-ui, sans-serif"};function W({size:e=18}){return(0,t.jsx)("svg",{width:e,height:e,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.3",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:(0,t.jsx)("path",{d:"M6 9l6 6 6-6"})})}function O({onBrowse:e}){return(0,t.jsxs)("div",{className:"lt-intro",style:I,children:[(0,t.jsx)(j,{className:"lt-intro-spiral",...L}),(0,t.jsxs)("div",{className:"lt-intro-card",children:[(0,t.jsx)("span",{className:"lt-intro-title",children:"미요Lab 미요앱 실험실"}),(0,t.jsx)("p",{className:"lt-intro-copy",children:w}),(0,t.jsxs)("button",{type:"button",className:"lt-intro-cta",onClick:e,children:["모든 활동 구경하기",(0,t.jsx)(W,{size:18})]})]})]})}let H={홈:"미요Lab 활동 탭",프로필:"프로필",미요툰:"미요툰",미요앱:"미요앱",사진첩:"사진첩"};function $({title:e,sub:i}){return(0,t.jsxs)("div",{className:"cy-section-title",children:[e,i?(0,t.jsx)("span",{className:"cy-sub-text",children:i}):null]})}function X(){let e=k.flatMap(e=>"group"===e.kind?e.items:[e]);return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("div",{className:"cy-content-box",children:[(0,t.jsx)($,{title:"Updated news",sub:`TODAY ${e.length}건`}),(0,t.jsx)("ul",{className:"cy-news-list",children:e.map((e,i)=>(0,t.jsx)("li",{children:(0,t.jsx)("a",{href:e.href,target:"_blank",rel:"noopener noreferrer",children:e.name})},i))})]}),(0,t.jsxs)("div",{className:"cy-content-box cy-miniroom-box",children:[(0,t.jsx)($,{title:"Mini Room",sub:"미니룸"}),(0,t.jsx)("div",{className:"cy-miniroom-inner",children:(0,t.jsx)("img",{src:_(E),alt:A})})]}),(0,t.jsxs)("div",{className:"cy-content-box",children:[(0,t.jsx)($,{title:"What friends say",sub:"한마디로 표현한다면~"}),(0,t.jsx)(K,{limit:3})]})]})}function G(){return(0,t.jsx)(t.Fragment,{children:U.map(e=>(0,t.jsxs)("div",{className:"cy-content-box",children:[(0,t.jsx)($,{title:e.title,sub:e.subtitle}),e.blocks.map((e,i)=>"text"===e.kind?(0,t.jsx)("div",{className:"cy-text-block",children:e.lines.map((e,i)=>(0,t.jsx)("p",{children:e},i))},i):"list"===e.kind?(0,t.jsxs)("div",{className:"cy-profile-list-box",children:[(0,t.jsx)("div",{className:"cy-profile-list-heading",children:e.heading}),(0,t.jsx)("ul",{className:"cy-profile-list",children:e.items.map((e,i)=>(0,t.jsx)("li",{children:e},i))})]},i):(0,t.jsx)("ul",{className:"cy-contact-list",children:e.items.map(e=>(0,t.jsxs)("li",{children:[(0,t.jsx)("span",{className:"cy-contact-label",children:e.label}),(0,t.jsx)("a",{href:e.href,target:e.href.startsWith("mailto:")?void 0:"_blank",rel:"noopener noreferrer",children:e.value})]},e.href))},i))]},e.id))})}function Y(){let[e,s]=(0,i.useState)(null),o=P.find(t=>t.id===e);return o?(0,t.jsxs)("div",{className:"cy-content-box",children:[(0,t.jsx)($,{title:o.title?`${o.label} ${o.title}`:o.label,sub:`${o.cuts.length}컷`}),(0,t.jsx)("button",{className:"cy-back-btn",onClick:()=>s(null),children:"목록으로"}),(0,t.jsx)("div",{className:"cy-cut-list",children:o.cuts.map((e,i)=>(0,t.jsx)("img",{src:_(e),alt:`${o.label} ${i+1}컷`,loading:"lazy"},e))})]}):(0,t.jsxs)("div",{className:"cy-content-box",children:[(0,t.jsx)($,{title:"미요툰",sub:`전체 ${P.length}화`}),(0,t.jsx)("ul",{className:"cy-episode-grid",children:P.map(e=>(0,t.jsx)("li",{children:(0,t.jsxs)("button",{className:"cy-episode-card",onClick:()=>s(e.id),children:[(0,t.jsx)("span",{className:"cy-episode-thumb",children:(0,t.jsx)("img",{src:_(e.thumb),alt:e.label,loading:"lazy"})}),(0,t.jsx)("span",{className:"cy-episode-label",children:e.label}),e.title?(0,t.jsx)("span",{className:"cy-episode-title",children:e.title}):null]})},e.id))})]})}function q(){return(0,t.jsxs)("div",{className:"cy-content-box",children:[(0,t.jsx)($,{title:"미요앱",sub:"앱과 게시글"}),0===N.length?(0,t.jsxs)("div",{className:"cy-empty-box",children:["아직 올린 글이 없습니다.",(0,t.jsx)("br",{}),"미요앱과 게시글 링크를 여기에 하나씩 추가할 예정입니다."]}):(0,t.jsx)("ul",{className:"cy-board-list",children:N.map(e=>(0,t.jsx)("li",{className:"cy-board-item",children:(0,t.jsxs)("a",{className:"cy-board-link",href:e.href,target:"_blank",rel:"noopener noreferrer",children:[e.preview?(0,t.jsx)("span",{className:"cy-board-preview",children:(0,t.jsx)("img",{src:_(e.preview.src),alt:e.preview.alt,loading:"lazy"})}):null,(0,t.jsxs)("span",{className:"cy-board-text",children:[(0,t.jsxs)("span",{className:"cy-board-head",children:[(0,t.jsx)("span",{className:"cy-board-category",children:e.category}),(0,t.jsx)("span",{className:"cy-board-title",children:e.title})]}),e.summary?(0,t.jsx)("span",{className:"cy-board-summary",children:e.summary}):null,(0,t.jsx)("span",{className:"cy-board-date",children:e.date})]})]})},e.id))})]})}function K({limit:e}){let i="number"==typeof e?T.slice(0,e):T;return(0,t.jsx)("div",{className:"cy-guestbook-list",children:i.map(e=>(0,t.jsxs)("div",{className:"cy-guestbook-item",children:[(0,t.jsxs)("span",{className:"cg-author",children:[e.author," ",(0,t.jsx)("span",{className:"cg-colon",children:":"})," "]}),(0,t.jsx)("span",{className:"cg-text",children:e.text}),(0,t.jsxs)("span",{className:"cg-date",children:["(",e.date,")"]})]},e.id))})}function Q(){return(0,t.jsxs)("div",{className:"cy-content-box",children:[(0,t.jsx)($,{title:"사진첩",sub:`미요 캐릭터 ${B.length}컷`}),(0,t.jsx)("ul",{className:"cy-photo-grid",children:B.map(e=>(0,t.jsx)("li",{className:"cy-photo-item",children:(0,t.jsx)("div",{className:"cy-photo-frame",children:(0,t.jsx)("img",{src:_(e.src),alt:e.name,loading:"lazy"})})},e.id))})]})}e.s(["default",0,function(){let[e,s]=(0,i.useState)("홈"),[o,a]=(0,i.useState)(!1);return((0,i.useEffect)(()=>{let e=new URLSearchParams(window.location.search).get("tab"),t=M.find(t=>t===e);t&&(s(t),a(!0))},[]),o)?(0,t.jsxs)("div",{className:"cy-root",children:[(0,t.jsx)("div",{className:"cy-background-pattern"}),(0,t.jsx)("div",{className:"cy-book-wrapper",children:(0,t.jsxs)("div",{className:"cy-book-outer",children:[(0,t.jsx)("div",{className:"cy-bindings",children:[1,2,3,4].map(e=>(0,t.jsx)("div",{className:"cy-ring"},e))}),(0,t.jsxs)("div",{className:"cy-book-inner",children:[(0,t.jsxs)("div",{className:"cy-left-panel",children:[(0,t.jsx)("div",{className:"cy-left-header",children:(0,t.jsxs)("span",{className:"cy-today-count",children:["TODAY ",(0,t.jsx)("span",{className:"text-orange",children:"23"})," | TOTAL ",(0,t.jsx)("span",{className:"text-black",children:"15392"})]})}),(0,t.jsxs)("div",{className:"cy-left-content",children:[(0,t.jsxs)("div",{className:"cy-today-is",children:["TODAY IS.. ",(0,t.jsx)("span",{className:"text-orange",children:"맑음 ☀️"})]}),(0,t.jsx)("div",{className:"cy-profile-pic",children:(0,t.jsx)("img",{src:_(S),alt:R})}),(0,t.jsx)("div",{className:"cy-intro-text",children:w}),(0,t.jsxs)("div",{className:"cy-profile-name",children:[(0,t.jsx)("div",{className:"name-bold",children:"미요Lab"}),(0,t.jsx)("div",{className:"title-sub",children:"미요앱 시리즈와 소개를 구경해보세요."})]}),(0,t.jsx)("div",{className:"cy-left-dropdown",children:(0,t.jsxs)("select",{value:"",onChange:e=>{let t=z.find(t=>t.id===e.target.value);t&&window.open(t.href,"_blank","noopener,noreferrer")},children:[(0,t.jsx)("option",{value:"",disabled:!0,children:"파도타기"}),z.map(e=>(0,t.jsx)("option",{value:e.id,children:e.label},e.id))]})})]})]}),(0,t.jsxs)("div",{className:"cy-right-panel",children:[(0,t.jsxs)("div",{className:"cy-right-header",children:[(0,t.jsx)("span",{className:"cy-title",children:H[e]}),(0,t.jsx)("span",{className:"cy-url",children:"http://cyworld.com/miyolab"})]}),(0,t.jsxs)("div",{className:"cy-right-content",children:["홈"===e&&(0,t.jsx)(X,{}),"프로필"===e&&(0,t.jsx)(G,{}),"미요툰"===e&&(0,t.jsx)(Y,{}),"미요앱"===e&&(0,t.jsx)(q,{}),"사진첩"===e&&(0,t.jsx)(Q,{})]})]}),(0,t.jsx)("div",{className:"cy-tabs",children:M.map(i=>(0,t.jsx)("button",{className:"cy-tab-btn "+(e===i?"active":""),onClick:()=>s(i),children:(0,t.jsx)("span",{className:"cy-tab-line",children:i})},i))})]})]})})]}):(0,t.jsx)(O,{onBrowse:()=>a(!0)})}],36574)}]);