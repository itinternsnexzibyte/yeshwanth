import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { db } from "./db.js";
import { config } from "./config.js";
import { clearSession, issueSession, requireAuth, requireCsrf, requireRole } from "./auth.js";
import { calculateQuotation, serialiseCalculation } from "./calculation.js";
import { CATALOGUE_DETAILS, IMAGE_KEYS, imageKeyFor, parseDetails } from "./productCatalogue.js";
import { ACCENT_PALETTE, PDF_LAYOUT_VERSION, buildDocx, buildPdf } from "./documents.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.FRONTEND_URL, credentials: true, methods:["GET","POST","PUT","PATCH","DELETE"] }));
app.use(express.json({ limit: "3mb" }));
app.use(cookieParser());

const asyncRoute = (fn: any) => (req: any,res: any,next: any) => Promise.resolve(fn(req,res,next)).catch(next);
const loginLimiter = rateLimit({ windowMs:15*60_000,limit:8,standardHeaders:true,legacyHeaders:false,message:{message:"Too many login attempts. Try again later."} });
const safeUser = (u:any) => ({id:u.id,name:u.name,email:u.email,role:u.role,profileImageUrl:u.profileImagePath?"/api/account/profile-image":null});
const audit = (req:any, action:string, entity:string, entityId?:string, metadata?:unknown) => db.auditLog.create({data:{userId:req.user?.id,action,entity,entityId,metadata:metadata as any,ipAddress:req.ip}});

app.get("/api/health", (_req,res)=>res.json({status:"ok",service:"quotation-management",version:"2.8.0"}));
app.get("/api/integration/health", (req,res)=>{
  if(req.headers["x-integration-key"]!==config.INTEGRATION_API_KEY)return res.status(401).json({message:"Invalid integration key"});
  res.json({service:"quotation-management",contractVersion:"1.0",authMode:"shared-rbac-compatible",entities:["users","customers","products","quotations","audit"]});
});

app.get("/api/setup/status", asyncRoute(async (_req:any,res:any)=>res.json({required:(await db.user.count())===0})));
app.post("/api/setup/bootstrap", loginLimiter, asyncRoute(async (req:any,res:any)=>{
  if((await db.user.count())>0)return res.status(409).json({message:"Setup already completed"});
  if(req.headers["x-bootstrap-token"]!==config.BOOTSTRAP_TOKEN)return res.status(403).json({message:"Invalid bootstrap token"});
  const input=z.object({name:z.string().min(2).max(100),email:z.string().email(),password:z.string().min(12).max(128)}).parse(req.body);
  const user=await db.user.create({data:{name:input.name,email:input.email.toLowerCase(),passwordHash:await argon2.hash(input.password,{type:argon2.argon2id}),role:"ADMIN"}});
  await db.template.createMany({data:[
    {code:"NEXZIBYTE",name:"NexziByte quotation format",version:1,definition:{gstMode:"CGST_SGST",layout:"A4",sourceStatus:"NEXZIBYTE_STANDARD"}}
  ],skipDuplicates:true});
  const catalogue=[
    ["HW-DELL-LAT-001","Dell Latitude Business Laptop","Dell business laptop, configurable memory and storage","Latitude","Unit",68500],
    ["HW-DELL-KB-001","Dell USB Keyboard","Dell wired USB keyboard","USB","Unit",950],
    ["HW-DELL-MOUSE-001","Dell USB Optical Mouse","Dell wired optical USB mouse","USB","Unit",550],
    ["HW-DESKTOP-CPU-001","Business Desktop CPU","Business desktop tower, configurable processor and memory","Desktop","Unit",42500],
    ["HW-DELL-MON-001","Dell 24-inch Monitor","Dell 24-inch business monitor","24 inch","Unit",11200],
    ["HW-SSD-001","1TB NVMe SSD","1TB NVMe solid state drive","1TB","Unit",6500],
    ["HW-RAM-001","16GB DDR4 RAM","16GB DDR4 memory module","16GB","Unit",3200],
    ["HW-DOCK-001","USB-C Laptop Dock","USB-C docking station for compatible laptops","USB-C","Unit",7800],
    ["HW-UPS-001","650VA UPS","650VA uninterruptible power supply","650VA","Unit",3400],
    ["SW-OFFICE-001","Office Productivity Software Licence","Productivity software licence; final edition and term to be confirmed","Licence","Licence",8500],
    ["SW-SECURITY-001","Endpoint Security Software Licence","Endpoint security software licence; term to be confirmed","Licence","Licence",1800],
    ["SW-OS-001","Desktop Operating System Licence","Operating system licence; edition to be confirmed","Licence","Licence",11500]
  ] as const;
  for(const [sku,name,description,packageSize,uom,price] of catalogue){
    await db.product.upsert({where:{sku},update:{name,description,packageSize,uom,status:"ACTIVE"},create:{sku,name,description,packageSize,uom,moq:1,gstRate:18,status:"ACTIVE",prices:{create:{listPrice:price,unitPrice:price,defaultDiscount:0,effectiveFrom:new Date()}}}});
  }
  await db.auditLog.create({data:{userId:user.id,action:"BOOTSTRAP_ADMIN_CREATED",entity:"User",entityId:user.id,ipAddress:req.ip}});
  res.status(201).json({message:"Administrator created. Sign in to continue."});
}));

app.post("/api/auth/login", loginLimiter, asyncRoute(async (req:any,res:any)=>{
  const {email,password}=z.object({email:z.string().email(),password:z.string().min(1).max(128)}).parse(req.body);
  const user=await db.user.findUnique({where:{email:email.toLowerCase()}}); const now=new Date();
  if(!user||user.status!=="ACTIVE"||(user.lockedUntil&&user.lockedUntil>now)||!(await argon2.verify(user.passwordHash,password))){
    if(user){const failed=user.failedLogins+1;await db.user.update({where:{id:user.id},data:{failedLogins:failed,lockedUntil:failed>=5?new Date(Date.now()+15*60_000):null}});} return res.status(401).json({message:"Invalid credentials or temporarily locked account"});
  }
  await db.user.update({where:{id:user.id},data:{failedLogins:0,lockedUntil:null}}); issueSession(res,safeUser(user)); await audit({...req,user:safeUser(user)},"LOGIN","Session"); res.json({user:safeUser(user)});
}));
app.post("/api/auth/logout", requireAuth, requireCsrf, asyncRoute(async (req:any,res:any)=>{await audit(req,"LOGOUT","Session");clearSession(res);res.status(204).end();}));
app.get("/api/auth/me", requireAuth, (req,res)=>res.json({user:req.user}));

