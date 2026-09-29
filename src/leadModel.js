export const leadSchema={source:"website",name:"",business_name:"",email:"",whatsapp:"",country:"",timezone:"",business_type:"",offer:"",avg_ticket:"",monthly_revenue_range:"",acquisition_channels:[],ad_spend_range:"",sales_channels:[],lead_volume_range:"",response_time:"",conversion_known:false,conversion_rate_range:"",fulfillment_model:"",cancellation_return_range:"",repeat_purchase_range:"",current_tools:[],team_size_range:"",pain_points:[],primary_intents:[],growth_ambition:"",capacity_goal:"",automation_goal:"",desired_outcome:"",proof_metric:"",urgency:"",decision_role:"",investment_range:"",conversation_summary:"",hypotheses:[],recommended_solution:"",estimated_price_range:"",qualification_score:0,qualification_status:"explore",objections:[],consent_contact:false,appointment_status:"not_requested"};
export function qualify(x){
 let s=0;
 if(x.business_type)s+=10;if(x.desired_outcome)s+=10;if(x.lead_volume_range)s+=10;if(x.pain_points?.length)s+=15;
 if(x.urgency)s+=10;if(x.decision_role)s+=10;if(x.investment_range)s+=10;if(x.proof_metric)s+=10;if(x.current_tools?.length)s+=5;if(x.monthly_revenue_range)s+=10;
 return {score:Math.min(100,s),status:s>=80?"high_intent":s>=60?"qualified":s>=40?"nurture":"explore"}
}
export function makeBrief(x){
 return {title:"Opportunity Brief",status:"PRELIMINAR",facts:[x.business_type,x.desired_outcome,x.lead_volume_range].filter(Boolean),hypotheses:x.hypotheses||[],unknowns:["Baseline validado","Acceso a datos/sistemas","Costo real del proceso"].filter(Boolean),recommendation:x.recommended_solution||"Pendiente de diagnóstico",investment:x.estimated_price_range||"Pendiente de alcance",truth_labels:["STATED_FACT","USER_ESTIMATE","AGENT_HYPOTHESIS","UNKNOWN"]}
}