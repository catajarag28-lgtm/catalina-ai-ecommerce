import React,{useEffect,useState} from 'react'
import {ArrowUpRight,ArrowLeft,Check,ShieldCheck,UserRound,KeyRound,LifeBuoy,HandCoins,Sparkles} from 'lucide-react'
import CarolinaDiagnosis from './components/CarolinaDiagnosis.jsx'
import {offers,catalog,maintenance,launchBonus} from './offers.js'

// Regla de negocio: nadie llega a Catalina sin pasar por Carolina. Todos los CTA apuntan a #carolina.
const base=import.meta.env.BASE_URL
const proof=[['15+','años en ventas, marketing, lanzamientos y operación'],['7.531','clientas atendidas en mis 3 sedes físicas*'],['9.296','pedidos en mi tienda online de Shopify*']]
const frictions=['Ventas que se pierden','Clientes que esperan','Procesos manuales','Información dispersa','Un equipo saturado','Todo depende de ti']
const capabilities=[['VENTAS','¿Se te escapan clientes porque nadie responde y hace seguimiento?','Un agente responde 24/7, califica oportunidades, agenda citas, retoma conversaciones frías y avisa cuándo debe entrar una persona.'],['ATENCIÓN Y POSTVENTA','¿Tus clientes esperan, repiten lo mismo o desaparecen después de comprar?','Atención por WhatsApp y redes, preguntas frecuentes, seguimiento postventa, devoluciones, cancelaciones y escalamiento humano.'],['ECOMMERCE','¿Tu tienda recibe visitas pero deja dinero sobre la mesa?','Recuperación de carritos abandonados, seguimiento de pedidos, cambios y devoluciones, venta cruzada y reactivación de clientes.'],['MARKETING Y REDES','¿Publicas y respondes sin convertir la atención en crecimiento?','Agentes que manejan comentarios y mensajes, detectan intención, derivan oportunidades y activan campañas de nurturing.'],['CRECIMIENTO','¿Inviertes en campañas sin saber qué pasa después del clic?','Funnels, Meta Ads, remarketing, recuperación de cancelaciones, retención, analítica y experimentos para aumentar conversiones.'],['OPERACIONES','¿Tu equipo copia, pega y persigue información todo el día?','Automatizaciones entre formularios, CRM, WhatsApp, email, agenda y reportes para que cada tarea avance sin depender del dueño.'],['FINANZAS Y CONTROL','¿Sabes de verdad cuánto ganas y dónde se te va la plata?','Tableros de rentabilidad real, alertas de fugas de dinero, conciliación de pedidos y pagos, y control de lo que hace cada área.'],['SISTEMA INTEGRAL','¿Tienes muchas herramientas pero ninguna trabaja como un sistema?','Coordinamos agentes de ventas, atención, operaciones, conocimiento y growth bajo reglas, permisos y supervisión humana.']]
// [etapa, título, explicación, dónde empezar según el catálogo de src/offers.js]
const stages=[['FRICCIÓN','Algo impide avanzar','Detectamos dónde se pierde tiempo, información o una oportunidad.','Diagnóstico estratégico · USD 490'],['CHATBOT','Responde y guía','Un chatbot ayuda con preguntas y recorridos definidos.','Incluido en el agente esencial'],['AUTOMATIZACIÓN','El flujo ejecuta','Conectamos pasos, herramientas y responsables con reglas claras.','Desde USD 3.800 con CRM y agenda'],['AGENTE IA','Entiende y actúa','Interpreta contexto, consulta conocimiento y actúa dentro de permisos.','Agente esencial · desde USD 2.200'],['TU AGENTE','Habla como tu empresa','Tiene personalidad, procesos, conocimiento y límites propios.','Desde USD 3.800 conectado a tu operación'],['MULTIAGENTE','Especialistas coordinados','Ventas, atención, operaciones, conocimiento y growth colaboran.','Desde USD 9.000'],['BUSINESS OS','La empresa funciona como sistema','Personas, datos, agentes y automatizaciones comparten dirección y control.','Según alcance, con diagnóstico previo']]
const lauraAgents=[['Sales','VENTAS','Busca y sigue oportunidades hasta la cita.'],['CX','ATENCIÓN','Responde, hace seguimiento y cuida la postventa.'],['Operations','OPERACIONES','Conecta tareas para que el equipo avance.'],['Knowledge','CONOCIMIENTO','Encuentra la respuesta correcta para cada persona.'],['Growth','MARKETING','Activa campañas, retención y nuevas ventas.']]
const demos=[
 {id:'cita',tab:'Clínica: consulta → cita',problem:'Una clínica estética recibe consultas por WhatsApp de noche y los fines de semana. Cuando responden el lunes, la persona ya reservó en otro lado.',
  chat:[['c','Hola, ¿cuánto cuesta la limpieza facial?'],['a','¡Hola! La limpieza profunda está en USD 85 e incluye extracción e hidratación. ¿Es para ti? ¿Tienes piel sensible o alguna condición que deba saber la especialista?'],['c','Sí, para mí. Piel mixta, nada especial.'],['a','Perfecto. Tengo disponible el jueves a las 10:00 o el sábado a las 11:30. ¿Cuál te queda mejor?'],['c','Sábado'],['a','Listo, quedaste el sábado a las 11:30. Te llega la confirmación y te recuerdo el viernes. ¿A nombre de quién la registro?']],
  tools:'WhatsApp · Agenda (Google o Calendly) · CRM',human:'Si la persona menciona un tratamiento médico, un embarazo o una queja, pasa el caso a recepción con el resumen.',result:'Cita reservada a las 11 p. m. de un viernes, sin que nadie del equipo estuviera conectado.'},
 {id:'venta',tab:'Tienda: objeción → venta',problem:'Una tienda online recibe muchos mensajes de "¿es original?" o "está caro" y la mayoría nunca compra.',
  chat:[['c','Está caro para un shampoo'],['a','Te entiendo. La diferencia es que este no es un shampoo de limpieza: repara la fibra, y una botella dura unos 2 meses con uso diario. ¿Qué te preocupa hoy de tu cabello?'],['c','Lo tengo muy dañado por el alisado'],['a','Entonces te recomendaría el kit de reparación: sale mejor que comprar por separado. ¿Te lo envío con pago contraentrega?'],['c','Déjame pensarlo'],['a','Claro. Te escribo mañana por si te quedó alguna duda.  (24 h después) Hola, ¿pudiste pensarlo? Hoy el envío sigue gratis.']],
  tools:'WhatsApp · Instagram · Shopify · Logística',human:'Si hay reclamos, pedidos grandes o preguntas médicas, entra una asesora con la conversación completa.',result:'Una objeción se convierte en recomendación y seguimiento automático, en lugar de un chat abandonado.'},
 {id:'postventa',tab:'Postventa: pedido → equipo',problem:'El equipo pasa horas respondiendo "¿dónde está mi pedido?" y los reclamos importantes se mezclan con todo lo demás.',
  chat:[['c','Hola, pedí hace 5 días y no me ha llegado'],['a','Hola, Andrea. Reviso tu pedido #4821… Salió el lunes con la transportadora y está en reparto en tu ciudad. Llega hoy o mañana. Te dejo el número de guía.'],['c','Pero me llegó una caja abierta la otra vez'],['a','Lamento mucho eso. Dejo registrado tu caso para que una persona del equipo revise la entrega y te escriba hoy mismo. No tienes que volver a explicarlo.']],
  tools:'WhatsApp · Tienda · Transportadora · Correo interno',human:'Todo reclamo pasa a una persona con el pedido, el historial y la prioridad marcados.',result:'Las preguntas repetidas se responden solas y el equipo solo atiende lo que de verdad necesita a una persona.'},
]
const process=[['Entender','Carolina conoce tu negocio y yo reviso contigo cómo te llegan los clientes y qué herramientas usas.'],['Acordar','Definimos por escrito qué hará el sistema, qué no hará y cómo sabremos que funciona.'],['Construir y probar','Lo entrenamos con tus casos reales y lo probamos antes de que hable con un cliente.'],['Lanzar y acompañar','Lo activamos, capacitamos a tu equipo y lo ajustamos durante 30 días.']]
const guarantees=[[KeyRound,'Tus cuentas y tus datos son tuyos','Todo queda a tu nombre. Si un día terminamos, te llevas el sistema.'],[UserRound,'Siempre hay una persona','Si el agente no sabe algo, pasa el caso a tu equipo con el contexto. No inventa respuestas.'],[LifeBuoy,'30 días de acompañamiento','Ajustes y soporte incluidos después del lanzamiento.'],[HandCoins,'50 % para empezar, 50 % al entregar','Pagas el resto cuando lo ves funcionando.']]
const toCarolina=<a className="heroDirect" href="#carolina">Hablar con Carolina <ArrowUpRight size={15}/></a>