app.use("/api", requireAuth, requireCsrf);

app.get("/api/account/profile", asyncRoute(async (req:any,res:any)=>{const user=await db.user.findUnique({where:{id:req.user.id}});if(!user)return res.status(404).json({message:"User not found"});res.json({user:safeUser(user)})}));
app.get("/api/account/profile-image", asyncRoute(async (req:any,res:any)=>{const user=await db.user.findUnique({where:{id:req.user.id},select:{profileImagePath:true}});if(!user?.profileImagePath||!existsSync(user.profileImagePath))return res.status(404).end();res.setHeader("Cache-Control","private, max-age=300");res.sendFile(path.resolve(user.profileImagePath))}));
app.put("/api/account/profile-image", asyncRoute(async (req:any,res:any)=>{const {imageData}=z.object({imageData:z.string().max(3_000_000)}).parse(req.body);const match=imageData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match)return res.status(400).json({message:"Upload a PNG, JPG or WebP image"});const buffer=Buffer.from(match[2]!,"base64");if(!buffer.length||buffer.length>2*1024*1024)return res.status(400).json({message:"Profile image must be smaller than 2 MB"});const extension=match[1]==="jpeg"?"jpg":match[1];await mkdir(path.resolve("storage/profiles"),{recursive:true});const file=path.resolve("storage/profiles",`${req.user.id}.${extension}`);await writeFile(file,buffer);const user=await db.user.update({where:{id:req.user.id},data:{profileImagePath:file}});await audit(req,"PROFILE_IMAGE_UPDATED","User",user.id);res.json({user:safeUser(user)})}));
app.put("/api/account/password", asyncRoute(async (req:any,res:any)=>{const input=z.object({currentPassword:z.string().min(1).max(128),newPassword:z.string().min(12).max(128)}).refine(x=>x.currentPassword!==x.newPassword,{message:"New password must be different",path:["newPassword"]}).parse(req.body);const user=await db.user.findUnique({where:{id:req.user.id}});if(!user||!(await argon2.verify(user.passwordHash,input.currentPassword)))return res.status(400).json({message:"Current password is incorrect"});await db.user.update({where:{id:user.id},data:{passwordHash:await argon2.hash(input.newPassword,{type:argon2.argon2id}),failedLogins:0,lockedUntil:null}});await audit(req,"PASSWORD_CHANGED","User",user.id);res.json({message:"Password changed. Sign in again."})}));

app.get("/api/company-documents", (_req,res)=>{
  const profilePath=path.resolve(config.COMPANY_PROFILE_CARD_PATH);
  const brochurePath=config.COMPANY_BROCHURE_PATH?path.resolve(config.COMPANY_BROCHURE_PATH):"";
  res.json({profileCard:existsSync(profilePath),brochure:Boolean(brochurePath&&existsSync(brochurePath))});
});
app.get("/api/company/profile-card", (req,res)=>{
  const file=path.resolve(config.COMPANY_PROFILE_CARD_PATH);
  if(!existsSync(file))return res.status(404).json({message:"Company profile card is not configured"});
  res.download(file,"NexziByte-Company-Profile-Card.png");
});
app.get("/api/company/brochure", (req,res)=>{
  const file=path.resolve(config.COMPANY_BROCHURE_PATH);
  if(!existsSync(file))return res.status(404).json({message:"Configured company brochure was not found"});
  res.download(file,"NexziByte-Company-Brochure.png");
});

app.get("/api/dashboard", asyncRoute(async (req:any,res:any)=>{
  const own=req.user.role==="QUOTATION_USER"?{createdById:req.user.id}:{};
  const since=new Date(); since.setMonth(since.getMonth()-5); since.setDate(1); since.setHours(0,0,0,0);
  const [count,total,recent,statuses,trendRows,customerCount]=await Promise.all([
    db.quotation.count({where:own}),db.quotation.aggregate({where:{...own,status:"ISSUED"},_sum:{grandTotal:true}}),
    db.quotation.findMany({where:own,orderBy:{createdAt:"desc"},take:6,include:{customer:true,createdBy:{select:{name:true}}}}),
    db.quotation.groupBy({by:["status"],where:own,_count:{_all:true}}),
    db.quotation.findMany({where:{...own,quotationDate:{gte:since}},select:{quotationDate:true,grandTotal:true,status:true}}),
    db.customer.count({where:{status:"ACTIVE"}})
  ]);
  const monthKeys=Array.from({length:6},(_,i)=>{const d=new Date(since);d.setMonth(since.getMonth()+i);return d.toISOString().slice(0,7)});
  const monthlyTrend=monthKeys.map(key=>{const rows=trendRows.filter(q=>q.quotationDate.toISOString().slice(0,7)===key);return {month:new Date(`${key}-01T00:00:00`).toLocaleString("en-IN",{month:"short"}),count:rows.length,value:rows.reduce((sum,q)=>sum+Number(q.grandTotal),0),issued:rows.filter(q=>q.status==="ISSUED").length}});
  res.json({quotationCount:count,customerCount,issuedValue:total._sum.grandTotal?.toString()||"0",statusBreakdown:statuses,monthlyTrend,recent:recent.map(q=>({...q,grandTotal:q.grandTotal.toString()}))});
}));

