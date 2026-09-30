const statuses=['exploring','identified','qualified','high_intent']
const present=value=>typeof value==='string'&&value.trim().length>0

export function qualificationStatus(requested,previous,data){
  let level=Math.max(statuses.indexOf(requested),statuses.indexOf(previous),0)
  const business=present(data.company)||present(data.business)
  const problem=present(data.declaredProblem)||present(data.goal)
  const contact=/^\S+@\S+\.\S+$/.test(data.email||'')||(data.phone||'').replace(/\D/g,'').length>=7
  const decision=present(data.budget)||present(data.acceptedRange)||present(data.urgency)
  if(!business||!problem)level=Math.min(level,0)
  else if(!contact||!decision)level=Math.min(level,1)
  if(level===3&&!present(data.acceptedRange)&&!/(reuni|agend|avanz|contrat)/i.test(data.intent||''))level=2
  return statuses[level]
}