function usePage(){const read=()=>window.location.hash==='#precios'?'precios':'home';const [page,setPage]=useState(read);useEffect(()=>{const on=()=>{setPage(read());if(window.location.hash==='#precios')window.scrollTo(0,0)};window.addEventListener('hashchange',on);return()=>window.removeEventListener('hashchange',on)},[]);return page}

export default function App(){
 const page=usePage()
 return <>
  <header className="nav"><a className="wordmark" href="#inicio">CATALINA <span>JARAMILLO</span></a><nav><a href="#soluciones">Soluciones</a><a href="#sistema">Sistema</a><a href="#caso">Caso real</a><a href="#precios">Precios</a><a href="#catalina">Sobre mí</a></nav><a className="navTalk" href="#carolina">Hablar con Carolina <ArrowUpRight size={16}/></a></header>
  <main>{page==='precios'?<Pricing/>:<Home/>}</main>
  <footer><span>© 2026 CATALINA JARAMILLO · AGENTES DE IA PARA EMPRESAS</span><span>ATENCIÓN EN ESPAÑOL · EE. UU. Y LATINOAMÉRICA</span><a href="#carolina">HABLAR CON CAROLINA</a></footer>
 </>
}

function Home(){
 const [demo,setDemo]=useState(demos[0].id),d=demos.find(x=>x.id===demo)
 // Al volver desde #precios, el destino (#carolina, #soluciones…) aún no existía: se desplaza al montar.
 useEffect(()=>{try{const el=window.location.hash&&document.querySelector(window.location.hash);if(el&&window.location.hash!=='#inicio')el.scrollIntoView()}catch{}},[])
 return <>
  <section id="inicio" className="hero"><div className="heroTexture"/>
   <div className="heroContent">
    <p className="eyebrow"><span className="pulse"/> ESTRATEGIA · OPERACIÓN · INTELIGENCIA ARTIFICIAL</p>
    <h1>Descubre dónde tu empresa está perdiendo <em>dinero, tiempo</em> y clientes.</h1>
    <p className="heroLead">Y qué sistema con inteligencia artificial lo resuelve: ventas, atención, operación, finanzas y control. <b>Carolina, mi agente de IA, lo analiza contigo en minutos</b> y te dice cuánto costaría.</p>
    <a className="heroMobileCta" href="#carolina">Empezar con Carolina <ArrowUpRight size={17}/></a>
    <p className="heroQuestion">¿Qué está frenando hoy a tu empresa?</p>
    <div className="frictionList">{frictions.map((x,i)=><span key={x}><small>0{i+1}</small>{x}</span>)}</div>
    <div className="heroProof">{proof.map(([n,t])=><span key={n}><b>{n}</b>{t}</span>)}</div>
    <p className="heroMarket">Atención y reuniones en español · Trabajo remoto con empresas de EE. UU. y Latinoamérica</p>
   </div>
   <div className="heroDiagnosis" id="carolina"><CarolinaDiagnosis/></div>
  </section>

  <section id="soluciones" className="offerSection section"><span className="label">01 / POR DÓNDE EMPEZAR</span><h2>Tres soluciones.<br/><em>Un problema real cada una.</em></h2>
   <div className="offerGrid">{offers.map(o=><article key={o.id}><span>{o.tag}</span><h3>{o.pain}</h3><ul>{o.delivers.map(x=><li key={x}><Check size={15}/>{x}</li>)}</ul><b className="offerFrom">{o.from}</b></article>)}</div>
   <div className="offerFoot"><p className="bonus">{launchBonus}</p><a href="#precios">Ver precios completos y qué incluye <ArrowUpRight size={16}/></a></div>
  </section>

  <section className="capabilitySection section"><span className="label">02 / ¿ESTO TE SUENA FAMILIAR?</span><h2>El problema se siente.<br/><em>La solución se diseña.</em></h2>
   <div className="capabilityGrid">{capabilities.map(([name,pain,solution],i)=><article key={name}><span>{String(i+1).padStart(2,'0')} / {name}</span><h3>{pain}</h3><p>{solution}</p></article>)}</div>
   <div className="capabilityCta"><b>Desde una tarea puntual hasta una nueva forma de operar.</b><a href="#carolina">Explorar mi caso con Carolina <ArrowUpRight size={17}/></a></div>
  </section>

  <SystemSection/>

  <section id="caso" className="caseSection section"><span className="label">04 / NO TE LO CUENTO: MÍRALO</span><h2>Esto ya funciona.<br/><em>Lo estás viendo.</em></h2>
   <div className="caseGrid">
    <div className="realCase"><span className="tag real">EN VIVO · AHORA MISMO</span><h3>Carolina, la asesora de esta página</h3><p>Es un agente de IA. Conversa, entiende tu negocio, te recomienda por dónde empezar, estima la inversión y le pasa tu caso a Catalina con todo el contexto. Lo que sientes al hablar con ella es lo que sentirán tus clientes.</p>{toCarolina}</div>
    <div className="realCase"><span className="tag real">CASO REAL · EN OPERACIÓN</span><h3>LAURA · Sistema multiagente de comercio</h3><p>Arquitectura que diseñé y dirijo para una operación de belleza con sedes físicas, tienda online y más de 9.000 pedidos. Coordina agentes de ventas, atención, confirmación de pedidos, logística, postventa, fidelización e inteligencia comercial, con reglas de negocio, auditoría y supervisión humana.</p></div>
   </div>
   <LauraSystem/>
   <p className="demoIntro">Así se vería en tu negocio. <span className="tag sim">SIMULACIONES DE EJEMPLO</span></p>
   <div className="demoTabs" role="tablist">{demos.map(x=><button key={x.id} role="tab" aria-selected={demo===x.id} className={demo===x.id?'on':''} onClick={()=>setDemo(x.id)}>{x.tab}</button>)}</div>
   <div className="demoBox"><div className="demoChat"><p className="demoProblem"><b>El problema:</b> {d.problem}</p>{d.chat.map(([who,text],i)=><div key={i} className={`bubble ${who}`}>{text}</div>)}</div>
    <dl className="demoFacts"><div><dt>Conectado con</dt><dd>{d.tools}</dd></div><div><dt>Cuándo entra una persona</dt><dd>{d.human}</dd></div><div><dt>Resultado que puedes ver</dt><dd>{d.result}</dd></div><a className="button dark" href="#carolina">Ver qué necesita mi negocio <ArrowUpRight size={17}/></a></dl></div>
  </section>

  <section id="catalina" className="profileSection section"><div className="portrait"><img src={`${base}catalina.jpg`} alt="Catalina Jaramillo" loading="lazy"/><span>CATALINA JARAMILLO</span></div>
   <div className="profileText"><span className="label">05 / POR QUÉ CONMIGO</span><h2>Primero el negocio.<br/><em>Luego la tecnología.</em></h2>
    <p>Empecé en 2009 como directora comercial y de marketing de Biboban, una empresa textil colombiana. Desde 2013 asesoro a empresas y expertos en servicio al cliente, entrenamiento de equipos de ventas, cierre por WhatsApp, retención y lanzamientos: cursos, ebooks y una app para un referente de neuroventas en México, y una marca de muebles en Ecuador, entre otros.</p>
    <p>En 2018 fundé Professional Glam, una operación con tres sedes físicas en Colombia, empresa en Florida y una tienda online con más de COP 1.000 millones en ventas en Shopify. Allí diseñé y dirijo LAURA, un sistema multiagente que coordina ventas, atención, pedidos, postventa e inteligencia comercial.</p>
    <p>Mi trabajo es diseñar cómo debe vender, atender y operar una empresa, y dirigir la construcción del sistema que lo hace realidad. Combino estrategia comercial, experiencia del cliente, operación e inteligencia artificial: hablo el idioma del dueño del negocio y el de la tecnología. <b>Carolina, la asesora que te atiende en esta página, es un ejemplo de ese trabajo.</b></p>
    <p className="fine">* Registros de Professional Glam (sedes físicas y Shopify). Son resultados comerciales de mi negocio, no atribuidos a la IA.</p>
   </div>
  </section>

  <section className="processSection section"><span className="label">06 / CÓMO TRABAJO</span><h2>Sin sorpresas.<br/><em>Sin letra pequeña.</em></h2>
   <ol className="processGrid">{process.map(([t,p],i)=><li key={t}><span>0{i+1}</span><h3>{t}</h3><p>{p}</p></li>)}</ol>
   <div className="guaranteeGrid">{guarantees.map(([Icon,t,p])=><div key={t}><Icon size={20}/><b>{t}</b><p>{p}</p></div>)}</div>
   <p className="honest"><ShieldCheck size={16}/> No prometo autonomía total ni ventas garantizadas. Prometo un sistema que funciona, probado con situaciones reales de tu negocio.</p>
  </section>

  <section className="closingSection section"><Sparkles size={22}/><span className="label">TU PRÓXIMO PASO</span><h2>Cuéntale a Carolina dónde<br/><em>se siente la fricción.</em></h2><p>Ella analiza tu caso, te muestra qué se puede hacer y cuánto costaría. Si hay un buen encaje, te agenda una reunión conmigo con tu propuesta lista.</p><a className="button dark" href="#carolina">EMPEZAR CON CAROLINA <ArrowUpRight size={19}/></a></section>
 </>
}

