import React,{Suspense,useMemo,useState,useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import {Canvas} from '@react-three/fiber'
import {Float,Line,OrbitControls,Text} from '@react-three/drei'
import {motion} from 'framer-motion'
import {ArrowRight,Workflow,Bot,BrainCircuit,Network,ShoppingBag,BarChart3,Users,Settings2,MessageCircleMore,CheckCircle2,BriefcaseBusiness,ShieldCheck,Sparkles} from 'lucide-react'
import './styles.css'
import CarolinaExperience from './components/CarolinaExperience'

const companyNodes=[
 ['Growth',[-2.8,1.2,0]],['Ventas',[-1.35,2.25,.35]],['Clientes',[1.25,2.15,-.15]],
 ['Operaciones',[2.85,.65,.25]],['Equipo',[1.65,-1.55,-.1]],['Información',[-.15,-2.25,.15]],['Dirección',[-2.05,-1.35,.2]]
]
function Company3D(){
 const [active,setActive]=useState('TU EMPRESA')
 return <div className="world"><Canvas camera={{position:[0,0,8],fov:46}} dpr={[1,1.5]}>
  <ambientLight intensity={2.4}/><directionalLight position={[3,4,5]} intensity={3.4}/>
  {companyNodes.map(([label,pos],i)=><React.Fragment key={label}>
   <Line points={[[0,0,0],pos]} color={active===label?'#8d632f':'#c7a77e'} lineWidth={active===label?3:1.2} transparent opacity={active===label?.95:.42}/>
   <Float speed={1+i*.04} rotationIntensity={.06} floatIntensity={.18}><group position={pos} onClick={()=>setActive(label)}>
    <mesh scale={active===label?1.28:1}><sphereGeometry args={[.3,32,32]}/><meshStandardMaterial color={active===label?'#d4aa70':'#f4e7d4'} emissive="#b9884d" emissiveIntensity={active===label?.7:.25} metalness={.48} roughness={.12}/></mesh>
    <Text position={[0,-.55,0]} fontSize={.18} color="#55483c" anchorX="center">{label}</Text>
   </group></Float>
  </React.Fragment>)}
  <Float speed={.7} rotationIntensity={.12}><mesh onClick={()=>setActive('TU EMPRESA')}><torusGeometry args={[.66,.18,32,96,4.8]}/><meshPhysicalMaterial color="#f7ead7" metalness={.72} roughness={.08} clearcoat={1}/></mesh></Float>
  <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={.22}/>
 </Canvas><div className="worldState"><span>EXPLORA EL SISTEMA</span><b>{active}</b><small>Toca una zona. La empresa responde.</small></div></div>
}
const services=[
 {icon:Workflow,title:'Automatizaciones & flujos',price:'Incluidas según alcance',text:'Conectamos tareas y herramientas para que procesos repetitivos ocurran sin depender de trabajo manual.',tags:'Workflows · APIs · CRM · reportes · alertas'},
 {icon:Bot,title:'Agentes de IA',price:'Desde USD 2.800',text:'Ventas, recepción, atención, citas, seguimiento, operaciones o asistencia ejecutiva.',tags:'Contexto · herramientas · acciones · handoff'},
 {icon:BrainCircuit,title:'IA personalizada',price:'Desde USD 2.800',text:'Un agente diseñado alrededor de tu empresa: personalidad, conocimiento, reglas, permisos y forma de trabajar.',tags:'Nada genérico · español/inglés · memoria autorizada'},
 {icon:BarChart3,title:'Estrategia & Growth',price:'Desde diagnóstico / cotización',text:'Oferta, adquisición, Meta Ads, conversión, funnels, ecommerce, CRM, retención y crecimiento.',tags:'Estrategia · CRO · growth · customer journey'},
 {icon:ShoppingBag,title:'Ecommerce & operaciones',price:'Desde USD 3.000',text:'Shopify, WhatsApp, pedidos, clientes, seguimiento, integraciones y operación conectada.',tags:'Commerce · CX · fulfillment · automatización'},
 {icon:Network,title:'Sistemas multiagente / Business OS',price:'Desde USD 7.500',text:'Varios agentes, automatizaciones, datos, herramientas y personas coordinados alrededor de la empresa.',tags:'Ventas · CX · operaciones · growth · dirección'},
 {icon:Users,title:'Equipo & conocimiento',price:'Según alcance',text:'SOP, onboarding, búsqueda interna, asistentes de conocimiento y menos dependencia de personas clave.',tags:'Knowledge · SOP · training · soporte interno'},
 {icon:Settings2,title:'Producto & sistemas digitales',price:'Según alcance',text:'Estrategia de producto, journeys, experiencia, definición funcional y dirección de construcción con IA.',tags:'Product strategy · AI UX · sistemas'}
]
const pains=[
 ['Todo termina dependiendo de mí.','Podemos revisar decisiones, conocimiento, aprobaciones y procesos que todavía dependen del dueño.'],
 ['Mi equipo hace tareas repetitivas todos los días.','Primero buscamos qué puede simplificarse o automatizarse sin agregar IA innecesaria.'],
 ['Tengo herramientas, pero no trabajan juntas.','Diseñamos flujos e integraciones para que la información se mueva sin copiar y pegar.'],
 ['Mi equipo pregunta siempre lo mismo.','Podemos convertir conocimiento disperso en un sistema útil para las personas.'],
 ['No sé realmente qué está pasando en mi empresa.','Consolidamos señales, reportes y alertas para mejorar visibilidad y decisiones.'],
 ['Quiero crecer, pero no quiero duplicar el caos.','Modelamos qué proceso se saturaría primero y dónde crear capacidad.'],
 ['Tengo oportunidades, pero algo se pierde en el camino.','Revisamos adquisición, respuesta, conversión, seguimiento, oferta y retención antes de culpar a un solo punto.'],
 ['Quiero crear algo nuevo con IA.','Aterrizamos la idea en producto, experiencia, arquitectura funcional y una ruta de construcción.']
]
const levels=[
 ['Chatbot','Responde y guía principalmente por reglas, menús o caminos definidos.'],
 ['Flujo automatizado','Cuando ocurre A, ejecuta B, C y D. No necesita IA para ser valioso.'],
 ['Automatización inteligente','Un flujo usa IA en puntos concretos para interpretar, clasificar o resumir.'],
 ['Agente con IA','Comprende contexto y usa herramientas para actuar dentro de permisos definidos.'],
 ['Agente personalizado','Tiene la identidad, conocimiento, procesos, límites y personalidad de tu empresa.'],
 ['Sistema multiagente','Varios especialistas coordinados alrededor de diferentes funciones.'],
 ['AI Business OS','Personas, agentes, automatizaciones, datos y herramientas operando como un sistema.']
]
const prices=[
 ['Agente humanizado de ventas y citas','USD 2.800 + USD 450/mes','Atención bilingüe, calificación, agenda, seguimiento y handoff humano.'],
 ['Agente de ventas, CRM y seguimiento','USD 4.500 + USD 750/mes','Agente comercial conectado con CRM, seguimiento y procesos autorizados.'],
 ['AI Commerce Operations System','USD 7.500+ + mantenimiento','Ventas, clientes, ecommerce y operación coordinados en una arquitectura a medida.'],
 ['Diagnóstico estratégico','Por cotización','Diagnóstico pagado; su valor puede descontarse del proyecto si avanzamos a implementación.']
]
function InteractiveSystemDemo({onConsult}){
 const modes={
  'FLUJO':{title:'Un flujo ejecuta.',sub:'Una señal activa una secuencia predefinida.',nodes:['SOLICITUD','VALIDAR','CRM','CONFIRMAR','EQUIPO']},
  'CHATBOT':{title:'Un chatbot responde y guía.',sub:'Trabaja muy bien cuando existen caminos definidos.',nodes:['CLIENTE','MENÚ','INFORMACIÓN','AGENDAR','HUMANO']},
  'AGENTE IA':{title:'Un agente entiende y actúa.',sub:'Interpreta contexto, consulta herramientas y actúa dentro de permisos.',nodes:['INTENCIÓN','CONTEXTO','CONOCIMIENTO','ACCIÓN','HUMANO']},
  'TU AGENTE':{title:'Tu empleado digital.',sub:'Diseñado con la identidad, conocimiento, permisos y límites de tu empresa.',nodes:['TU MARCA','PERSONALIDAD','CONOCIMIENTO','PERMISOS','ACCIONES']},
  'BUSINESS OS':{title:'Un sistema los coordina.',sub:'Agentes, automatizaciones, datos y personas trabajando como una arquitectura.',nodes:['VENTAS AI','CX AI','OPS AI','KNOWLEDGE AI','CONTROL TOWER']}
 }
 const [mode,setMode]=useState('FLUJO'),[step,setStep]=useState(0),[playing,setPlaying]=useState(true)
 const data=modes[mode]
 useEffect(()=>{setStep(0);setPlaying(true)},[mode])
 useEffect(()=>{if(!playing)return;const id=setInterval(()=>setStep(v=>(v+1)%data.nodes.length),1050);return()=>clearInterval(id)},[playing,data.nodes.length])
 return <section className={"section systemCinema mode-"+mode.replaceAll(' ','-')}>
  <div className="sectionHead"><span>EXPERIENCIA INTERACTIVA · NO SOLO TE LO CONTAMOS</span><h2>Mira cómo trabaja cada sistema.</h2><p>Toca una arquitectura y observa qué ocurre dentro. Así puedes entender qué necesitas antes de comprar tecnología.</p></div>
  <div className="cinemaTabs">{Object.keys(modes).map(k=><button key={k} className={mode===k?'active':''} onClick={()=>setMode(k)}>{k}</button>)}</div>
  <div className="cinemaStage">
   <div className="stageAtmosphere"/><div className="stageGrid"/>
   <div className="stageHeader"><span>SIMULACIÓN EN VIVO</span><button onClick={()=>setPlaying(v=>!v)}>{playing?'PAUSAR':'REPRODUCIR'}</button></div>
   <div className="signalTrack">{data.nodes.map((n,i)=><React.Fragment key={n}><div className={"signalNode "+(i===step?'hot':'')+(i<step?' done':'')}><i>{String(i+1).padStart(2,'0')}</i><b>{n}</b>{i===step&&<small>ACTIVO</small>}</div>{i<data.nodes.length-1&&<div className={"signalLine "+(i<step?'lit':'')}><span/></div>}</React.Fragment>)}</div>
   <div className="stageStory">
    <div className="stagePhone"><span>CLIENTE</span><p>{mode==='CHATBOT'?'“Quiero agendar una cita.”':mode==='FLUJO'?'Nueva solicitud recibida':mode==='BUSINESS OS'?'La empresa recibe una nueva oportunidad':mode==='TU AGENTE'?'“Necesito ayuda, pero quiero hablar como habla mi marca.”':'“Quiero comprar, pero primero revisa mi pedido anterior.”'}</p></div>
    <div className="stageBrain"><div className="brainOrb"><b>{mode==='TU AGENTE'?'TU AI':mode==='BUSINESS OS'?'OS':'AI'}</b></div><span>{data.nodes[step]}</span></div>
    <div className="stageAction"><span>RESULTADO</span><p>{mode==='FLUJO'?'La tarea avanza automáticamente.':mode==='CHATBOT'?'El usuario recibe una ruta y una respuesta.':mode==='AGENTE IA'?'Consulta, actúa o escala según sus permisos.':mode==='TU AGENTE'?'Responde y actúa con tus reglas, tono y conocimiento.':'Cada especialista actúa y Control Tower conserva supervisión.'}</p></div>
   </div>
  </div>
  <div className="cinemaCaption"><div><span>{mode}</span><h3>{data.title}</h3><p>{data.sub}</p></div><button onClick={onConsult}>¿Cómo funcionaría en mi empresa? <ArrowRight size={17}/></button></div>
 </section>
}
function App(){
 const [showCarolina,setShowCarolina]=useState(false)
 const [heroScene,setHeroScene]=useState(0)
 const heroSteps=[
  {k:'TU EMPRESA',t:'Una empresa es un sistema.',d:'Ventas, clientes, operaciones, equipo, información y dirección necesitan trabajar como una sola arquitectura.'},
  {k:'FRICCIÓN',t:'La complejidad aparece.',d:'Tareas manuales, información aislada y decisiones que dependen siempre de las mismas personas.'},
  {k:'AUTOMATIZACIÓN',t:'El proceso empieza a ejecutarse.',d:'Conectamos solicitudes, validaciones, sistemas, aprobaciones, acciones y reportes.'},
  {k:'CHATBOT',t:'Responder no siempre es suficiente.',d:'Un chatbot guía y responde. Es útil cuando el problema realmente se resuelve con reglas y caminos definidos.'},
  {k:'AGENTE IA',t:'Ahora hay contexto y capacidad de actuar.',d:'Comprende la intención, consulta conocimiento y herramientas y ejecuta acciones dentro de permisos.'},
  {k:'TU AGENTE',t:'La IA adopta la forma de tu empresa.',d:'Nombre, rol, personalidad, idioma, conocimiento, permisos, límites y escalamiento humano.'},
  {k:'MULTIAGENTE',t:'Especialistas coordinados.',d:'Ventas, servicio, operaciones, conocimiento, growth e inteligencia ejecutiva pueden colaborar.'},
  {k:'BUSINESS OS',t:'La empresa funciona como un sistema.',d:'Personas, agentes, automatizaciones, datos y herramientas coordinados con supervisión humana.'}
 ]
 useEffect(()=>{const id=setInterval(()=>setHeroScene(v=>(v+1)%heroSteps.length),3600);return()=>clearInterval(id)},[])
 const [role,setRole]=useState('Asesora comercial'),[tone,setTone]=useState('Cálida y ejecutiva')
 return <div className="app">
  <header className="nav"><a className="brand" href="#">CATALINA JARAMILLO</a><nav><a href="#servicios">Servicios</a><a href="#como-funciona">Qué construimos</a><a href="#precios">Precios</a><a href="#perfil">Perfil</a><a className="navCta" href="#descubrir">Descubrir qué necesita mi empresa</a></nav></header>
  <main>
   <section className={"hero cinematic scene-"+heroScene}>
    <div className="cinematicBg">
      <div className="filmGlow g1"/><div className="filmGlow g2"/>
      <div className="cinematicWorld"><Company3D/></div>
      <div className="filmGrain"/>
    </div>
    <motion.div className="heroCopy cinematicCopy" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}}>
     <div className="eyebrow">CATALINA JARAMILLO · BUSINESS SYSTEMS · AI · GROWTH</div>
     <h1>Diseño empresas que pueden <span>crecer sin multiplicar su complejidad.</span></h1>
     <p className="lead"><b>Convierto ventas, atención, seguimiento y operaciones en sistemas inteligentes.</b> Diseño agentes humanizados y automatizaciones alrededor de la forma real de trabajar de cada empresa.</p>
     <div className="actions"><a className="btn primary" href="#descubrir">Haz tu primera asesoría <ArrowRight size={18}/></a><a className="btn ghost" href="#descubrir">Cuéntanos qué quieres conseguir</a></div>
     <div className="proof"><span>15+ años en negocio</span><span>+9.000 órdenes digitales operadas</span><span>Creadora de LAURA</span></div>
    </motion.div>
    <div className="sceneNarrative" aria-live="polite">
      <span>{String(heroScene+1).padStart(2,'0')+' · '+heroSteps[heroScene].k}</span>
      <b>{heroSteps[heroScene].t}</b>
      <p className="sceneDetail">{heroSteps[heroScene].d}</p><div className="sceneDots">{heroSteps.map((step,i)=><button key={step.k} aria-label={step.k} className={heroScene===i?'on':''} onClick={()=>setHeroScene(i)}><span>{step.k}</span></button>)}</div>
    </div>
    <div className="heroMicroDemo">
 <button onClick={()=>setHeroScene(4)}><b>AGENTE IA</b><span>Cliente pregunta → entiende → consulta → actúa → escala</span></button>
 <button onClick={()=>setHeroScene(5)}><b>TU AGENTE</b><span>Personalidad · conocimiento · idioma · permisos</span></button>
 <button onClick={()=>setHeroScene(7)}><b>BUSINESS OS</b><span>Agentes + automatización + datos + personas</span></button>
 </div><div className="scrollCue"><span>EXPLORA</span><i/></div>
   </section>

   <section className="painSection"><div className="sectionHead"><span>ANTES DE HABLAR DE TECNOLOGÍA</span><h2>¿Algo de esto está frenando a tu empresa?</h2><p>No todos los problemas son de ventas. No todos necesitan IA. Empezamos por entender qué está ocurriendo de verdad.</p></div><div className="painGrid">{pains.map(([t,d])=><article key={t}><h3>“{t}”</h3><p>{d}</p></article>)}</div><div className="scaleQuestion"><span>UNA PREGUNTA IMPORTANTE</span><h3>Si mañana tu volumen creciera 2×, ¿qué parte de tu empresa se saturaría primero?</h3><a href="#descubrir">Descubrirlo con Carolina <ArrowRight size={17}/></a></div></section>

   <section className="section verticalOffers"><div className="sectionHead"><span>SOLUCIONES CON RESULTADO CONCRETO</span><h2>No vendo un chatbot. Construyo capacidad para tu empresa.</h2><p>El agente aprende la personalidad, servicios, reglas, conocimiento y límites de tu negocio. Puede atender, calificar, agendar, hacer seguimiento y entregar la conversación a una persona cuando corresponde.</p></div><div className="offerShowcase"><article><span>CLÍNICAS & MED SPAS</span><h3>AI Concierge bilingüe</h3><p>Atención administrativa, financiación y promociones autorizadas, citas, recordatorios, seguimiento y reactivación. No diagnostica ni recomienda procedimientos clínicos.</p></article><article><span>FIRMAS & SERVICIOS PROFESIONALES</span><h3>AI Intake Agent</h3><p>Identifica la necesidad general, recopila información inicial, explica el proceso, agenda, hace seguimiento y escala la evaluación profesional al equipo humano.</p></article><article><span>ECOMMERCE & ALTO VALOR</span><h3>AI Sales + Operations</h3><p>Respuesta, calificación, CRM, seguimiento, recuperación de oportunidades y conexión con la operación.</p></article></div></section><section id="servicios" className="section immersiveServices"><div className="serviceWorld"><Company3D/></div><div className="sectionHead"><span>SERVICIOS</span><h2>¿Qué podemos hacer por tu empresa?</h2><p>Puedes empezar resolviendo una necesidad puntual o construir un sistema más completo. Cada solución se adapta al negocio.</p></div><div className="serviceGrid">{services.map(({icon:Icon,title,price,text,tags})=><article className="serviceCard" key={title}><Icon/><div className="servicePrice">{price}</div><h3>{title}</h3><p>{text}</p><small>{tags}</small><a href="#descubrir">¿Es para mi empresa? <ArrowRight size={14}/></a></article>)}</div></section>

   <div id="como-funciona"><InteractiveSystemDemo onConsult={()=>{setShowCarolina(true);setTimeout(()=>document.getElementById('descubrir')?.scrollIntoView({behavior:'smooth'}),60)}}/></div>

   <section className="section customAgent"><div className="sectionHead"><span>TU IA · NO LA NUESTRA</span><h2>Podemos construir una IA con la identidad de tu empresa.</h2><p>No instalamos una personalidad genérica. Diseñamos cómo debe hablar, qué sabe, qué puede hacer, qué no puede hacer y cuándo debe pasar a una persona.</p></div><div className="builderGrid"><div className="builderPanel"><label>Rol</label><div className="chips">{['Asesora comercial','Recepción','Servicio al cliente','Operaciones','Asistente ejecutivo'].map(x=><button className={role===x?'selected':''} onClick={()=>setRole(x)} key={x}>{x}</button>)}</div><label>Personalidad</label><div className="chips">{['Cálida y ejecutiva','Cercana','Elegante','Técnica'].map(x=><button className={tone===x?'selected':''} onClick={()=>setTone(x)} key={x}>{x}</button>)}</div><ul className="capabilities"><li><CheckCircle2/>Conoce tus productos, procesos y políticas</li><li><CheckCircle2/>Usa herramientas y acciones autorizadas</li><li><CheckCircle2/>Mantiene contexto dentro de tus reglas</li><li><CheckCircle2/>Escala excepciones a personas</li></ul></div><div className="conversation"><div className="conversationTop"><div className="avatar">AI</div><div><strong>{role}</strong><span>{tone} · personalizada para TU empresa</span></div></div><div className="bubble user">Necesito ayuda, pero no sé exactamente qué opción me conviene.</div><div className="bubble ai">Claro. Antes de recomendarte algo quiero entender qué quieres conseguir y qué está pasando hoy. Así no te ofrezco una solución que no necesitas.</div><div className="liveTag">IDENTIDAD · CONOCIMIENTO · MEMORIA · PERMISOS · ACCIONES · HANDOFF HUMANO</div></div></div></section>

   <section className="section osSection"><div className="osVisual"><Company3D/></div><div className="osCopy"><span>DE UNA TAREA A UN SISTEMA</span><h2>Puedes automatizar una tarea. O podemos conectar una empresa entera.</h2><p>Cuando un solo agente no basta, diseñamos sistemas donde ventas, clientes, operaciones, growth, conocimiento y dirección pueden trabajar con agentes especializados, automatizaciones y personas.</p><div className="controlTower"><b>CONTROL TOWER</b><span>Personas · permisos · métricas · alertas · excepciones · límites</span></div><a className="textLink" href="#descubrir">Explorar una arquitectura para mi empresa <ArrowRight size={16}/></a></div></section>

   <section className="section lauraDemo"><div className="sectionHead"><span>DEMO · LAURA</span><h2>Así se ve un agente cuando deja de ser “un bot”.</h2><p>Conversación + contexto + herramientas + acciones autorizadas + límites + intervención humana.</p></div><div className="lauraFlow"><div><span>01</span><b>ENTIENDE</b><p>Interpreta intención y conserva contexto.</p></div><div><span>02</span><b>CONSULTA</b><p>Usa conocimiento y datos autorizados.</p></div><div><span>03</span><b>ACTÚA</b><p>Ejecuta acciones permitidas y seguimiento.</p></div><div><span>04</span><b>ESCALA</b><p>Entrega excepciones a una persona.</p></div></div><div className="demoChat"><div className="bubble user">Quiero comprar, pero antes necesito saber si mi pedido anterior ya salió.</div><div className="bubble ai"><b>LAURA</b><br/>Puedo revisar primero tu pedido y mantener esta conversación en contexto. Si encuentro una excepción que requiere decisión humana, la paso al equipo con la información organizada.</div><div className="demoTools"><span>CONOCIMIENTO</span><span>SHOPIFY</span><span>WHATSAPP</span><span>OPERACIÓN</span><span>HANDOFF HUMANO</span></div></div></section><section id="descubrir" className="section carolinaSection immersiveCarolina"><div className="sectionHead"><span>PRIMER PASO · ENTENDER ANTES DE CONSTRUIR</span><h2>Antes de hablar de soluciones, necesitamos entender tu empresa.</h2><p>No tienes que saber si necesitas automatización, un agente, estrategia o IA. Cuéntanos qué quieres conseguir y qué está frenándote hoy. Carolina organiza lo que nos cuentes, construye un primer mapa y, si tiene sentido continuar, te permite dejar tus datos para revisarlo con Catalina.</p></div>{!showCarolina?<button className="carolinaLaunch" onClick={()=>setShowCarolina(true)}><MessageCircleMore/><div><b>EMPEZAR MI PRIMERA ASESORÍA</b><span>Cuéntale a Carolina qué quieres conseguir. Te hará las preguntas necesarias para construir un primer mapa de oportunidades para tu empresa.</span></div><ArrowRight/></button>:<CarolinaExperience/>}</section>

   <section id="precios" className="section pricing"><div className="sectionHead"><span>INVERSIÓN ORIENTATIVA</span><h2>Construimos una capacidad, no una plantilla.</h2><p>La inversión depende de canales, integraciones, conocimiento, acciones y autonomía. Estos son puntos de partida; plataformas y consumos externos se cotizan aparte.</p></div><div className="priceGrid">{prices.map(([n,p,d])=><article key={n}><span>{n}</span><h3>{p}</h3><p>{d}</p></article>)}</div></section>

   <section className="creatorIntro"><div><span>CATALINA · CREADORA & ESTRATEGA</span><h2>Primero aprendí a operar negocios. Después aprendí a convertirlos en sistemas.</h2><p>La tecnología no es el punto de partida. El negocio sí.</p></div><a href="#perfil">Conoce quién diseña estos sistemas <ArrowRight size={17}/></a></section><section id="perfil" className="section profile"><div className="profilePhoto"><img src={`${import.meta.env.BASE_URL}catalina.jpg`} alt="Catalina Jaramillo" onError={e=>{e.currentTarget.style.display='none'}}/><div className="photoFallback">CATALINA<br/>JARAMILLO</div></div><div className="profileCopy"><span>LA PERSONA DETRÁS DE LOS SISTEMAS</span><h2>No llegué a la IA desde la tecnología. Llegué desde el negocio.</h2><p>Mi experiencia conecta estrategia comercial, ventas, customer experience, ecommerce, growth, equipos, operaciones y diseño funcional de sistemas con IA.</p><p>Eso cambia la pregunta: no es “¿dónde ponemos IA?”, sino “¿qué necesita funcionar mejor y cuál es la forma más inteligente de resolverlo?”.</p><div className="profileFacts"><b>15+ años</b><span>ventas, marketing, consultoría y operación</span><b>Founder-operator</b><span>experiencia real construyendo y operando negocios</span><b>Product Owner</b><span>sistemas y productos digitales dirigidos con IA</span></div></div></section>

   <section id="casos" className="section cases compactCases"><div className="sectionHead"><span>TRABAJO CONSTRUIDO</span><h2>Experiencia aplicada a negocios, agentes y producto digital.</h2></div><div className="caseSummary">