app.get("/api/customers", asyncRoute(async (req:any,res:any)=>res.json(await db.customer.findMany({where:req.query.all==="true"?{}:{status:"ACTIVE"},include:{contacts:true},orderBy:{companyName:"asc"}}))));
app.post("/api/customers", requireRole("ADMIN","QUOTATION_USER"), asyncRoute(async (req:any,res:any)=>{
  const input=z.object({customerCode:z.string().min(2).max(30),companyName:z.string().min(2).max(160),address:z.string().min(5).max(1000),gstNo:z.string().max(30).optional(),defaultPaymentTerms:z.string().max(500).optional(),defaultDeliveryTerms:z.string().max(500).optional(),contact:z.object({name:z.string().min(2),designation:z.string().optional(),phone:z.string().optional(),email:z.string().email().optional()}).optional()}).parse(req.body);
  const customer=await db.customer.create({data:{customerCode:input.customerCode.toUpperCase(),companyName:input.companyName,address:input.address,gstNo:input.gstNo||null,defaultPaymentTerms:input.defaultPaymentTerms,defaultDeliveryTerms:input.defaultDeliveryTerms,contacts:input.contact?{create:input.contact}:undefined},include:{contacts:true}}); await audit(req,"CREATE","Customer",customer.id);res.status(201).json(customer);
}));
app.put("/api/customers/:id", requireRole("ADMIN","QUOTATION_USER"), asyncRoute(async (req:any,res:any)=>{
  const input=z.object({companyName:z.string().min(2).max(160),address:z.string().min(5).max(1000),gstNo:z.string().max(30).nullable().optional(),defaultPaymentTerms:z.string().max(500),defaultDeliveryTerms:z.string().max(500),status:z.enum(["ACTIVE","INACTIVE"]).optional()}).parse(req.body);
  const row=await db.customer.update({where:{id:req.params.id},data:input});await audit(req,"UPDATE","Customer",row.id);res.json(row);
}));
app.post("/api/customers/:id/contacts", requireRole("ADMIN","QUOTATION_USER"), asyncRoute(async (req:any,res:any)=>{
  const input=z.object({name:z.string().min(2).max(100),designation:z.string().max(100).optional(),phone:z.string().max(30).optional(),email:z.string().email().optional()}).parse(req.body);
  const row=await db.customerContact.create({data:{customerId:req.params.id,...input}});await audit(req,"CREATE","CustomerContact",row.id);res.status(201).json(row);
}));

const detailsInput=z.object({highlights:z.array(z.string().trim().min(1).max(200)).max(10).default([]),specs:z.array(z.object({label:z.string().trim().min(1).max(80),value:z.string().trim().min(1).max(300)})).max(40).default([])});
const productExtra=(input:{imageKey?:string|null;details?:z.infer<typeof detailsInput>|null})=>({...(input.imageKey!==undefined?{imageKey:input.imageKey&&(IMAGE_KEYS as readonly string[]).includes(input.imageKey)?input.imageKey:null}:{}),...(input.details!==undefined?{details:input.details&&(input.details.highlights.length||input.details.specs.length)?JSON.stringify(input.details):null}:{})});
const detailsFor=(p:{sku:string;details:string|null})=>p.details||(CATALOGUE_DETAILS[p.sku]?JSON.stringify(CATALOGUE_DETAILS[p.sku]):null);
app.get("/api/products", asyncRoute(async (req:any,res:any)=>{
  // Filter legacy Castrol items in JavaScript. Prisma does not support `mode`
  // inside this nested `not` filter, which caused the endpoint to return 500.
  const products=await db.product.findMany({where:req.query.all==="true"?{}:{status:"ACTIVE"},include:{prices:{orderBy:{effectiveFrom:"desc"},take:10}},orderBy:{sku:"asc"}});
  const visibleProducts=products.filter(p=>!p.name.toLocaleLowerCase().includes("castrol"));
  res.json(visibleProducts.map(p=>({...p,imagePath:undefined,imageUrl:p.imagePath?`/api/products/${p.id}/image?v=${p.imagePath.slice(0,10)}`:null,imageKey:p.imageKey||imageKeyFor(p.sku,p.name),details:parseDetails(detailsFor(p)),moq:p.moq.toString(),gstRate:p.gstRate.toString(),prices:p.prices.map(x=>({...x,listPrice:x.listPrice.toString(),unitPrice:x.unitPrice.toString(),defaultDiscount:x.defaultDiscount.toString()}))})));
}));
app.post("/api/products", requireRole("ADMIN"), asyncRoute(async (req:any,res:any)=>{
  const input=z.object({sku:z.string().min(2).max(40),name:z.string().min(2).max(160),description:z.string().min(2).max(1000),packageSize:z.string().min(1).max(80),uom:z.string().min(1).max(20),moq:z.coerce.number().positive(),gstRate:z.coerce.number().min(0).max(100).default(18),listPrice:z.coerce.number().nonnegative(),unitPrice:z.coerce.number().nonnegative(),defaultDiscount:z.coerce.number().min(0).max(100).default(0),imageKey:z.string().max(40).optional().nullable(),details:detailsInput.optional().nullable()}).parse(req.body);
  const product=await db.product.create({data:{...productExtra(input),sku:input.sku.toUpperCase(),name:input.name,description:input.description,packageSize:input.packageSize,uom:input.uom,moq:input.moq,gstRate:input.gstRate,prices:{create:{listPrice:input.listPrice,unitPrice:input.unitPrice,defaultDiscount:input.defaultDiscount,effectiveFrom:new Date()}}}});await audit(req,"CREATE","Product",product.id);res.status(201).json(product);
}));
app.put("/api/products/:id", requireRole("ADMIN"), asyncRoute(async (req:any,res:any)=>{
  const input=z.object({sku:z.string().min(2).max(40),name:z.string().min(2).max(160),description:z.string().min(2).max(1000),packageSize:z.string().min(1).max(80),uom:z.string().min(1).max(20),moq:z.coerce.number().positive(),gstRate:z.coerce.number().min(0).max(100),status:z.enum(["ACTIVE","INACTIVE"]),listPrice:z.coerce.number().nonnegative(),unitPrice:z.coerce.number().nonnegative(),defaultDiscount:z.coerce.number().min(0).max(100),effectiveFrom:z.coerce.date().optional(),imageKey:z.string().max(40).optional().nullable(),details:detailsInput.optional().nullable()}).parse(req.body);
  const current=await db.product.findUniqueOrThrow({where:{id:req.params.id},include:{prices:{orderBy:{effectiveFrom:"desc"},take:1}}});
  const priceChanged=!current.prices[0]||!current.prices[0].listPrice.equals(input.listPrice)||!current.prices[0].unitPrice.equals(input.unitPrice)||!current.prices[0].defaultDiscount.equals(input.defaultDiscount);
  const row=await db.$transaction(async tx=>{if(priceChanged){await tx.productPrice.updateMany({where:{productId:req.params.id,effectiveTo:null},data:{effectiveTo:new Date()}});await tx.productPrice.create({data:{productId:req.params.id,listPrice:input.listPrice,unitPrice:input.unitPrice,defaultDiscount:input.defaultDiscount,effectiveFrom:input.effectiveFrom||new Date()}});}return tx.product.update({where:{id:req.params.id},data:{...productExtra(input),sku:input.sku.toUpperCase(),name:input.name,description:input.description,packageSize:input.packageSize,uom:input.uom,moq:input.moq,gstRate:input.gstRate,status:input.status}})});
  await audit(req,"UPDATE","Product",row.id,{priceVersionCreated:priceChanged});res.json(row);
}));
app.get("/api/products/:id/price-history", requireRole("ADMIN"), asyncRoute(async (req:any,res:any)=>res.json(await db.productPrice.findMany({where:{productId:req.params.id},orderBy:{effectiveFrom:"desc"}}))));

