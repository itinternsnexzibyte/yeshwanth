import { PrismaClient, RoleName, ProjectRequired, LeadQuality, OpportunityStage, FollowUpType, FollowUpStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
const p=new PrismaClient();
const industries=['IT / Software','Manufacturing','Pharma','Real Estate','Solar & Renewables','Healthcare','Retail & Trade','Hospitality','Logistics','Education','Finance','Construction','EV','Consulting','E-commerce','Other'];
const sources=['Event','Walk-in','Phone','Reference','LinkedIn','Instagram','WhatsApp','Website','Email'];
const projects=['Website','Web Application','Mobile App','CRM','ERP','AI / ML','AI Calling','CCTV & Surveillance','Cloud / DevOps','Staffing','Collaboration / Tie-up','Custom Software','Other'];
async function main(){
 for(const name of industries) await p.industry.upsert({where:{name},update:{},create:{name}});
 for(const name of sources) await p.leadSource.upsert({where:{name},update:{},create:{name}});
 for(const name of projects) await p.projectType.upsert({where:{name},update:{},create:{name}});
 const templates=[
  ['THANK_YOU','Thank you for meeting NexziByte Solutions','Thank you for your time. Our team has recorded the visit and will follow up shortly.'],
  ['REQUIREMENT_DISCUSSION','Requirement discussion summary','Thank you for discussing your requirement. We will review the details and contact you for the next step.'],
  ['MEETING_CONFIRMATION','Meeting confirmation','Your meeting with NexziByte Solutions is confirmed.'],
  ['MEETING_REMINDER','Meeting reminder','This is a reminder about your upcoming meeting with NexziByte Solutions.'],
  ['DEMO_FOLLOWUP','Product demonstration follow-up','Thank you for attending the demonstration. Please share any questions or feedback.'],
  ['QUOTATION_SUBMISSION','Quotation submitted','Please find the quotation prepared for your requirement.'],
  ['QUOTATION_FOLLOWUP','Quotation follow-up','We are following up on the quotation shared with you.'],
  ['PAYMENT_FOLLOWUP','Payment follow-up','This is a follow-up regarding the pending payment.']
 ] as const;
 for(const [name,subject,body] of templates) await p.emailTemplate.upsert({where:{name},update:{subject,body,active:true},create:{name,subject,body}});
 const pw=await bcrypt.hash('NexziByte@123',12);
 const users=[['admin@nexzibyte.local','Admin',RoleName.ADMIN],['head@nexzibyte.local','Sales Head',RoleName.SALES_HEAD],['manager@nexzibyte.local','BD Manager',RoleName.BD_MANAGER],['executive@nexzibyte.local','Sales Executive',RoleName.SALES_BD_EXECUTIVE],['technical@nexzibyte.local','Technical Team',RoleName.TECHNICAL_TEAM],['viewer@nexzibyte.local','Management Viewer',RoleName.MANAGEMENT_VIEWER]] as const;
 for(const [email,name,role] of users) await p.user.upsert({where:{email},update:{approvalStatus:'APPROVED',isActive:true,emailVerified:true,emailVerifiedAt:new Date(),isSalesTeam:[RoleName.SALES_HEAD,RoleName.BD_MANAGER,RoleName.SALES_BD_EXECUTIVE].includes(role)},create:{email,name,role,requestedRole:role,passwordHash:pw,approvalStatus:'APPROVED',isActive:true,emailVerified:true,emailVerifiedAt:new Date(),isSalesTeam:[RoleName.SALES_HEAD,RoleName.BD_MANAGER,RoleName.SALES_BD_EXECUTIVE].includes(role),approvedAt:new Date()}});
 const exec=await p.user.findUniqueOrThrow({where:{email:'executive@nexzibyte.local'}});
 const ind=await p.industry.findUniqueOrThrow({where:{name:'IT / Software'}});
 const src=await p.leadSource.findUniqueOrThrow({where:{name:'Reference'}});
 let c=await p.company.findFirst({where:{name:'Nexora Digital Technologies',city:'Hyderabad'}});
 if(!c)c=await p.company.create({data:{name:'Nexora Digital Technologies',city:'Hyderabad',phone:'+91 9000000000',email:'business@nexora.example',industryId:ind.id,contacts:{create:{name:'Rahul Mehta',designation:'Director',phone:'+91 9000000000',email:'rahul@example.com'}}}});
 const contact=await p.contact.findFirstOrThrow({where:{companyId:c.id}});
 const admin=await p.user.findUniqueOrThrow({where:{email:'admin@nexzibyte.local'}});
 await p.workAssignment.deleteMany({where:{companyId:c.id,assignedToId:exec.id}});
 const assignment=await p.workAssignment.create({data:{companyId:c.id,assignedToId:exec.id,assignedById:admin.id,title:'Meet the decision maker',description:'Understand the CRM requirement and collect verified company details.',scheduledAt:new Date(),status:'COMPLETED'}});
 const old=await p.visit.findFirst({where:{companyId:c.id,userId:exec.id,remarks:'Initial CRM requirement discussion'}});
 const v=old||await p.visit.create({data:{companyId:c.id,contactId:contact.id,userId:exec.id,assignmentId:assignment.id,leadSourceId:src.id,meetingType:'Director',visitPurpose:'Business requirement discussion',projectRequired:ProjectRequired.YES,decisionMakerStatus:'YES',leadQuality:LeadQuality.HOT,budgetDiscussed:true,budgetMin:100000,budgetMax:250000,status:'COMPLETED',checkOutAt:new Date(Date.now()+45*60000),durationMinutes:45,remarks:'Initial CRM requirement discussion',photos:{create:{fileUrl:'https://images.example/company-proof.jpg',photoType:'COMPANY',uploadedBy:exec.id}},hourlyActivities:{create:{userId:exec.id,status:'VISIT_COMPLETED',note:'Requirement discussion completed'}}}});
 if(old){console.log('Seed data already present');return;}
 const lead=await p.lead.create({data:{companyId:c.id,visitId:v.id,ownerId:exec.id,status:LeadQuality.HOT}});
 const req=await p.requirement.create({data:{companyId:c.id,visitId:v.id,leadId:lead.id,projectType:'CRM',description:'Customer wants a centralised CRM to manage field sales visits, requirements and follow-ups.',timeline:'30 days',budgetDiscussed:true,budgetMin:100000,budgetMax:250000}});
 const opp=await p.opportunity.create({data:{companyId:c.id,leadId:lead.id,requirementId:req.id,ownerId:exec.id,name:'Field Sales CRM Implementation',projectType:'CRM',estimatedValue:175000,probability:60,stage:OpportunityStage.REQUIREMENT_COLLECTED}});
 await p.followUp.create({data:{companyId:c.id,contactId:contact.id,leadId:lead.id,opportunityId:opp.id,assignedTo:exec.id,originalOwnerId:exec.id,type:FollowUpType.EMAIL,scheduledAt:new Date(Date.now()+24*3600*1000),purpose:'Send requirement discussion summary',status:FollowUpStatus.SCHEDULED,createdBy:exec.id}});
 await p.activityLog.create({data:{companyId:c.id,event:'VISIT_COMPLETED',payload:{visitId:v.id,seed:true}}});
 console.log('Seed complete');
}
main().finally(()=>p.$disconnect());
