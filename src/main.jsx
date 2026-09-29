import React, { Suspense, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { Float, Line, OrbitControls, Stars } from '@react-three/drei'
import { motion } from 'framer-motion'
import { ArrowRight, Bot, BriefcaseBusiness, CheckCircle2, ChevronRight, Gauge, MessageCircleMore, Network, ShieldCheck, Sparkles } from 'lucide-react'
import './styles.css'

const nodes=[
 ['Adquisición',[-2.8,1.1,0]],
 ['Conversión',[-1.3,2.2,0.4]],
 ['Operación',[1.2,2.1,-0.2]],
 ['Experiencia',[2.7,0.7,0.3]],
 ['Retención',[1.5,-1.5,-0.1]],
 ['Inteligencia',[-1.6,-1.6,0.2]],
]
function NeuralSystem(){
 const points=useMemo(()=>[...nodes.map(n=>n[1]),nodes[0][1]],[])
 return <Canvas camera={{position:[0,0,8],fov:48}} dpr={[1,1.5]}>
  <ambientLight intensity={.35}/><pointLight position={[0,0,5]} intensity={25} distance={10}/>
  <Stars radius={30} depth={20} count={300} factor={1.2} saturation={0} fade speed={.25}/>
  <Line points={points} color="#c79a57" lineWidth={1.5} transparent opacity={.55}/>
  {nodes.map(([label,pos],i)=><Float key={label} speed={1+i*.08} rotationIntensity={.14} floatIntensity={.28}>
   <mesh position={pos}><sphereGeometry args={[.24,32,32]}/><meshStandardMaterial color="#e6c28a" emissive="#9b6a2e" emissiveIntensity={2.1} metalness={.6} roughness={.2}/></mesh>
   <mesh position={pos} scale={1.75}><sphereGeometry args={[.24,20,20]}/><meshBasicMaterial color="#b98743" transparent opacity={.08}/></mesh>
  </Float>)}
  <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={.2} maxPolarAngle={Math.PI*.68} minPolarAngle={Math.PI*.32}/>
 </Canvas>
}
const intents=[
 {title:'Quiero crecer sin multiplicar el caos',desc:'Detectamos dónde crear capacidad, conversión o retención.',icon:Gauge},
 {title:'Quiero construir un empleado digital',desc:'Diseñamos un agente con la identidad, reglas y sistemas de tu empresa.',icon:Bot},
]
function App(){
 const [active,setActive]=useState(null)
 const [agentStep,setAgentStep]=useState(0)
 const [role,setRole]=useState('Ventas')
 const [tone,setTone]=useState('Directa y cálida')
 return <div className="app">
  <header className="nav"><div className="brand">CATALINA JARAMILLO</div><nav><a href="#sistema">Sistema</a><a href="#agentes">AI Employees</a><a href="#casos">Casos</a><a className="navCta" href="#diagnostico">Descubrir oportunidades</a></nav></header>
  <main>
   <section className="hero">
    <div className="heroGlow"/>
    <motion.div className="heroCopy" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.8}}>
      <div className="eyebrow">AI COMMERCE · PRODUCT · GROWTH</div>
      <h1>Tu empresa ya evolucionó.<br/><span>¿Tu forma de operar evolucionó con ella?</span></h1>
      <p className="lead">Diseño sistemas que conectan estrategia, ventas, experiencia del cliente, operaciones e inteligencia artificial para convertir negocios complejos en operaciones más simples, medibles y rentables.</p>
      <div className="actions"><a className="btn primary" href="#diagnostico">Descubrir oportunidades <ArrowRight size={18}/></a><a className="btn ghost" href="#agentes">Construir un empleado digital</a></div>
      <div className="proof"><span>15+ años en ventas y negocios</span><span>+9.000 órdenes digitales operadas</span><span>Creadora de LAURA</span></div>
    </motion.div>
    <div className="heroVisual"><NeuralSystem/><div className="visualLabel">BUSINESS NEURAL SYSTEM<div>6 sistemas · 1 operación conectada</div></div></div>
   </section>

   <section className="transition"><p>Crecer no debería significar multiplicar la complejidad.</p></section>

   <section id="diagnostico" className="section">
    <div className="sectionHead"><span>EMPEZAMOS POR TU OBJETIVO</span><h2>No empiezo preguntándote qué IA quieres.</h2><p>Empiezo entendiendo qué quieres conseguir y dónde tu negocio necesita más capacidad.</p></div>
    <div className="intentGrid">{intents.map((x,i)=>{const Icon=x.icon;return <button key={x.title} onClick={()=>setActive(i)} className={"intentCard "+(active===i?'active':'')}><Icon/><div><h3>{x.title}</h3><p>{x.desc}</p></div><ChevronRight/></button>})}</div>
    {active!==null&&<motion.div className="advisor" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}><div className="advisorBadge"><Sparkles size={15}/> Asesora digital de Catalina</div><p className="advisorText">{active===0?'¿Qué te gustaría conseguir en tu negocio en los próximos 90 días que hoy te está costando demasiado tiempo, dinero o capacidad?':'¿Qué proceso de tu negocio te gustaría que pudiera funcionar mejor incluso cuando tu equipo no está conectado?'}</p><div className="quickReplies"><button>Vender más</button><button>Responder más rápido</button><button>Reducir trabajo manual</button><button>Mejorar seguimiento</button></div><small>La experiencia completa se conecta a datos reales en la siguiente fase.</small></motion.div>}
   </section>

   <section id="sistema" className="section systemSection">
    <div className="sectionHead"><span>EL SISTEMA DE TU NEGOCIO</span><h2>No optimizo piezas aisladas. Diseño cómo trabajan juntas.</h2></div>
    <div className="sixGrid">{nodes.map(([n],i)=><div className="nodeCard" key={n}><span>0{i+1}</span><h3>{n}</h3><p>{['Cómo llegan oportunidades correctas.','Cómo una conversación se convierte en decisión.','Cómo fluye el trabajo después de vender.','Cómo se siente cada interacción.','Cómo vuelven, recompran o recomiendan.','Cómo sabes qué está funcionando y qué cambiar.'][i]}</p></div>)}</div>
   </section>

   <section id="agentes" className="section agentBuilder">
    <div className="sectionHead"><span>AI EMPLOYEES</span><h2>Tu agente, con la identidad de TU empresa.</h2><p>No instalamos una personalidad genérica encima de tu negocio. Diseñamos cómo debe pensar, hablar, actuar y escalar dentro de tus reglas.</p></div>
    <div className="builderGrid"><div className="builderPanel">
      <label>Rol</label><div className="chips">{['Ventas','Recepción','Customer Experience','Operaciones'].map(x=><button className={role===x?'selected':''} onClick={()=>setRole(x)} key={x}>{x}</button>)}</div>
      <label>Personalidad</label><div className="chips">{['Directa y cálida','Elegante','Técnica','Cercana'].map(x=><button className={tone===x?'selected':''} onClick={()=>setTone(x)} key={x}>{x}</button>)}</div>
      <label>Qué puede hacer</label><ul className="capabilities"><li><CheckCircle2/>Consultar contexto autorizado</li><li><CheckCircle2/>Responder y calificar</li><li><CheckCircle2/>Ejecutar acciones permitidas</li><li><CheckCircle2/>Escalar a una persona</li></ul>
    </div><div className="conversation">
      <div className="conversationTop"><div className="avatar">AI</div><div><strong>Agente de {role}</strong><span>{tone}</span></div></div>
      <div className="bubble user">Hola, estoy comparando opciones pero todavía no sé cuál me conviene.</div>
      <div className="bubble ai">{role==='Ventas'?'Antes de recomendarte algo, quiero entender una cosa: ¿qué resultado te importa más ahora mismo, crecer más rápido o reducir la carga de tu equipo?':'Claro. Primero voy a ubicar qué necesitas y qué puedo resolver directamente. Si hace falta criterio humano, te conecto con la persona correcta.'}</div>
      <div className="liveTag">PERSONALIDAD · CONTEXTO · REGLAS · HANDOFF HUMANO</div>
    </div></div>
   </section>

   <section className="section lifecycle"><div className="sectionHead"><span>CÓMO TRABAJAMOS</span><h2>DIAGNOSE → DESIGN → DEPLOY → PROVE → EVOLVE</h2></div><div className="lifeGrid">{[['01','Diagnose','Entendemos objetivo, proceso, fricción y baseline.'],['02','Design','Diseñamos sistema, agente o automatización correcta.'],['03','Deploy','Implementamos con límites, contexto y handoff.'],['04','Prove','Medimos capacidad, errores, velocidad y resultados.'],['05','Evolve','Mejoramos con evidencia, no con suposiciones.']].map(([n,t,d])=><div className="lifeCard"><b>{n}</b><h3>{t}</h3><p>{d}</p></div>)}</div></section>

   <section id="casos" className="section cases"><div className="sectionHead"><span>CASOS REALES DE CONSTRUCCIÓN</span><h2>Experiencia operando, no solo recomendando.</h2></div><div className="caseGrid">
    <article><div className="caseIcon"><BriefcaseBusiness/></div><h3>Professional Glam</h3><p>Como fundadora-operadora, dirigí un ecosistema DTC que registra más de COP 1.000 millones en ventas Shopify y 9.296 órdenes digitales.</p><div className="caseTags"><span>Ecommerce</span><span>Ventas</span><span>CX</span><span>Operación</span></div></article>
    <article><div className="caseIcon"><Network/></div><h3>LAURA</h3><p>Sistema modular de comercio con IA diseñado para conectar ventas, WhatsApp, pedidos, postventa, operación, inteligencia y seguimiento.</p><div className="caseTags"><span>AI Commerce</span><span>Agents</span><span>Operations</span></div></article>
    <article><div className="caseIcon"><ShieldCheck/></div><h3>Sin Autosabotaje</h3><p>Producto digital longitudinal basado en evidencia, diseñado alrededor de diagnóstico, memoria, intervención, acción y medición de cambio.</p><div className="caseTags"><span>Product</span><span>AI UX</span><span>Systems</span></div></article>
   </div></section>

   <section className="finalCta"><span>NO NECESITAS “PONER IA”.</span><h2>Necesitas saber dónde realmente puede darte más capacidad.</h2><p>Primero entendemos qué quieres conseguir. Después decidimos si necesitas un agente, una automatización, un rediseño o nada de eso.</p><a className="btn primary" href="#diagnostico">Descubrirlo <ArrowRight size={18}/></a></section>
  </main>
  <footer><div>CATALINA JARAMILLO</div><div>AI Commerce · Product · Growth Strategist</div><div>© 2026</div></footer>
 </div>
}
createRoot(document.getElementById('root')).render(<Suspense fallback={null}><App/></Suspense>)
