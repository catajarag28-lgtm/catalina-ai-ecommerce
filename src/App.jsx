import React,{useEffect,useState} from 'react'
import {ArrowUpRight,ArrowLeft,Check,Mail,ShieldCheck,UserRound,KeyRound,LifeBuoy,HandCoins} from 'lucide-react'
import CarolinaDiagnosis from './components/CarolinaDiagnosis.jsx'
import LeadForm from './components/LeadForm.jsx'
import {offers,catalog,maintenance,launchBonus,CONTACT} from './offers.js'
import {track} from './api.js'

const base=import.meta.env.BASE_URL
const proof=[['15+','años en ventas, servicio al cliente y operación'],['35+','personas dirigidas; equipos coordinados de hasta 100'],['9.296','pedidos en mi propia marca de e-commerce*']]
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
const process=[['Entender','Revisamos tu negocio, cómo te llegan los clientes y qué herramientas usas.'],['Acordar','Definimos por escrito qué hará el agente, qué no hará y cómo sabremos que funciona.'],['Construir y probar','Lo entrenamos con tus casos reales y lo probamos antes de que hable con un cliente.'],['Lanzar y acompañar','Lo activamos, capacitamos a tu equipo y lo ajustamos durante 30 días.']]
const guarantees=[[KeyRound,'Tus cuentas y tus datos son tuyos','Todo queda a tu nombre. Si un día terminamos, te llevas el sistema.'],[UserRound,'Siempre hay una persona','Si el agente no sabe algo, pasa el caso a tu equipo con el contexto. No inventa respuestas.'],[LifeBuoy,'30 días de acompañamiento','Ajustes y soporte incluidos después del lanzamiento.'],[HandCoins,'50 % para empezar, 50 % al entregar','Pagas el resto cuando lo ves funcionando.']]

function usePage(){const read=()=>window.location.hash==='#precios'?'precios':'home';const [page,setPage]=useState(read);useEffect(()=>{const on=()=>{setPage(read());if(window.location.hash==='#precios')window.scrollTo(0,0)};window.addEventListener('hashchange',on);return()=>window.removeEventListener('hashchange',on)},[]);return page}

export default function App(){
 const page=usePage()
 return <>
  <header className="nav"><a className="wordmark" href="#inicio">CATALINA <span>JARAMILLO</span></a><nav><a href="#soluciones">Soluciones</a><a href="#caso">Caso real</a><a href="#precios">Precios</a><a href="#catalina">Sobre mí</a></nav><a className="navTalk" href="#contacto">Hablar con Catalina <ArrowUpRight size={16}/></a></header>
  <main>{page==='precios'?<Pricing/>:<Home/>}</main>
  <footer><span>© 2026 CATALINA JARAMILLO · AGENTES DE IA PARA EMPRESAS</span><span>ATENCIÓN EN ESPAÑOL · EE. UU. Y LATINOAMÉRICA</span><a href={`mailto:${CONTACT.email}`}>{CONTACT.email.toUpperCase()}</a></footer>
 </>
}

