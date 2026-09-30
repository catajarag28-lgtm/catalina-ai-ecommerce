import React,{useEffect,useRef,useState} from 'react'

// Fondo WebGL del hero. Si no hay WebGL o el usuario pide menos movimiento, no se monta
// y quedan las órbitas CSS de .heroDiagnosis como respaldo.
function webglAvailable(){try{const c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')))}catch{return false}}

class Boundary extends React.Component{constructor(p){super(p);this.state={failed:false}}static getDerivedStateFromError(){return {failed:true}}componentDidCatch(){this.props.onFail?.()}render(){return this.state.failed?null:this.props.children}}

function Scene({anchorId,onReady,onFail}){
 const ref=useRef(null)
 useEffect(()=>{
  let dispose=null,cancelled=false
  const mobile=window.matchMedia('(max-width: 700px)').matches
  const run=()=>import('./heroScene.js').then(({createHeroScene})=>{
   if(cancelled||!ref.current)return
   try{dispose=createHeroScene(ref.current,{anchor:document.getElementById(anchorId),mobile,onFirstFrame:onReady})}catch{onFail()}
  }).catch(onFail)
  // Se carga después del primer pintado para no frenar el contenido.
  const id=window.requestIdleCallback?window.requestIdleCallback(run,{timeout:1200}):setTimeout(run,300)
  return()=>{cancelled=true;window.cancelIdleCallback?window.cancelIdleCallback(id):clearTimeout(id);dispose?.()}
 },[anchorId])
 return <div ref={ref} className="hero3dCanvas" aria-hidden="true"/>
}

export default function Hero3D({anchorId,onActive}){
 const [enabled]=useState(()=>typeof window!=='undefined'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&webglAvailable())
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false)
 useEffect(()=>{onActive?.(enabled&&!failed&&ready)},[enabled,failed,ready])
 if(!enabled||failed)return null
 return <div className={`hero3d ${ready?'ready':''}`}><Boundary onFail={()=>setFailed(true)}><Scene anchorId={anchorId} onReady={()=>setReady(true)} onFail={()=>setFailed(true)}/></Boundary></div>
}
