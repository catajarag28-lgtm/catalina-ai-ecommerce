// Escena WebGL del hero: "el sistema nervioso de tu empresa".
// Se importa dinámicamente (chunk propio) desde Hero3D.jsx; devuelve una función dispose().
import * as THREE from 'three'

const GOLD = new THREE.Color('#d9b57e')
const IVORY = new THREE.Color('#f3e6cf')
const AGENTS = ['VENTAS', 'ATENCIÓN', 'OPERACIÓN', 'FINANZAS', 'MARKETING', 'CONTROL', 'POSTVENTA', 'DATOS']

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,241,214,1)'); r.addColorStop(0.18, 'rgba(236,200,140,.85)'); r.addColorStop(0.45, 'rgba(200,150,80,.25)'); r.addColorStop(1, 'rgba(200,150,80,0)')
  g.fillStyle = r; g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

function labelTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96
  const g = c.getContext('2d')
  g.font = '600 34px Manrope, "DM Sans", sans-serif'
  if ('letterSpacing' in g) g.letterSpacing = '9px'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 14
  g.fillStyle = 'rgba(243,230,207,.92)'; g.fillText(text, 256, 50)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t
}

function fibonacciSphere(n, radius) {
  const pos = new Float32Array(n * 3), rnd = new Float32Array(n)
  const phi = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = phi * i
    const jitter = radius * (0.92 + Math.random() * 0.16)
    pos.set([Math.cos(th) * r * jitter, y * jitter, Math.sin(th) * r * jitter], i * 3)
    rnd[i] = Math.random()
  }
  return { pos, rnd }
}