function Home(){
 const [demo,setDemo]=useState(demos[0].id),d=demos.find(x=>x.id===demo)
 // Al volver desde #precios, el destino (#contacto, #carolina…) aún no existía: se desplaza al montar.
 useEffect(()=>{try{const el=window.location.hash&&document.querySelector(window.location.hash);if(el&&window.location.hash!=='#inicio')el.scrollIntoView()}catch{}},[])
 return <>
  <section id="inicio" className="hero"><div className="heroTexture"/>
   <div className="heroContent">
    <p className="eyebrow"><span className="pulse"/> AGENTES DE IA PARA SERVICIOS Y E-COMMERCE</p>
    <h1>Agentes de IA que <em>venden, atienden</em> y agendan por ti.</h1>
    <p className="heroLead">Los diseño con 15 años de experiencia en ventas y e-commerce, no solo con tecnología. Empieza con Carolina, mi asesora digital: en 2 minutos te dice <b>qué te conviene construir y cuánto costaría</b>.</p>
    <a className="heroMobileCta" href="#carolina">Ver qué necesita mi negocio y cuánto cuesta <ArrowUpRight size={17}/></a>
    <div className="heroProof">{proof.map(([n,t])=><span key={n}><b>{n}</b>{t}</span>)}</div>
    <p className="heroMarket">Atención y reuniones en español · Trabajo remoto con empresas de EE. UU. y Latinoamérica</p>
    <a className="heroDirect" href="#contacto" onClick={()=>track('direct_contact')}>Prefiero hablar directo con Catalina <ArrowUpRight size={15}/></a>
   </div>
   <div className="heroDiagnosis" id="carolina"><CarolinaDiagnosis/></div>
  </section>

  <section id="soluciones" className="offerSection section"><span className="label">01 / QUÉ CONSTRUYO</span><h2>Tres soluciones.<br/><em>Un problema real cada una.</em></h2>
   <div className="offerGrid">{offers.map(o=><article key={o.id}><span>{o.tag}</span><h3>{o.pain}</h3><ul>{o.delivers.map(x=><li key={x}><Check size={15}/>{x}</li>)}</ul><b className="offerFrom">{o.from}</b></article>)}</div>
   <div className="offerFoot"><p className="bonus">{launchBonus}</p><a href="#precios">Ver precios completos y qué incluye <ArrowUpRight size={16}/></a></div>
  </section>

  <section id="caso" className="caseSection section"><span className="label">02 / NO TE LO CUENTO: MÍRALO</span><h2>Esto ya funciona.<br/><em>Empezó en mi propio negocio.</em></h2>
   <div className="realCase"><span className="tag real">CASO REAL · EN OPERACIÓN</span><h3>LAURA, el agente de Professional Glam</h3><p>Antes de ofrecer esto a otras empresas, lo construí para la mía, una marca de cuidado capilar con venta por WhatsApp. LAURA atiende a las clientas, recomienda productos, confirma pedidos con pago contraentrega, avisa del envío, hace postventa y pasa a una persona los casos delicados. Todo lo que te ofrezco lo probé primero con mi propio dinero y mis propias clientas.</p></div>
   <p className="demoIntro">Así se vería en tu negocio. <span className="tag sim">SIMULACIONES DE EJEMPLO</span></p>
   <div className="demoTabs" role="tablist">{demos.map(x=><button key={x.id} role="tab" aria-selected={demo===x.id} className={demo===x.id?'on':''} onClick={()=>setDemo(x.id)}>{x.tab}</button>)}</div>
   <div className="demoBox"><div className="demoChat"><p className="demoProblem"><b>El problema:</b> {d.problem}</p>{d.chat.map(([who,text],i)=><div key={i} className={`bubble ${who}`}>{text}</div>)}</div>
    <dl className="demoFacts"><div><dt>Conectado con</dt><dd>{d.tools}</dd></div><div><dt>Cuándo entra una persona</dt><dd>{d.human}</dd></div><div><dt>Resultado que puedes ver</dt><dd>{d.result}</dd></div><a className="button dark" href="#carolina">Ver qué necesita mi negocio <ArrowUpRight size={17}/></a></dl></div>
  </section>

  <section id="catalina" className="profileSection section"><div className="portrait"><img src={`${base}catalina.jpg`} alt="Catalina Jaramillo" loading="lazy"/><span>CATALINA JARAMILLO</span></div>
   <div className="profileText"><span className="label">03 / POR QUÉ CONMIGO</span><h2>Primero el negocio.<br/><em>Luego la tecnología.</em></h2>
    <p>Llevo más de 15 años en ventas, experiencia del cliente, marca y operación. He dirigido equipos, construido funnels y fundado una marca de e-commerce que registra más de COP 1.000 millones en ventas en Shopify.</p>
    <p>Por eso no te vendo un chatbot: diseño cómo debe vender y atender tu empresa, y después construyo el agente que lo hace. Hablo el idioma del dueño del negocio, no el del programador.</p>
    <p className="fine">* Ventas y pedidos registrados en Shopify por mi marca Professional Glam. Son resultados comerciales de mi negocio, no atribuidos a la IA.</p>
   </div>
  </section>

  <section className="processSection section"><span className="label">04 / CÓMO TRABAJO</span><h2>Sin sorpresas.<br/><em>Sin letra pequeña.</em></h2>
   <ol className="processGrid">{process.map(([t,p],i)=><li key={t}><span>0{i+1}</span><h3>{t}</h3><p>{p}</p></li>)}</ol>
   <div className="guaranteeGrid">{guarantees.map(([Icon,t,p])=><div key={t}><Icon size={20}/><b>{t}</b><p>{p}</p></div>)}</div>
   <p className="honest"><ShieldCheck size={16}/> No prometo autonomía total ni ventas garantizadas. Prometo un sistema que funciona, probado con situaciones reales de tu negocio.</p>
  </section>

  <section id="contacto" className="contactSection section"><div className="contactIntro"><span className="label">05 / HABLEMOS</span><h2>Habla directo<br/><em>conmigo.</em></h2><p>Cuéntame qué pasa en tu negocio. Te respondo personalmente en menos de 24 horas hábiles para agendar una conversación de 30 minutos, sin costo y sin compromiso.</p><p className="contactMail"><Mail size={16}/> <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></p><p className="heroMarket">Atención y reuniones en español · EE. UU. y Latinoamérica</p></div><LeadForm source="contact"/></section>
 </>
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
  <div className="pricingCta"><a className="button dark" href="#carolina">Calcular el precio para mi negocio <ArrowUpRight size={17}/></a><a className="heroDirect dark" href="#contacto">Hablar directo con Catalina <ArrowUpRight size={15}/></a></div>
 </section>
}
