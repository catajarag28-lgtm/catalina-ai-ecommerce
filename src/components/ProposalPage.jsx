import React,{useEffect,useRef,useState} from 'react'
import {ArrowUpRight,Check,KeyRound,UserRound,LifeBuoy,HandCoins} from 'lucide-react'
import Hero3D from './Hero3D.jsx'
import {findProposal,proposals,proposalPlan} from '../proposals.js'
import {catalog,maintenance,launchBonus} from '../offers.js'

// Propuesta web por sector: /sectores/<sector>?empresa=Nombre. Es el destino del correo con marca.
const tierOf=id=>catalog.find(c=>c.id===id)
const usd=n=>'USD '+n.toLocaleString('es-CO')

// Detecta cuándo un bloque entra en pantalla. Además de IntersectionObserver revisa en scroll/resize,
// para que el contenido nunca quede invisible si el observador no dispara (pestañas en segundo plano, webviews).
function useInView(ref,ratio=.15){
 const [seen,setSeen]=useState(false)
 useEffect(()=>{
  const el=ref.current;if(!el||seen)return
  // Visible o ya pasado (scroll rápido): en ambos casos se muestra.
  const check=()=>{if(el.getBoundingClientRect().top<window.innerHeight*(1-ratio))setSeen(true)}
  const io=new IntersectionObserver(([e])=>{if(e.isIntersecting)setSeen(true)},{threshold:ratio})
  io.observe(el);window.addEventListener('scroll',check,{passive:true});window.addEventListener('resize',check);check()
  return()=>{io.disconnect();window.removeEventListener('scroll',check);window.removeEventListener('resize',check)}
 },[seen])
 return seen
}

function Reveal({children,delay=0,className=''}){
 const ref=useRef(null),on=useInView(ref)
 return <div ref={ref} className={`reveal ${on?'on':''} ${className}`} style={{transitionDelay:`${delay}ms`}}>{children}</div>
}

function Scene({steps}){
 const ref=useRef(null),[shown,setShown]=useState(0),inView=useInView(ref,.25)
 useEffect(()=>{if(!inView)return;let t;const tick=i=>{setShown(i);if(i<steps.length)t=setTimeout(()=>tick(i+1),900)};tick(1);return()=>clearTimeout(t)},[inView,steps.length])
 return <div className="propScene" ref={ref}>{steps.slice(0,shown).map(([time,text],i)=><div key={i} className="propStep"><span>{time}</span><p>{text}</p></div>)}</div>
}