function SystemSection(){
 const [stage,setStage]=useState(0),[playing,setPlaying]=useState(false)
 useEffect(()=>{if(!playing)return;const timer=setTimeout(()=>{if(stage===stages.length-1)setPlaying(false);else setStage(stage+1)},2900);return()=>clearTimeout(timer)},[playing,stage])
 useEffect(()=>()=>window.speechSynthesis?.cancel(),[])
 const play=()=>{window.speechSynthesis?.cancel();setStage(0);setPlaying(true);if('speechSynthesis' in window){const voice=new SpeechSynthesisUtterance('Primero detectamos la fricción. Un chatbot responde. Una automatización ejecuta tareas. Un agente entiende el contexto y actúa con permisos. Un agente personalizado trabaja con tu marca y tus procesos. Varios especialistas pueden coordinarse. Y tu empresa funciona como un sistema. Carolina puede ayudarte a descubrir por dónde empezar.');voice.lang='es-CO';voice.rate=1.03;window.speechSynthesis.speak(voice)}}
 return <section id="sistema" className="systemSection section"><div className="sectionIntro"><span className="label">03 / DE UNA TAREA A UNA EMPRESA</span><h2>Una mejor forma<br/>de <em>operar.</em></h2><p>Un chatbot responde. Un flujo ejecuta. Un agente entiende y actúa. Un sistema los coordina. Empezamos donde estás y crecemos hasta donde necesites.</p></div>
  <button className="explainerPlay" onClick={play} aria-label="Reproducir explicación de 20 segundos con voz">▶ VER EN 20 SEGUNDOS · CON VOZ</button>
  <div className="systemExperience"><div className="stageRail" role="tablist" aria-label="Evolución del sistema">{stages.map((item,i)=><button key={item[0]} role="tab" aria-selected={stage===i} className={stage===i?'active':''} onClick={()=>{setPlaying(false);window.speechSynthesis?.cancel();setStage(i)}}><span>{String(i+1).padStart(2,'0')}</span>{item[0]}</button>)}</div>
   <div className="stageVisual" aria-live="polite"><div className="stageHalo"/><div className="stageCenter"><span>TU EMPRESA</span><div className="systemCore"><b>{stages[stage][0]}</b></div><small>PERSONAS · PROCESOS · DATOS</small></div><div className="stageDescription"><div className="explainerProgress" style={{width:playing?`${((stage+1)/stages.length)*100}%`:0}}/><span>0{stage+1} / 0{stages.length}</span><h3>{stages[stage][1]}</h3><p>{stages[stage][2]}</p><a className="stagePrice" href="#carolina">{stages[stage][3]} <ArrowUpRight size={13}/></a></div></div></div>
 </section>
}