export function createHeroScene(container, { anchor, mobile, onFirstFrame }) {
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x111110, 0.035)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120)
  camera.position.set(0, 0, 16)

  const disposables = []
  const track = o => (disposables.push(o), o)
  const glow = track(glowTexture())

  // Sistema: todo lo que orbita se ancla al centro de la tarjeta de Carolina (o a un punto fijo en móvil).
  const anchorGroup = new THREE.Group(); scene.add(anchorGroup)
  const system = new THREE.Group(); anchorGroup.add(system)

  // Núcleo: esfera de partículas que respira (shader propio).
  const { pos, rnd } = fibonacciSphere(mobile ? 1400 : 3000, 1.9)
  const coreGeo = track(new THREE.BufferGeometry())
  coreGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  coreGeo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1))
  const coreMat = track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uGold: { value: GOLD }, uIvory: { value: IVORY } },
    vertexShader: `
      attribute float aRand; uniform float uTime; uniform float uPR; varying float vR; varying float vDepth;
      void main(){
        vR = aRand;
        float breathe = 1.0 + 0.07*sin(uTime*1.1 + aRand*6.2831) + 0.035*sin(uTime*0.55);
        vec3 p = position * breathe;
        p += normalize(position) * 0.12 * sin(uTime*2.0 + position.y*3.0 + aRand*4.0);
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        vDepth = -mv.z;
        gl_PointSize = (2.2 + aRand*3.2) * uPR * (14.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uGold; uniform vec3 uIvory; varying float vR; varying float vDepth;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(uGold, uIvory, vR*0.8);
        gl_FragColor = vec4(col, a * (0.35 + vR*0.55));
      }`,
  }))
  const core = new THREE.Points(coreGeo, coreMat); system.add(core)
  const coreGlowMat = track(new THREE.SpriteMaterial({ map: glow, color: 0xe9c58f, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }))
  const coreGlow = new THREE.Sprite(coreGlowMat); coreGlow.scale.setScalar(10); system.add(coreGlow)

  // Anillos inclinados donde orbitan los agentes.
  const rings = [
    { r: 3.7, tilt: new THREE.Euler(1.18, 0.1, 0.35), speed: 0.16 },
    { r: 4.6, tilt: new THREE.Euler(1.42, -0.2, -0.55), speed: -0.11 },
    { r: 5.5, tilt: new THREE.Euler(1.02, 0.35, 0.95), speed: 0.08 },
  ]
  const ringMat = track(new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.22, depthWrite: false }))
  for (const ring of rings) {
    const pts = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * ring.r, Math.sin(a) * ring.r, 0)) }
    const geo = track(new THREE.BufferGeometry().setFromPoints(pts))
    const line = new THREE.LineLoop(geo, ringMat); line.rotation.copy(ring.tilt); system.add(line)
    ring.object = line
  }

  // Nodos-agente + conexiones con pulsos de luz.
  const nodeGeo = track(new THREE.SphereGeometry(0.13, 20, 20))
  const nodeMat = track(new THREE.MeshBasicMaterial({ color: IVORY }))
  const lineMat = track(new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.16, depthWrite: false }))
  const pulseMat = track(new THREE.SpriteMaterial({ map: glow, color: 0xffe2b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
  const nodes = AGENTS.map((name, i) => {
    const ring = rings[i % rings.length]
    const group = new THREE.Group(); system.add(group)
    group.add(new THREE.Mesh(nodeGeo, nodeMat))
    const halo = new THREE.Sprite(pulseMat); halo.scale.setScalar(1.1); group.add(halo)
    const labelTex = track(labelTexture(name))
    const labelMat = track(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false, opacity: mobile ? 0 : 0.95 }))
    const label = new THREE.Sprite(labelMat); label.scale.set(2.6, 0.49, 1); label.position.set(0, 0.55, 0); group.add(label)
    const lineGeo = track(new THREE.BufferGeometry()); lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const link = new THREE.Line(lineGeo, lineMat); system.add(link)
    const pulses = [0, 0.5].map(offset => { const s = new THREE.Sprite(pulseMat); s.scale.setScalar(0.42); system.add(s); return { s, offset } })
    return { ring, angle: (i / AGENTS.length) * Math.PI * 2 + i * 0.7, group, label, link, pulses, inbound: i % 2 === 0, speed: 0.25 + (i % 3) * 0.08 }
  })

  // Polvo dorado en profundidad.
  const dustCount = mobile ? 700 : 1600
  const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) dustPos.set([(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 34, -Math.random() * 40 + 8], i * 3)
  const dustGeo = track(new THREE.BufferGeometry()); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dustMat = track(new THREE.PointsMaterial({ map: glow, color: 0xd9b57e, size: 0.16, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }))
  const dust = new THREE.Points(dustGeo, dustMat); scene.add(dust)

  // Composición: el sistema se centra detrás de la tarjeta de Carolina en escritorio.
  const tmp = new THREE.Vector3(), labelPos = new THREE.Vector3()
  // En coordenadas de pantalla (-1 izquierda, 1 derecha): el titular ocupa hasta ~x=0; opacidad plena desde ~x=0.12.
  const LABEL_FADE_FROM = -0.05, LABEL_FADE_SPAN = 0.17
  function layout() {
    const w = container.clientWidth, h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h; camera.updateProjectionMatrix()
    const rect = container.getBoundingClientRect()
    // Móvil: el núcleo vive en la esquina superior derecha, detrás del titular y atenuado por CSS.
    let nx = 0.62, ny = 0.5, scale = 0.55
    if (anchor && !mobile) {
      // El núcleo asoma por la esquina superior izquierda de la tarjeta; los anillos la envuelven.
      const a = anchor.getBoundingClientRect()
      nx = ((a.left + a.width * 0.12 - rect.left) / w) * 2 - 1
      ny = -(((a.top + a.height * 0.06 - rect.top) / h) * 2 - 1)
      scale = Math.min(0.9, Math.max(0.65, a.width / 640))
    }
    tmp.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize()
    const dist = -camera.position.z / tmp.z
    anchorGroup.position.copy(camera.position).addScaledVector(tmp, dist)
    anchorGroup.scale.setScalar(scale)
  }

  // Interacción: parallax con mouse y scroll; en móvil rotación automática lenta.
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  const onPointer = e => { pointer.tx = (e.clientX / window.innerWidth) * 2 - 1; pointer.ty = (e.clientY / window.innerHeight) * 2 - 1 }
  if (!mobile) window.addEventListener('pointermove', onPointer, { passive: true })
  const onResize = () => layout()
  window.addEventListener('resize', onResize)
  const ro = new ResizeObserver(layout); ro.observe(container); if (anchor) ro.observe(anchor)

  // Ciclo de render que se pausa fuera de pantalla o con la pestaña oculta.
  let visible = true, raf = 0, last = performance.now(), time = 0, first = true, stopped = false
  const stats = (window.__hero3d = { frames: 0, running: false })
  function frame(now) {
    raf = 0
    if (stopped || !visible || document.hidden) { stats.running = false; return }
    stats.running = true
    const work0 = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt
    coreMat.uniforms.uTime.value = time
    coreGlow.material.opacity = 0.48 + Math.sin(time * 1.1) * 0.1
    core.rotation.y += dt * 0.12; core.rotation.x = Math.sin(time * 0.2) * 0.2

    pointer.x += (pointer.tx - pointer.x) * 0.045; pointer.y += (pointer.ty - pointer.y) * 0.045
    const scroll = Math.min(1.5, window.scrollY / Math.max(1, window.innerHeight))
    system.rotation.y = (mobile ? time * 0.12 : pointer.x * 0.42) + scroll * 0.6
    system.rotation.x = (mobile ? Math.sin(time * 0.15) * 0.12 : pointer.y * 0.22) + scroll * 0.35
    system.position.z = -scroll * 4
    camera.position.x = pointer.x * 0.6; camera.position.y = -pointer.y * 0.35

    for (const ring of rings) ring.object.rotation.z += dt * ring.speed * 0.25
    for (const n of nodes) {
      n.angle += dt * n.ring.speed
      n.group.position.set(Math.cos(n.angle) * n.ring.r, Math.sin(n.angle) * n.ring.r, 0).applyEuler(n.ring.object.rotation)
      // Las etiquetas se desvanecen al entrar en la columna del titular para no pisar el texto.
      if (!mobile) { n.label.getWorldPosition(labelPos).project(camera); n.label.material.opacity = 0.95 * Math.min(1, Math.max(0, (labelPos.x - LABEL_FADE_FROM) / LABEL_FADE_SPAN)) }
      const arr = n.link.geometry.attributes.position.array
      arr[3] = n.group.position.x; arr[4] = n.group.position.y; arr[5] = n.group.position.z
      n.link.geometry.attributes.position.needsUpdate = true
      for (const p of n.pulses) {
        let t = ((time * n.speed + p.offset) % 1); if (n.inbound) t = 1 - t
        p.s.position.copy(n.group.position).multiplyScalar(t)
        const fade = Math.sin(t * Math.PI); p.s.scale.setScalar(0.18 + fade * 0.34)
      }
    }
    dust.rotation.y = time * 0.01; dust.position.y = Math.sin(time * 0.1) * 0.4

    renderer.render(scene, camera)
    stats.frames++
    stats.ms = stats.ms ? stats.ms * 0.9 + (performance.now() - work0) * 0.1 : performance.now() - work0
    if (first) { first = false; onFirstFrame?.() }
    raf = requestAnimationFrame(frame)
  }
  const start = () => { if (!raf && !stopped && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame) } }
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; start() }, { threshold: 0 })
  io.observe(container)
  const onVis = () => start()
  document.addEventListener('visibilitychange', onVis)
  const onLost = e => { e.preventDefault(); stopped = true }
  renderer.domElement.addEventListener('webglcontextlost', onLost)

  layout(); start()

  return function dispose() {
    stopped = true; if (raf) cancelAnimationFrame(raf)
    io.disconnect(); ro.disconnect()
    window.removeEventListener('pointermove', onPointer); window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVis)
    renderer.domElement.removeEventListener('webglcontextlost', onLost)
    for (const d of disposables) d.dispose?.()
    renderer.dispose()
    renderer.domElement.remove()
    stats.running = false
  }
}