const pricingRuleInput=z.object({name:z.string().min(2).max(120),scope:z.enum(["GLOBAL","TEMPLATE","PRODUCT"]),scopeId:z.string().optional().nullable(),formulaRef:z.string().min(2).max(120).default("STANDARD_QTY_PRICE_DISCOUNT_GST"),maxDiscount:z.coerce.number().min(0).max(100).optional().nullable(),gstRateOverride:z.coerce.number().min(0).max(100).optional().nullable(),fixedFreight:z.coerce.number().nonnegative().optional().nullable(),status:z.enum(["ACTIVE","INACTIVE"]).default("ACTIVE")});
app.get("/api/pricing-rules", requireRole("ADMIN"), asyncRoute(async (_req:any,res:any)=>res.json(await db.pricingRule.findMany({orderBy:[{status:"asc"},{scope:"asc"},{name:"asc"}]}))));
app.post("/api/pricing-rules", requireRole("ADMIN"), asyncRoute(async (req:any,res:any)=>{const input=pricingRuleInput.parse(req.body);if(input.scope!=="GLOBAL"&&!input.scopeId)return res.status(400).json({message:"Template or product scope requires a target"});const row=await db.pricingRule.create({data:{...input,scopeId:input.scope==="GLOBAL"?null:input.scopeId}});await audit(req,"CREATE","PricingRule",row.id,{scope:row.scope});res.status(201).json(row)}));
app.put("/api/pricing-rules/:id", requireRole("ADMIN"), asyncRoute(async (req:any,res:any)=>{const input=pricingRuleInput.parse(req.body);if(input.scope!=="GLOBAL"&&!input.scopeId)return res.status(400).json({message:"Template or product scope requires a target"});const row=await db.pricingRule.update({where:{id:req.params.id},data:{...input,scopeId:input.scope==="GLOBAL"?null:input.scopeId}});await audit(req,"UPDATE","PricingRule",row.id,{scope:row.scope,status:row.status});res.json(row)}));

const itemInput=z.object({productId:z.string(),quantity:z.coerce.number().positive(),unitPrice:z.coerce.number().nonnegative().optional(),discountRate:z.coerce.number().min(0).max(100).optional()});
const quotationInput=z.object({customerId:z.string(),contactId:z.string().optional().nullable(),templateId:z.string(),quotationDate:z.coerce.date(),validUntil:z.coerce.date(),subject:z.string().min(2).max(300),reference:z.string().max(300).optional(),inquiry:z.string().max(1000).optional(),clientCompanyName:z.string().max(160).optional(),clientAddress:z.string().max(1000).optional(),clientGstin:z.string().max(30).optional(),clientContactName:z.string().max(120).optional(),clientContactDesignation:z.string().max(120).optional(),clientEmail:z.string().email().or(z.literal("")).optional(),deliveryTerms:z.string().min(2).max(1000),paymentTerms:z.string().min(2).max(1000),terms:z.string().min(2).max(3000),notes:z.string().max(2000).optional(),freightAmount:z.coerce.number().nonnegative().default(0),placeOfSupplySameState:z.boolean().default(true),items:z.array(itemInput).min(1).max(50),status:z.enum(["DRAFT","ISSUED"]).default("DRAFT")});

async function resolveInput(body:any,role:Role){
  const input=quotationInput.parse(body); if(input.validUntil<input.quotationDate)throw new Error("Valid-until date cannot be before quotation date");
  // A quotation date represents the entire business day. A price created later
  // on that same date must still be valid for that quotation.
  const priceCutoff=new Date(input.quotationDate);priceCutoff.setUTCHours(23,59,59,999);
  const productIds=input.items.map(i=>i.productId);
  const [products,rules]=await Promise.all([
    db.product.findMany({where:{id:{in:productIds},status:"ACTIVE"},include:{prices:{where:{effectiveFrom:{lte:priceCutoff},OR:[{effectiveTo:null},{effectiveTo:{gte:input.quotationDate}}]},orderBy:{effectiveFrom:"desc"},take:1}}}),
    db.pricingRule.findMany({where:{status:"ACTIVE",OR:[{scope:"GLOBAL"},{scope:"TEMPLATE",scopeId:input.templateId},{scope:"PRODUCT",scopeId:{in:productIds}}]},orderBy:{createdAt:"asc"}})
  ]);
  const map=new Map(products.map(p=>[p.id,p]));
  const resolved=input.items.map(i=>{const p=map.get(i.productId);const price=p?.prices[0];if(!p||!price)throw new Error("A selected product has no active approved price");if(new Prisma.Decimal(i.quantity).lt(p.moq))throw new Error(`${p.name} requires minimum quantity ${p.moq}`);const rule=rules.find(r=>r.scope==="PRODUCT"&&r.scopeId===i.productId)||rules.find(r=>r.scope==="TEMPLATE"&&r.scopeId===input.templateId)||rules.find(r=>r.scope==="GLOBAL");const admin=role==="ADMIN";const requestedDiscount=admin&&i.discountRate!==undefined?i.discountRate:Number(price.defaultDiscount);const discountRate=rule?.maxDiscount!==null&&rule?.maxDiscount!==undefined?Math.min(requestedDiscount,Number(rule.maxDiscount)):requestedDiscount;return {source:i,product:p,price,rule,unitPrice:admin&&i.unitPrice!==undefined?i.unitPrice:Number(price.unitPrice),discountRate,gstRate:rule?.gstRateOverride!==null&&rule?.gstRateOverride!==undefined?Number(rule.gstRateOverride):Number(p.gstRate)};});
  const freightRule=rules.find(r=>r.scope==="TEMPLATE"&&r.scopeId===input.templateId&&r.fixedFreight!==null)||rules.find(r=>r.scope==="GLOBAL"&&r.fixedFreight!==null);
  const freightAmount=freightRule?.fixedFreight!==null&&freightRule?.fixedFreight!==undefined?Number(freightRule.fixedFreight):input.freightAmount;
  const calc=calculateQuotation({freightAmount,placeOfSupplySameState:input.placeOfSupplySameState,items:resolved.map(x=>({quantity:x.source.quantity,unitPrice:x.unitPrice,discountRate:x.discountRate,gstRate:x.gstRate}))});return {input,resolved,calc};
}

