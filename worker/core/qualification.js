const statuses=['exploring','identified','qualified','high_intent']
const present=v=>typeof v==='string'&&v.trim().length>0
export function qualificationStatus(requested,previous,data){
 let level=Math.max(statuses.indexOf(requested),statuses.indexOf(previous),0)
 const business=present(data.company)||present(data.business), problem=present(data.declaredProblem)||present(data.goal)
 const contact=Boolean(data.email&&data.email.includes('@'))||String(data.phone||'').replace(/\D/g,'').length>=7
 const decision=present(data.budget)||present(data.acceptedRange)||present(data.urgency)
 if(!business||!problem)level=0
 else if(!contact||!decision)level=Math.min(level,1)
 if(level===3&&!present(data.acceptedRange)&&!/(interes|reuni|agend|avanz|contrat)/i.test(data.intent||''))level=2
 return statuses[level]
}