function LauraSystem(){
 const [agent,setAgent]=useState(lauraAgents[0][0]),a=lauraAgents.find(x=>x[0]===agent)
 return <div className="lauraBlock"><h3 className="lauraTitle">Un especialista ayuda. <em>Un sistema coordina.</em></h3><p className="lauraIntro">LAURA coordina varios asistentes para que la empresa no dependa de una sola persona. Todos siguen las mismas reglas y, cuando hace falta, pasan el caso al equipo humano.</p>
  <div className="lauraInterface"><div className="lauraAgents">{lauraAgents.map(([id,label])=><button key={id} className={agent===id?'selected':''} onClick={()=>setAgent(id)}><span className="agentDot"/>{label}<ArrowUpRight size={16}/></button>)}</div>
   <div className="lauraPanel"><span>LAURA / {a[1]}</span><div className="lauraOrb"><b>{a[0].slice(0,2).toUpperCase()}</b></div><h3>{a[2]}</h3><p>Recibe el contexto, sigue un proceso y resuelve la tarea; si necesita una decisión, la pasa a una persona.</p><div className="controlStrip">CONTROL · PERMISOS · TRAZABILIDAD · EQUIPO HUMANO</div></div></div>
 </div>
}

function Pricing(){
 return <section className="pricingPage section">
  <a className="backLink" href="#inicio"><ArrowLeft size={15}/> Volver</a>
  <span className="label">PRECIOS</span><h2>Precios claros.<br/><em>Cotización según tu alcance.</em></h2>
  <p className="pricingIntro">Estos son precios base de implementación en dólares. El precio final lo confirmo contigo después de revisar tus herramientas y lo que necesitas. Pagas 50 % al empezar y 50 % al entregar.</p>
  <p className="bonus">{launchBonus}</p>
  <div className="priceTable">{catalog.map(c=><article key={c.id}><div><h3>{c.name}</h3><p>{c.gets}</p>{c.note&&<p className="priceNote">{c.note}</p>}<p className="priceEx">No incluye: {c.excludes}</p></div><b>{c.price}</b></article>)}</div>
  <div className="priceExtras"><div><h3>Mantenimiento mensual</h3><p><b>USD {maintenance.esencial}/mes</b> agente esencial · <b>USD {maintenance.avanzado}/mes</b> ventas o e-commerce.</p><p>{maintenance.includes}</p><p className="priceEx">{maintenance.excludes}</p></div>
   <div><h3>Qué necesito de ti</h3><p>Acceso a tus herramientas (WhatsApp Business, tienda, agenda o CRM), tus preguntas frecuentes, precios y políticas, y una persona de tu equipo para validar las pruebas.</p><h3>Cómo sabemos que funciona</h3><p>Antes de lanzar, acordamos casos de prueba reales. El agente se entrega cuando los resuelve bien.</p></div></div>
  <div className="pricingCta"><a className="button dark" href="#carolina">Calcular el precio para mi negocio con Carolina <ArrowUpRight size={17}/></a></div>
 </section>
}