app.post("/api/quotations/preview", requireRole("ADMIN","QUOTATION_USER"), asyncRoute(async (req:any,res:any)=>{const {calc}=await resolveInput(req.body,req.user.role);res.json(serialiseCalculation(calc));}));
app.post("/api/quotations", requireRole("ADMIN","QUOTATION_USER"), asyncRoute(async (req:any,res:any)=>{
  const {input,resolved,calc}=await resolveInput(req.body,req.user.role);const template=await db.template.findUnique({where:{id:input.templateId}});if(!template||template.status!=="ACTIVE")return res.status(400).json({message:"Template unavailable"});
  const day=input.quotationDate.toISOString().slice(0,10).replaceAll("-","");
  const quotation=await db.$transaction(async tx=>{const seq=await tx.quotationSequence.upsert({where:{key:day},create:{key:day,lastNumber:1},update:{lastNumber:{increment:1}}});const quotationNumber=`${config.ENGINEER_CODE}/${config.COMPANY_CODE}/${day}/${String(seq.lastNumber).padStart(4,"0")}`;const lastColour=(await tx.quotation.findFirst({where:{accentColor:{not:null}},orderBy:{createdAt:"desc"},select:{accentColor:true}}))?.accentColor;const accentColor=ACCENT_PALETTE[(ACCENT_PALETTE.indexOf(lastColour||"")+1)%ACCENT_PALETTE.length]!;return tx.quotation.create({data:{quotationNumber,accentColor,customerId:input.customerId,contactId:input.contactId||null,templateId:template.id,templateVersion:template.version,quotationDate:input.quotationDate,validUntil:input.validUntil,subject:input.subject,reference:input.reference||null,inquiry:input.inquiry||null,clientCompanyName:input.clientCompanyName||null,clientAddress:input.clientAddress||null,clientGstin:input.clientGstin||null,clientContactName:input.clientContactName||null,clientContactDesignation:input.clientContactDesignation||null,clientEmail:input.clientEmail||null,deliveryTerms:input.deliveryTerms,paymentTerms:input.paymentTerms,terms:input.terms,notes:input.notes||null,subtotal:calc.subtotal.toString(),discountAmount:calc.discountAmount.toString(),taxableAmount:calc.taxableAmount.toString(),cgstAmount:calc.cgstAmount.toString(),sgstAmount:calc.sgstAmount.toString(),igstAmount:calc.igstAmount.toString(),freightAmount:calc.freightAmount.toString(),grandTotal:calc.grandTotal.toString(),status:input.status,createdById:req.user.id,items:{create:resolved.map((x,i)=>({productId:x.product.id,skuSnapshot:x.product.sku,imageKeySnapshot:x.product.imageKey||imageKeyFor(x.product.sku,x.product.name),detailsSnapshot:detailsFor(x.product),imagePathSnapshot:x.product.imagePath,moqSnapshot:x.product.moq,descriptionSnapshot:x.product.description,packageSizeSnapshot:x.product.packageSize,uomSnapshot:x.product.uom,quantity:calc.items[i]!.quantity.toString(),listPrice:x.price.listPrice,unitPrice:calc.items[i]!.unitPrice.toString(),discountRate:calc.items[i]!.discountRate.toString(),discountAmount:calc.items[i]!.discountAmount.toString(),taxableAmount:calc.items[i]!.taxableAmount.toString(),gstRate:calc.items[i]!.gstRate.toString(),gstAmount:calc.items[i]!.gstAmount.toString(),lineTotal:calc.items[i]!.lineTotal.toString()}))}},include:{customer:true,contact:true,items:true,createdBy:{select:{name:true}},template:true}});},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  await audit(req,"CREATE","Quotation",quotation.id,{quotationNumber:quotation.quotationNumber,status:quotation.status});res.status(201).json({id:quotation.id,quotationNumber:quotation.quotationNumber});
}));

app.get("/api/quotations", asyncRoute(async (req:any,res:any)=>{const q=String(req.query.q||"").slice(0,100);const from=req.query.from?new Date(String(req.query.from)):undefined;const to=req.query.to?new Date(`${String(req.query.to)}T23:59:59.999Z`):undefined;const status=String(req.query.status||"");const product=String(req.query.product||"");const where:any={...(req.user.role==="QUOTATION_USER"?{createdById:req.user.id}:{}),...(status?{status}:{}),...((from||to)?{quotationDate:{...(from?{gte:from}:{}),...(to?{lte:to}:{})}}:{}),...(product?{items:{some:{product:{name:{contains:product,mode:"insensitive"}}}}}:{}),...(q?{OR:[{quotationNumber:{contains:q,mode:"insensitive"}},{customer:{companyName:{contains:q,mode:"insensitive"}}},{subject:{contains:q,mode:"insensitive"}}]}:{})};const rows=await db.quotation.findMany({where,include:{customer:true,createdBy:{select:{name:true}}},orderBy:{createdAt:"desc"},take:250});res.json(rows.map(x=>({...x,grandTotal:x.grandTotal.toString()})));}));
app.get("/api/quotations/:id", asyncRoute(async (req:any,res:any)=>{const q=await db.quotation.findUnique({where:{id:req.params.id},include:{customer:true,contact:true,items:true,template:true,createdBy:{select:{name:true}}}});if(!q)return res.status(404).json({message:"Quotation not found"});if(req.user.role==="QUOTATION_USER"&&q.createdById!==req.user.id)return res.status(403).json({message:"Insufficient permission"});res.json(JSON.parse(JSON.stringify(q,(_k,v)=>Prisma.Decimal.isDecimal(v)?v.toString():v)));}));
app.put("/api/quotations/:id", requireRole("ADMIN","QUOTATION_USER"), asyncRoute(async (req:any,res:any)=>{
  const existing=await db.quotation.findUnique({where:{id:req.params.id}});
  if(!existing)return res.status(404).json({message:"Quotation not found"});
  if(req.user.role==="QUOTATION_USER"&&existing.createdById!==req.user.id)return res.status(403).json({message:"Insufficient permission"});
  if(existing.status==="CANCELLED"||existing.status==="REVISED")return res.status(409).json({message:"Create or open the current draft revision before editing"});
  const {input,resolved,calc}=await resolveInput(req.body,req.user.role);
  const template=await db.template.findUnique({where:{id:input.templateId}});
  if(!template||template.status!=="ACTIVE")return res.status(400).json({message:"Template unavailable"});
  const quotation=await db.$transaction(async tx=>{
    await tx.quotationItem.deleteMany({where:{quotationId:existing.id}});
    return tx.quotation.update({where:{id:existing.id},data:{
      customerId:input.customerId,contactId:input.contactId||null,templateId:template.id,templateVersion:template.version,
      quotationDate:input.quotationDate,validUntil:input.validUntil,subject:input.subject,reference:input.reference||null,
      inquiry:input.inquiry||null,clientCompanyName:input.clientCompanyName||null,clientAddress:input.clientAddress||null,
      clientGstin:input.clientGstin||null,clientContactName:input.clientContactName||null,clientContactDesignation:input.clientContactDesignation||null,
      clientEmail:input.clientEmail||null,deliveryTerms:input.deliveryTerms,paymentTerms:input.paymentTerms,terms:input.terms,
      notes:input.notes||null,subtotal:calc.subtotal.toString(),discountAmount:calc.discountAmount.toString(),
      taxableAmount:calc.taxableAmount.toString(),cgstAmount:calc.cgstAmount.toString(),sgstAmount:calc.sgstAmount.toString(),
      igstAmount:calc.igstAmount.toString(),freightAmount:calc.freightAmount.toString(),grandTotal:calc.grandTotal.toString(),
      status:input.status,pdfPath:null,docxPath:null,
      items:{create:resolved.map((x,i)=>({productId:x.product.id,skuSnapshot:x.product.sku,imageKeySnapshot:x.product.imageKey||imageKeyFor(x.product.sku,x.product.name),detailsSnapshot:detailsFor(x.product),imagePathSnapshot:x.product.imagePath,moqSnapshot:x.product.moq,descriptionSnapshot:x.product.description,
        packageSizeSnapshot:x.product.packageSize,uomSnapshot:x.product.uom,quantity:calc.items[i]!.quantity.toString(),
        listPrice:x.price.listPrice,unitPrice:calc.items[i]!.unitPrice.toString(),discountRate:calc.items[i]!.discountRate.toString(),
        discountAmount:calc.items[i]!.discountAmount.toString(),taxableAmount:calc.items[i]!.taxableAmount.toString(),
        gstRate:calc.items[i]!.gstRate.toString(),gstAmount:calc.items[i]!.gstAmount.toString(),lineTotal:calc.items[i]!.lineTotal.toString()}))}
    },include:{customer:true,contact:true,items:true,template:true}});
  });
  await audit(req,"UPDATE_REVISION","Quotation",quotation.id,{quotationNumber:quotation.quotationNumber,status:quotation.status});
  res.json({id:quotation.id,quotationNumber:quotation.quotationNumber,status:quotation.status});
}));
app.patch("/api/quotations/:id/status", requireRole("ADMIN"), asyncRoute(async (req:any,res:any)=>{const {status}=z.object({status:z.enum(["DRAFT","ISSUED","REVISED","CANCELLED"])}).parse(req.body);const row=await db.quotation.update({where:{id:req.params.id},data:{status}});await audit(req,"STATUS_CHANGE","Quotation",row.id,{status});res.json(row);}));
app.post("/api/quotations/:id/revise", requireRole("ADMIN","QUOTATION_USER"), asyncRoute(async (req:any,res:any)=>{
  const original=await db.quotation.findUnique({where:{id:req.params.id},include:{items:true}});
  if(!original)return res.status(404).json({message:"Quotation not found"});
  if(req.user.role==="QUOTATION_USER"&&original.createdById!==req.user.id)return res.status(403).json({message:"Insufficient permission"});
  const copy=await db.$transaction(async tx=>{
    await tx.quotation.update({where:{id:original.id},data:{status:"REVISED"}});
    return tx.quotation.create({data:{
      quotationNumber:`${original.quotationNumber}-R${original.revision+1}`,revision:original.revision+1,revisionOfId:original.id,
      customerId:original.customerId,contactId:original.contactId,templateId:original.templateId,templateVersion:original.templateVersion,
      quotationDate:new Date(),validUntil:original.validUntil,subject:original.subject,reference:original.reference,inquiry:original.inquiry,
      clientCompanyName:original.clientCompanyName,clientAddress:original.clientAddress,clientGstin:original.clientGstin,
      clientContactName:original.clientContactName,clientContactDesignation:original.clientContactDesignation,clientEmail:original.clientEmail,
      deliveryTerms:original.deliveryTerms,paymentTerms:original.paymentTerms,terms:original.terms,notes:original.notes,
      subtotal:original.subtotal,discountAmount:original.discountAmount,taxableAmount:original.taxableAmount,cgstAmount:original.cgstAmount,
      sgstAmount:original.sgstAmount,igstAmount:original.igstAmount,freightAmount:original.freightAmount,grandTotal:original.grandTotal,
      status:"DRAFT",accentColor:original.accentColor,createdById:req.user.id,
      items:{create:original.items.map(({id,quotationId,...item})=>item)}
    }});
  });
  await audit(req,"REVISE","Quotation",copy.id,{revisionOf:original.id});
  res.status(201).json({id:copy.id,quotationNumber:copy.quotationNumber});
}));

const documentView=(q:any)=>{const raw=JSON.parse(JSON.stringify(q,(_k,v)=>Prisma.Decimal.isDecimal(v)?v.toString():v));return {...raw,customer:{...raw.customer,companyName:raw.clientCompanyName||raw.customer.companyName,address:raw.clientAddress||raw.customer.address,gstNo:raw.clientGstin||raw.customer.gstNo},contact:(raw.clientContactName||raw.clientEmail)?{name:raw.clientContactName||raw.contact?.name||"",designation:raw.clientContactDesignation||raw.contact?.designation||null,phone:raw.contact?.phone||null,email:raw.clientEmail||raw.contact?.email||null}:raw.contact};};
// ---- Product pictures uploaded from the administrator's computer ----
// Files are content-addressed (sha256 name) and never overwritten, so quotations that
// snapshotted a picture keep rendering exactly the same PDF after the product picture changes.
const productImageFile=(name:string)=>path.join(path.resolve("storage/product-images"),path.basename(name));
app.get("/api/products/:id/image",asyncRoute(async(req:any,res:any)=>{const p=await db.product.findUnique({where:{id:req.params.id},select:{imagePath:true}});if(!p?.imagePath||!existsSync(productImageFile(p.imagePath)))return res.status(404).end();res.setHeader("Cache-Control","private, max-age=3600");res.setHeader("X-Content-Type-Options","nosniff");res.sendFile(productImageFile(p.imagePath))}));
app.put("/api/products/:id/image",requireRole("ADMIN"),asyncRoute(async(req:any,res:any)=>{const {imageData}=z.object({imageData:z.string().max(3_000_000)}).parse(req.body);const m=imageData.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);if(!m)return res.status(400).json({message:"Upload a PNG or JPG picture"});const buf=Buffer.from(m[2]!,"base64");const isPng=buf.subarray(0,4).equals(Buffer.from([0x89,0x50,0x4e,0x47])),isJpg=buf.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]));if(!buf.length||buf.length>2*1024*1024||!(isPng||isJpg))return res.status(400).json({message:"Picture must be a valid PNG or JPG under 2 MB"});const name=`${createHash("sha256").update(buf).digest("hex").slice(0,40)}.${isPng?"png":"jpg"}`;await mkdir(path.resolve("storage/product-images"),{recursive:true});await writeFile(productImageFile(name),buf);const p=await db.product.update({where:{id:req.params.id},data:{imagePath:name}});await audit(req,"PRODUCT_IMAGE_UPDATED","Product",p.id);res.json({ok:true})}));
app.delete("/api/products/:id/image",requireRole("ADMIN"),asyncRoute(async(req:any,res:any)=>{const p=await db.product.update({where:{id:req.params.id},data:{imagePath:null}});await audit(req,"PRODUCT_IMAGE_REMOVED","Product",p.id);res.json({ok:true})}));
app.get("/api/quotations/:id/docx", requireRole("ADMIN"), asyncRoute(async (_req:any,res:any)=>res.status(410).json({message:"Word export is disabled. Edit quotations inside the secure website and download the final flattened PDF."})));
app.get("/api/quotations/:id/pdf", asyncRoute(async (req:any,res:any)=>{const q=await db.quotation.findUnique({where:{id:req.params.id},include:{customer:true,contact:true,items:true}});if(!q)return res.status(404).json({message:"Quotation not found"});if(req.user.role==="QUOTATION_USER"&&q.createdById!==req.user.id)return res.status(403).json({message:"Insufficient permission"});const wantsRegenerate=req.query.regenerate==="true"&&req.user.role==="ADMIN";if(!wantsRegenerate&&q.pdfPath&&q.pdfLayout===PDF_LAYOUT_VERSION&&existsSync(q.pdfPath)){await audit(req,"DOWNLOAD_STORED_PDF","Quotation",q.id);res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`attachment; filename="${q.quotationNumber.replaceAll("/","-")}.pdf"`);res.setHeader("X-Content-Type-Options","nosniff");return res.sendFile(path.resolve(q.pdfPath))}const buffer=await buildPdf(documentView(q));await mkdir(path.resolve("storage/pdfs"),{recursive:true});const file=path.resolve("storage/pdfs",`${q.quotationNumber.replaceAll("/","-")}.pdf`);await writeFile(file,buffer);await db.quotation.update({where:{id:q.id},data:{pdfPath:file,pdfLayout:PDF_LAYOUT_VERSION,status:q.status==="DRAFT"?"ISSUED":q.status}});await audit(req,"GENERATE_FLATTENED_PDF","Quotation",q.id);res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`attachment; filename="${q.quotationNumber.replaceAll("/","-")}.pdf"`);res.setHeader("X-Content-Type-Options","nosniff");res.send(buffer);}));
app.get("/api/quotations/:id/preview", asyncRoute(async (req:any,res:any)=>{const q=await db.quotation.findUnique({where:{id:req.params.id},include:{customer:true,contact:true,items:true}});if(!q)return res.status(404).json({message:"Quotation not found"});if(req.user.role==="QUOTATION_USER"&&q.createdById!==req.user.id)return res.status(403).json({message:"Insufficient permission"});const buffer=await buildPdf(documentView(q));res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`inline; filename="${q.quotationNumber.replaceAll("/","-")}-preview.pdf"`);res.setHeader("Cache-Control","no-store");res.send(buffer);}));