export default function ProposalPage({slug}){
 const p=findProposal(slug)||proposals[0]
 const company=(new URLSearchParams(window.location.search).get('empresa')||'').slice(0,60)
 const tier=tierOf(p.tier),[has3d,setHas3d]=useState(false)
 useEffect(()=>{document.title=`Propuesta ${company?'para '+company:'· '+p.sector} | Catalina Jaramillo`;window.scrollTo(0,0)},[p,company])
 return <div className="proposal">
  <section className={`hero propHero ${has3d?'has3d':''}`}><Hero3D onActive={setHas3d}/><div className="heroTexture"/>
   <div className="heroContent">
    <p className="eyebrow"><span className="pulse"/> EJEMPLO SECTORIAL · {p.sector.toUpperCase()}</p>
    <h1>{company?<>{company},<br/></>:null}<em>{p.hook}</em></h1>
    <p className="heroLead">Un escenario posible para explorar: {p.pain}</p>
    <a className="diagStart propCta" href="/#carolina">Ver qué necesita mi negocio con Carolina <ArrowUpRight size={18}/></a>
    <p className="heroMarket">Preparada por Catalina Jaramillo · Estrategia, operación e inteligencia artificial</p>
   </div>
  </section>

  <section className="section propDark"><Reveal><span className="label">01 / UN DÍA CON TU AGENTE</span><h2>Así se vería<br/><em>en tu negocio.</em></h2></Reveal><Scene steps={p.scene}/></section>

  <section className="section propLight"><Reveal><span className="label">02 / QUÉ HACE POR TI</span><h2>Tu agente,<br/><em>con tu marca y tus reglas.</em></h2></Reveal>
   <p className="propNote">Alcance posible sujeto a diagnóstico, herramientas disponibles y reglas de tu equipo.</p><div className="propGrid">{p.agent.map((a,i)=><Reveal key={a} delay={i*90}><div className="propItem"><Check size={18}/><p>{a}</p></div></Reveal>)}</div>
   <Reveal><p className="propNote">Siempre con una persona de tu equipo detrás: lo que el agente no debe resolver solo, lo pasa con todo el contexto. Cuentas y datos quedan a tu nombre.</p></Reveal>
  </section>

  <section className="section propDark"><Reveal><span className="label">03 / CÓMO LO HACEMOS</span><h2>Etapas claras.<br/><em>Plazos por validar.</em></h2></Reveal>
   <div className="propPlan">{proposalPlan.map(([when,title,text],i)=><Reveal key={title} delay={i*120}><div className="propPhase"><span>{when}</span><h3>{title}</h3><p>{text}</p></div></Reveal>)}</div>
   <Reveal><div className="propMeasure"><b>Lo que medimos contigo:</b> {p.measure.join(' · ')}</div></Reveal>
  </section>

  <section className="section propLight"><Reveal><span className="label">04 / INVERSIÓN ORIENTATIVA</span><h2>Precios claros.<br/><em>Alcance a tu medida.</em></h2></Reveal>
   <div className="propPrices">
    <Reveal><div className="propPrice"><span>PRIMER PASO</span><h3>Diagnóstico estratégico</h3><b>USD 490</b><p>Plan escrito con prioridades, alcance y presupuesto. Se descuenta al 100 % si implementas en 30 días.</p></div></Reveal>
    <Reveal delay={120}><div className="propPrice featured"><span>RECOMENDADO PARA TU SECTOR</span><h3>{tier.name}</h3><b>{usd(tier.fromUSD)} – {usd(tier.toUSD)}</b><p>{tier.gets}</p><small>Mantenimiento desde USD {tier.monthlyFromUSD||maintenance.avanzado}/mes · 50 % al iniciar, 50 % al entregar</small></div></Reveal>
   </div>
   <Reveal><p className="bonus propBonus">{launchBonus}</p></Reveal>
  </section>

  <section className="section propWhy"><Reveal><span className="label">POR QUÉ CATALINA</span><h2>Primero el negocio.<br/><em>Luego la tecnología.</em></h2><p className="propWhyText">Más de 15 años en ventas, marketing y operación. Ha gestionado sedes físicas y una tienda con más de 9.000 pedidos en línea. Diseña LAURA como sistema multiagente para procesos comerciales y operativos. No vende chatbots: diseña cómo debe vender y atender tu empresa, y dirige la construcción del sistema que lo hace.</p></Reveal>
   <div className="guaranteeGrid">{[[KeyRound,'Tus cuentas son tuyas'],[UserRound,'Siempre hay una persona'],[LifeBuoy,'30 días de acompañamiento'],[HandCoins,'50 % al iniciar, 50 % al entregar']].map(([Icon,t],i)=><Reveal key={t} delay={i*80}><div><Icon size={20}/><b>{t}</b></div></Reveal>)}</div>
  </section>

  <section className="closingSection section"><span className="label">SIGUIENTE PASO</span><h2>Habla con Carolina<br/><em>y agenda con Catalina.</em></h2><p>Carolina reúne el contexto de tu negocio y prepara una recomendación preliminar. Si hay encaje, Catalina confirma personalmente una conversación en español.</p><a className="button dark" href="/#carolina">HABLAR CON CAROLINA <ArrowUpRight size={19}/></a></section>
 </div>
}