<article><span>NEGOCIO REAL</span><h3>Professional Glam</h3><p>Ecosistema DTC operado de extremo a extremo: producto, growth, Shopify, WhatsApp, operación y cliente.</p><strong>+ COP 1.000M SHOPIFY · 9.296 ÓRDENES</strong></article>
<article><span>SISTEMA DE AGENTES</span><h3>LAURA</h3><p>Arquitectura funcional que conecta conversación, contexto, pedidos, postventa, operaciones e inteligencia.</p></article>
<article><span>PRODUCTO DIGITAL</span><h3>Sin Autosabotaje</h3><p>Sistema longitudinal de cambio diseñado como producto digital.</p><a href="https://sinautosabotaje.com/" target="_blank" rel="noreferrer">Ver proyecto <ArrowRight size={15}/></a></article>
</div></section>

   <section className="trust"><Sparkles/><span>QUIZÁS NO NECESITAS IA.</span><h2>Quizás necesitas organizar un proceso, mejorar una oferta, conectar herramientas o simplemente ver mejor lo que está pasando.</h2><p>Primero entendemos. Después recomendamos.</p><a className="btn primary" href="#descubrir">Descubrir qué necesita mi empresa <ArrowRight size={18}/></a></section>
  </main>
  <button className={"carolinaOrb "+(showCarolina?'active':'')} aria-label="Abrir asesoría con Carolina" onClick={()=>{setShowCarolina(true);document.getElementById('descubrir')?.scrollIntoView({behavior:'smooth'})}}>
   <span className="orbHalo"/><span className="orbFace">C</span><span className="orbStatus"/><span className="orbCopy"><b>CAROLINA</b><small>Asesora IA · Pregúntame</small></span>
  </button>
  <footer><b>CATALINA JARAMILLO</b><span>Strategy · Growth · Automation · AI Systems</span><span>© 2026</span></footer>
 </div>
}
createRoot(document.getElementById('root')).render(<Suspense fallback={null}><App/></Suspense>)
// deploy refresh: Catalina portrait asset