app.get("/api/templates", asyncRoute(async (req:any,res:any)=>res.json(await db.template.findMany({where:{code:{notIn:["CASTROL","TEGUTEC"]},...(req.query.all==="true"?{}:{status:"ACTIVE"})},orderBy:[{name:"asc"},{version:"desc"}]}))));
app.post("/api/templates", requireRole("ADMIN"), asyncRoute(async (req:any,res:any)=>{const input=z.object({code:z.string().min(2).max(30).refine(v=>!["CASTROL","TEGUTEC"].includes(v.toUpperCase()),"Legacy client templates are not supported"),name:z.string().min(2).max(100),definition:z.record(z.string(),z.unknown()).default({})}).parse(req.body);const latest=await db.template.findFirst({where:{code:input.code.toUpperCase()},orderBy:{version:"desc"}});if(latest)await db.template.update({where:{id:latest.id},data:{status:"INACTIVE"}});const row=await db.template.create({data:{code:input.code.toUpperCase(),name:input.name,version:(latest?.version||0)+1,definition:input.definition as Prisma.InputJsonValue}});await audit(req,"CREATE_VERSION","Template",row.id,{version:row.version});res.status(201).json(row);}));
app.get("/api/audit-logs", requireRole("ADMIN"), asyncRoute(async (req:any,res:any)=>{const action=String(req.query.action||"").slice(0,80),entity=String(req.query.entity||"").slice(0,80),user=String(req.query.user||"").slice(0,120),from=req.query.from?new Date(String(req.query.from)):undefined,to=req.query.to?new Date(`${String(req.query.to)}T23:59:59.999Z`):undefined;const rows=await db.auditLog.findMany({where:{...(action?{action:{contains:action,mode:"insensitive"}}:{}),...(entity?{entity:{contains:entity,mode:"insensitive"}}:{}),...(user?{user:{OR:[{name:{contains:user,mode:"insensitive"}},{email:{contains:user,mode:"insensitive"}}]}}:{}),...((from||to)?{createdAt:{...(from?{gte:from}:{}),...(to?{lte:to}:{})}}:{})},include:{user:{select:{name:true,email:true}}},orderBy:{createdAt:"desc"},take:500});res.json(rows)}));
app.get("/api/users", requireRole("ADMIN"), asyncRoute(async (_req:any,res:any)=>res.json(await db.user.findMany({select:{id:true,name:true,email:true,role:true,status:true,createdAt:true},orderBy:{name:"asc"}}))));
app.post("/api/users", requireRole("ADMIN"), asyncRoute(async (req:any,res:any)=>{const input=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(12),role:z.enum(["ADMIN","QUOTATION_USER","VIEWER"])}).parse(req.body);const user=await db.user.create({data:{name:input.name,email:input.email.toLowerCase(),passwordHash:await argon2.hash(input.password,{type:argon2.argon2id}),role:input.role}});await audit(req,"CREATE","User",user.id,{role:user.role});res.status(201).json(safeUser(user));}));
app.put("/api/users/:id", requireRole("ADMIN"), asyncRoute(async (req:any,res:any)=>{const input=z.object({name:z.string().min(2),role:z.enum(["ADMIN","QUOTATION_USER","VIEWER"]),status:z.enum(["ACTIVE","INACTIVE"]),password:z.string().min(12).optional()}).parse(req.body);if(req.params.id===req.user.id&&input.status==="INACTIVE")return res.status(400).json({message:"You cannot deactivate your own account"});const row=await db.user.update({where:{id:req.params.id},data:{name:input.name,role:input.role,status:input.status,...(input.password?{passwordHash:await argon2.hash(input.password,{type:argon2.argon2id})}:{})}});await audit(req,"UPDATE","User",row.id,{role:row.role,status:row.status});res.json(safeUser(row));}));
app.get("/api/reports/summary", requireRole("ADMIN","VIEWER"), asyncRoute(async (req:any,res:any)=>{const from=req.query.from?new Date(String(req.query.from)):new Date(new Date().getFullYear(),0,1);const to=req.query.to?new Date(`${String(req.query.to)}T23:59:59.999Z`):new Date();const where:any={quotationDate:{gte:from,lte:to}};const [byStatus,byCustomer,items]=await Promise.all([db.quotation.groupBy({by:["status"],where,_count:{_all:true},_sum:{grandTotal:true}}),db.quotation.groupBy({by:["customerId"],where,_count:{_all:true},_sum:{grandTotal:true},orderBy:{_sum:{grandTotal:"desc"}},take:20}),db.quotationItem.findMany({where:{quotation:{quotationDate:{gte:from,lte:to}}},select:{productId:true,descriptionSnapshot:true,quantity:true,lineTotal:true}})]);const customers=await db.customer.findMany({where:{id:{in:byCustomer.map(x=>x.customerId)}},select:{id:true,companyName:true}});const names=new Map(customers.map(x=>[x.id,x.companyName]));const products=new Map<string,{product:string,quantity:Prisma.Decimal,value:Prisma.Decimal}>();for(const i of items){const key=i.productId||i.descriptionSnapshot;const x=products.get(key)||{product:i.descriptionSnapshot,quantity:new Prisma.Decimal(0),value:new Prisma.Decimal(0)};x.quantity=x.quantity.add(i.quantity);x.value=x.value.add(i.lineTotal);products.set(key,x)}res.json({from,to,byStatus:byStatus.map(x=>({...x,total:x._sum.grandTotal?.toString()||"0"})),byCustomer:byCustomer.map(x=>({customer:names.get(x.customerId)||x.customerId,count:x._count._all,total:x._sum.grandTotal?.toString()||"0"})),byProduct:[...products.values()].map(x=>({product:x.product,quantity:x.quantity.toString(),value:x.value.toString()}))});}));
const csvCell=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;
app.get("/api/reports/quotation-register.csv", requireRole("ADMIN","VIEWER"), asyncRoute(async (req:any,res:any)=>{const from=req.query.from?new Date(String(req.query.from)):new Date(new Date().getFullYear(),0,1),to=req.query.to?new Date(`${String(req.query.to)}T23:59:59.999Z`):new Date();const rows=await db.quotation.findMany({where:{quotationDate:{gte:from,lte:to}},include:{customer:true,createdBy:{select:{name:true}}},orderBy:{quotationDate:"asc"}});const header=["Quotation Number","Date","Customer","Status","Owner","Grand Total"].map(csvCell).join(",");const body=rows.map(q=>[q.quotationNumber,q.quotationDate.toISOString().slice(0,10),q.customer.companyName,q.status,q.createdBy.name,q.grandTotal.toString()].map(csvCell).join(","));res.setHeader("Content-Type","text/csv; charset=utf-8");res.setHeader("Content-Disposition",'attachment; filename="quotation-register.csv"');res.send(`\uFEFF${[header,...body].join("\r\n")}`)}));

app.use((err:any,_req:any,res:any,_next:any)=>{if(err instanceof z.ZodError)return res.status(400).json({message:"Validation failed",issues:err.issues.map((i:any)=>({path:i.path.join("."),message:i.message}))});console.error(err instanceof Error?err.message:"Unexpected error");const safe=err instanceof Error&&(err.message==="Invalid calculation value"||err.message==="Valid-until date cannot be before quotation date"||err.message.includes("requires minimum quantity")||err.message.includes("no active approved price"));res.status(safe?400:500).json({message:safe?err.message:"Unable to process request"});});

const server=app.listen(config.PORT,()=>console.log(`Quotation API running on http://localhost:${config.PORT}`));
// Fill rich product content once for catalogue SKUs that have none yet. Admin edits are never overwritten.
(async()=>{try{for(const [sku,details] of Object.entries(CATALOGUE_DETAILS)){await db.product.updateMany({where:{sku,details:null},data:{details:JSON.stringify(details)}})}}catch(error){console.warn("Product content enrichment skipped:",error instanceof Error?error.message:"unknown error")}})();
process.on("SIGTERM",async()=>{server.close();await db.$disconnect();});
