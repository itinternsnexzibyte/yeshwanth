import PDFDocument from "pdfkit";
import { PDFDocument as PDFLibDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, ImageRun, AlignmentType, WidthType, ShadingType, BorderStyle } from "docx";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { CATALOGUE_DETAILS, imageKeyFor, parseDetails, productImagePath } from "./productCatalogue.js";

/** Bump only when the PDF layout intentionally changes; stored PDFs from an older layout are rebuilt from the saved snapshot. */
export const PDF_LAYOUT_VERSION="2026.10.23";
export const ACCENT_PALETTE=["#6B4BC3","#3563C7","#D94841","#27864A","#E87522","#0F8B8D","#A23E8C","#C05A18"];

type View = {
  accentColor?: string | null; quotationNumber: string; quotationDate: Date | string; validUntil: Date | string; subject: string; reference: string | null;
  inquiry: string | null; deliveryTerms: string; paymentTerms: string; terms: string; notes: string | null;
  subtotal: string; discountAmount: string; taxableAmount: string; cgstAmount: string; sgstAmount: string; igstAmount: string; freightAmount: string; grandTotal: string;
  customer: { companyName: string; address: string; gstNo: string | null };
  contact: { name: string; designation: string | null; phone: string | null; email: string | null } | null;
  items: Array<{ skuSnapshot?: string | null; imageKeySnapshot?: string | null; imagePathSnapshot?: string | null; moqSnapshot?: string | number | null; detailsSnapshot?: string | null; descriptionSnapshot: string; packageSizeSnapshot: string; uomSnapshot: string; quantity: string; listPrice: string; unitPrice: string; discountRate: string; taxableAmount?: string; gstRate: string; lineTotal: string }>;
};

const inr = (v: string) => `INR ${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
const belowThousand = (n:number):string => {
  const words:string[]=[];
  if(n>=100){words.push(`${ones[Math.floor(n/100)]} Hundred`);n%=100;}
  if(n>=20){words.push(tens[Math.floor(n/10)]!);if(n%10)words.push(ones[n%10]!);}
  else if(n>0)words.push(ones[n]!);
  return words.join(" ");
};
const integerWords = (n:number):string => {
  if(n===0)return "Zero";
  const words:string[]=[];
  const crore=Math.floor(n/10_000_000);if(crore){words.push(`${integerWords(crore)} Crore`);n%=10_000_000;}
  const lakh=Math.floor(n/100_000);if(lakh){words.push(`${belowThousand(lakh)} Lakh`);n%=100_000;}
  const thousand=Math.floor(n/1_000);if(thousand){words.push(`${belowThousand(thousand)} Thousand`);n%=1_000;}
  if(n)words.push(belowThousand(n));
  return words.join(" ");
};
export const amountInWords = (value:string) => {
  const amount=Number(value);if(!Number.isFinite(amount)||amount<0)return "Amount unavailable";
  const paise=Math.round(amount*100)%100;const rupees=Math.floor(Math.round(amount*100)/100);
  return `Rupees ${integerWords(rupees)}${paise?` and ${integerWords(paise)} Paise`:""} Only`;
};
const date = (value: Date | string) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
};
const borders = { top:{style:BorderStyle.SINGLE,size:1,color:"D8DEE9"}, bottom:{style:BorderStyle.SINGLE,size:1,color:"D8DEE9"}, left:{style:BorderStyle.SINGLE,size:1,color:"D8DEE9"}, right:{style:BorderStyle.SINGLE,size:1,color:"D8DEE9"}, insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:"D8DEE9"}, insideVertical:{style:BorderStyle.SINGLE,size:1,color:"D8DEE9"} };

export async function buildDocx(q: View) {
  const logo=await readFile(path.resolve(config.COMPANY_LOGO_PATH)).catch(()=>null);
  const brochure=await readFile(path.resolve(config.COMPANY_BROCHURE_PATH)).catch(()=>null);
  const signature=await readFile(path.resolve(config.QUOTATION_SIGNATURE_PATH)).catch(()=>null);
  const p = (label: string, value: string, bold=false) => new Paragraph({ children:[new TextRun({text: label, bold:true}), new TextRun({text:value, bold})], spacing:{after:80} });
  const rows = q.items.map((item, i) => new TableRow({ children:[
    new TableCell({children:[new Paragraph(String(i+1))]}), new TableCell({children:[new Paragraph(item.descriptionSnapshot)]}),
    new TableCell({children:[new Paragraph({text:item.quantity,alignment:AlignmentType.CENTER})]}), new TableCell({children:[new Paragraph({text:inr(item.unitPrice),alignment:AlignmentType.RIGHT})]}),
    new TableCell({children:[new Paragraph({text:`${item.gstRate}%`,alignment:AlignmentType.CENTER})]}), new TableCell({children:[new Paragraph({text:inr(item.lineTotal),alignment:AlignmentType.RIGHT})]})
  ]}));
  const doc = new Document({ sections:[{ properties:{page:{margin:{top:720,right:720,bottom:720,left:720}}}, children:[
    ...(logo?[new Paragraph({children:[new ImageRun({data:logo,type:"png",transformation:{width:210,height:79}})],spacing:{after:100}})]:[new Paragraph({children:[new TextRun({text:config.COMPANY_NAME,bold:true,size:30,color:"14213D"})]})]),
    new Paragraph(`${config.COMPANY_ADDRESS} | ${config.COMPANY_PHONE}`), new Paragraph(`${config.COMPANY_EMAIL} | ${config.COMPANY_WEBSITE}${config.COMPANY_GSTIN ? ` | GSTIN ${config.COMPANY_GSTIN}`:""}`),
    new Paragraph({text:"QUOTATION",heading:"Title",alignment:AlignmentType.RIGHT}),
    p("Quotation No.: ",q.quotationNumber,true), p("Quotation Date: ",date(q.quotationDate)), p("Valid Until: ",date(q.validUntil)),
    new Table({width:{size:100,type:WidthType.PERCENTAGE},borders,rows:[new TableRow({children:[
      new TableCell({children:[p("QUOTE TO\n",q.customer.companyName,true),new Paragraph(q.customer.address),new Paragraph(q.customer.gstNo?`GSTIN: ${q.customer.gstNo}`:"")]}),
      new TableCell({children:[p("SUBJECT\n",q.subject,true),p("Reference: ",q.reference||"-"),p("Inquiry: ",q.inquiry||"-")]})
    ]})]}),
    new Paragraph({text:"",spacing:{after:100}}),
    new Table({width:{size:100,type:WidthType.PERCENTAGE},borders,rows:[new TableRow({tableHeader:true,children:["#","DESCRIPTION","QTY","UNIT PRICE","GST","AMOUNT"].map(x=>new TableCell({shading:{type:ShadingType.CLEAR,fill:"14213D"},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:x,bold:true,color:"FFFFFF"})]})]}))}),...rows]}),
    new Paragraph({text:"",spacing:{after:80}}),
    p("Subtotal: ",inr(q.subtotal)),p("Discount: ",inr(q.discountAmount)),p("Taxable Amount: ",inr(q.taxableAmount)),
    ...(Number(q.igstAmount)>0?[p("IGST: ",inr(q.igstAmount))]:[p("CGST: ",inr(q.cgstAmount)),p("SGST: ",inr(q.sgstAmount))]),
    p("Freight: ",inr(q.freightAmount)),p("GRAND TOTAL: ",inr(q.grandTotal),true),p("Amount in words: ",amountInWords(q.grandTotal),true),
    new Paragraph({text:"TERMS & CONDITIONS",heading:"Heading2"}),new Paragraph(q.terms),new Paragraph({text:"PAYMENT TERMS",heading:"Heading2"}),new Paragraph(q.paymentTerms),
    new Paragraph({text:"NOTES",heading:"Heading2"}),new Paragraph(q.notes||"Thank you for the opportunity to quote."),new Paragraph({text:`For ${config.COMPANY_NAME}`,spacing:{before:220,after:30}}),
    ...(signature?[new Paragraph({children:[new ImageRun({data:signature,type:"png",transformation:{width:110,height:66}})],spacing:{after:0}})]:[]),
    new Paragraph({children:[new TextRun({text:config.SIGNATORY_NAME,bold:true})],spacing:{before:0,after:20}}),new Paragraph(config.SIGNATORY_DESIGNATION),
    ...(brochure?[new Paragraph({pageBreakBefore:true,alignment:AlignmentType.CENTER,children:[new ImageRun({data:brochure,type:"png",transformation:{width:500,height:168}})]})]:[])
  ]}]});
  return Packer.toBuffer(doc);
}

/**
 * Builds the approved quotation layout and then flattens every form field.
 * Staff edit the quotation only through the authenticated website. The final
 * PDF contains the approved values as page content, with no editable AcroForm
 * controls for a recipient to change.
 */
export function buildPdf(q: View): Promise<Buffer> {
  return new Promise((resolve,reject)=>{
    const doc = new PDFDocument({size:"A4",margin:0,bufferPages:true,info:{Title:`Quotation ${q.quotationNumber}`,Author:config.COMPANY_NAME,Subject:q.subject,Keywords:"final flattened quotation"}});
    const chunks:Buffer[]=[];
    doc.on("data",c=>chunks.push(c));
    doc.on("end",async()=>{
      try {
        // PDFKit creates the AcroForm fields; pdf-lib writes explicit appearance
        // streams so their prefilled values display consistently in every viewer.
        const pdf=await PDFLibDocument.load(Buffer.concat(chunks));
        const font=await pdf.embedFont(StandardFonts.Helvetica);
        const form=pdf.getForm();
        form.updateFieldAppearances(font);
        form.flatten();
        pdf.setProducer(`${config.COMPANY_NAME} Secure Quotation System`);
        pdf.setCreator("NexziByte Quotation Management");
        resolve(Buffer.from(await pdf.save({useObjectStreams:false})));
      } catch(error) { reject(error); }
    });
    doc.on("error",reject);
    // Preserve the logo and layout; rotate only quotation outline/accent colours.
    // The colour is chosen once when the quotation is created (rotated so that
    // consecutive quotations differ) and stored, so preview and download match.
    // Older quotations without a stored colour fall back to a stable hash.
    const colourSeed=Array.from(`${q.quotationNumber||"NEXZIBYTE"}|${q.accentColor||""}`).reduce((hash,ch)=>(Math.imul(hash,31)+ch.charCodeAt(0))>>>0,7);
    const stored=q.accentColor&&/^#[0-9a-fA-F]{6}$/.test(q.accentColor)?q.accentColor:null;
    const purple=stored||ACCENT_PALETTE[colourSeed%ACCENT_PALETTE.length]!;
    const ink="#17264f", pale="#f8fafc", line=purple, gold=purple, white="#ffffff";
    const left=60, right=535, pageWidth=475;
    // Initialise the form with a different default font so each text widget gets
    // an explicit, stable font size in its appearance dictionary.
    doc.font("Helvetica-Bold");
    doc.initForm();

    const clean=(value:unknown)=>String(value??"").replace(/[\u2013\u2014]/g,"-");
    const money=(value:string)=>Number(value).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
    const editable=(name:string,value:unknown,x:number,y:number,w:number,h:number,options:any={})=>{
      doc.font("Helvetica").formText(name,x,y,w,h,{
        value:clean(value),defaultValue:clean(value),fontSize:options.fontSize||7,
        multiline:Boolean(options.multiline),align:options.align||"left",noSpell:true,
        borderColor:options.borderColor||white,backgroundColor:options.backgroundColor||white,
        borderWidth:options.borderWidth??0
      });
    };
    const label=(text:string,x:number,y:number,w:number,align:"left"|"right"|"center"="left")=>doc.fillColor(ink).font("Helvetica-Bold").fontSize(7).text(text,x,y,{width:w,align,lineBreak:false});
    const rule=(y:number)=>doc.save().strokeColor(purple).lineWidth(1.8).moveTo(left,y).lineTo(right,y).stroke().restore();

    // Header - preserved exactly for every project quotation.
    const logoPath=path.resolve(config.COMPANY_LOGO_PATH);
    if(existsSync(logoPath))doc.image(logoPath,left,58,{fit:[185,66]});
    else doc.fillColor(ink).font("Helvetica-Bold").fontSize(19).text(config.COMPANY_NAME,left,72,{width:230});
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text(config.COMPANY_NAME,330,65,{width:205,align:"right"});
    doc.font("Helvetica").fontSize(7.3).text(config.COMPANY_ADDRESS,330,82,{width:205,align:"right"})
      .text(config.COMPANY_WEBSITE,330,94,{width:205,align:"right"}).text(config.COMPANY_EMAIL,330,106,{width:205,align:"right"})
      .text(config.COMPANY_PHONE,330,118,{width:205,align:"right"});
    rule(138);
    doc.fillColor(purple).font("Helvetica-Bold").fontSize(22).text("QUOTATION",left,154,{width:235});
    label("Quotation No:",390,154,70,"right"); editable("quotation.number",q.quotationNumber,464,149,71,15,{fontSize:7,align:"right"});
    label("Date:",390,171,70,"right"); editable("quotation.date",date(q.quotationDate),464,166,71,15,{fontSize:7,align:"right"});
    label("Valid Until:",390,188,70,"right"); editable("quotation.validUntil",date(q.validUntil),464,183,71,15,{fontSize:7,align:"right"});

    // Supplier and client cards.
    const cardY=211,cardH=120,gap=10,cardW=(pageWidth-gap)/2;
    for(const x of [left,left+cardW+gap])doc.roundedRect(x,cardY,cardW,cardH,3).lineWidth(.7).strokeColor(line).stroke();
    doc.fillColor(purple).rect(left,cardY,cardW,22).fill().rect(left+cardW+gap,cardY,cardW,22).fill();
    doc.fillColor(white).font("Helvetica-Bold").fontSize(7.5).text("FROM - YOUR COMPANY",left+8,cardY+8,{width:cardW-16})
      .text("QUOTATION TO - CLIENT DETAILS",left+cardW+gap+8,cardY+8,{width:cardW-16});
    const fromX=left+8,toX=left+cardW+gap+8,innerW=cardW-16;
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(7.3).text(config.COMPANY_NAME,fromX,cardY+32,{width:innerW});
    doc.font("Helvetica").fontSize(7.1).text(config.COMPANY_ADDRESS,fromX,cardY+48,{width:innerW,height:20})
      .text(`Website: ${config.COMPANY_WEBSITE}`,fromX,cardY+70,{width:innerW})
      .text(`Email: ${config.COMPANY_EMAIL}`,fromX,cardY+84,{width:innerW})
      .text(`Phone: ${config.COMPANY_PHONE}`,fromX,cardY+98,{width:innerW});
    editable("client.companyName",q.customer.companyName,toX,cardY+29,innerW,15,{fontSize:7.3});
    editable("client.address",q.customer.address,toX,cardY+44,innerW,27,{fontSize:7,multiline:true});
    editable("client.gstin",q.customer.gstNo?`GSTIN: ${q.customer.gstNo}`:"GSTIN:",toX,cardY+71,innerW,14,{fontSize:7});
    editable("client.attention",q.contact?`Kind Attention: ${q.contact.name}${q.contact.designation?` - ${q.contact.designation}`:""}`:"Kind Attention:",toX,cardY+85,innerW,14,{fontSize:7});
    editable("client.email",q.contact?.email?`Email: ${q.contact.email}`:"Email:",toX,cardY+99,innerW,14,{fontSize:7});

    // Project-specific subject block.
    const subjectY=340;
    doc.fillColor(pale).rect(left,subjectY,pageWidth,39).fill();
    doc.fillColor(purple).rect(left,subjectY,2,39).fill();
    label("Subject:",left+9,subjectY+8,45); editable("project.subject",q.subject,left+55,subjectY+3,pageWidth-64,17,{fontSize:7.2});
    label("Reference:",left+9,subjectY+23,45); editable("project.reference",q.reference||q.inquiry||"-",left+55,subjectY+18,pageWidth-64,17,{fontSize:7.2});

    // Exact line-item structure from the supplied template.
    let y=389;
    const widths=[129,44,26,26,27,48,47,67,23,38];
    const headers=["DESCRIPTION","PACKAGE","QTY","UOM","MOQ","LIST PRICE","DISCOUNT","LANDING PRICE","GST","AMOUNT"];
    doc.fillColor(purple).rect(left,y,pageWidth,18).fill();
    let x=left;
    doc.fillColor(white).font("Helvetica-Bold").fontSize(4.7);
    headers.forEach((h,i)=>{doc.text(h,x+2,y+6,{width:widths[i]!-4,align:i>=2?"right":"left",lineBreak:false});x+=widths[i]!});
    y+=18;
    const rowH=Math.max(12,Math.min(22,Math.floor(116/Math.max(q.items.length,1))));
    q.items.forEach((item,i)=>{
      x=left;
      const discount=`${Number(item.discountRate).toLocaleString("en-IN",{maximumFractionDigits:2})}%`;
      // MOQ comes from the product snapshot. Landing price = price per unit after discount (taxable amount / quantity), before GST; confirm the client's rule in Phase 1.
      const qty=Number(item.quantity),landing=qty>0&&item.taxableAmount!==undefined?(Number(item.taxableAmount)/qty).toFixed(2):item.unitPrice;
      const values=[item.descriptionSnapshot,item.packageSizeSnapshot,item.quantity,item.uomSnapshot,item.moqSnapshot!==null&&item.moqSnapshot!==undefined?String(item.moqSnapshot):"-",money(item.listPrice),discount,money(landing),`${Number(item.gstRate).toLocaleString("en-IN",{maximumFractionDigits:2})}%`,money(item.lineTotal)];
      const names=["description","package","quantity","uom","moq","listPrice","discount","landingPrice","gst","amount"];
      values.forEach((value,j)=>{
        doc.rect(x,y,widths[j]!,rowH).lineWidth(.45).strokeColor(line).stroke();
        editable(`items.${i+1}.${names[j]}`,value,x+2,y+2,widths[j]!-4,rowH-4,{fontSize:j===0?5.2:5.1,align:j>=2?"right":"left",multiline:j===0});
        x+=widths[j]!;
      });
      y+=rowH;
    });

    y+=10;
    const totalTop=y,wordsW=280,totalX=left+wordsW+12,totalW=pageWidth-wordsW-12;
    doc.roundedRect(left,totalTop,wordsW,75,3).lineWidth(.7).strokeColor(line).stroke();
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(6.3).text("TOTAL AMOUNT IN WORDS",left+8,totalTop+8,{width:wordsW-16});
    editable("totals.amountInWords",amountInWords(q.grandTotal),left+8,totalTop+22,wordsW-16,43,{fontSize:7.1,multiline:true});
    const totalRows:Array<[string,string]>=[["Subtotal",q.subtotal],["Tax / GST",String(Number(q.cgstAmount)+Number(q.sgstAmount)+Number(q.igstAmount))],["Freight / Other",q.freightAmount]];
    totalRows.forEach(([name,value],i)=>{
      const ty=totalTop+i*18;
      doc.fillColor(i%2?pale:white).rect(totalX,ty,totalW,18).fill();
      doc.fillColor(ink).font("Helvetica").fontSize(6).text(name,totalX+4,ty+6,{width:82});
      editable(`totals.${name.replaceAll(" ","").replace("/","").toLowerCase()}`,money(value),totalX+88,ty+2,totalW-92,14,{fontSize:6.3,align:"right"});
    });
    const grandY=totalTop+57;
    doc.fillColor("#fff5c7").rect(totalX,grandY,totalW,24).fill(); doc.strokeColor(gold).lineWidth(1).moveTo(totalX,grandY).lineTo(totalX+totalW,grandY).stroke();
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text("GRAND TOTAL",totalX+4,grandY+8,{width:82});
    editable("totals.grandTotal",money(q.grandTotal),totalX+88,grandY+3,totalW-92,17,{fontSize:9,align:"right"});

    // Terms and signatures remain editable while preserving the approved layout.
    const termsY=totalTop+98;
    doc.font("Helvetica").fontSize(6.3);
    const termsText=clean(q.terms).replace(/\r\n?/g,"\n").trim(), termsOpts={width:pageWidth,lineGap:1.2};
    const termsH=Math.max(48,Math.ceil(doc.heightOfString(termsText,termsOpts))+4), dy=termsH-48;
    doc.strokeColor(line).lineWidth(.6).moveTo(left,termsY).lineTo(right,termsY).stroke();
    label("TERMS & CONDITIONS",left,termsY+11,170);
    // Drawn as page text (not a form field) so every term line is always fully visible; the PDF is flattened anyway.
    doc.fillColor("#000000").font("Helvetica").fontSize(6.3).text(termsText,left,termsY+24,termsOpts);
    label("Payment terms:",left,termsY+75+dy,66); editable("terms.payment",q.paymentTerms,left+68,termsY+70+dy,407,15,{fontSize:6.5});
    label("Delivery terms:",left,termsY+90+dy,66); editable("terms.delivery",q.deliveryTerms,left+68,termsY+85+dy,407,15,{fontSize:6.5});
    label("Quotation validity:",left,termsY+105+dy,78); editable("terms.validity",`Valid until ${date(q.validUntil)}`,left+80,termsY+100+dy,395,15,{fontSize:6.5});
    const signY=Math.min(764,termsY+142+dy);
    doc.strokeColor(ink).lineWidth(.6).moveTo(left,signY).lineTo(287,signY).stroke().moveTo(310,signY).lineTo(right,signY).stroke();
    editable("signature.customer","Customer acceptance / authorised signatory",left,signY+6,227,16,{fontSize:7,align:"center"});
    const signaturePath=path.resolve(config.QUOTATION_SIGNATURE_PATH);
    if(existsSync(signaturePath))doc.image(signaturePath,365,signY-35,{fit:[105,30]});
    editable("signature.company",`For ${config.COMPANY_NAME}\n${config.SIGNATORY_NAME} - ${config.SIGNATORY_DESIGNATION}`,310,signY+4,225,30,{fontSize:6.8,align:"center",multiline:true});
    const footerY=Math.min(818,signY+44);
    doc.strokeColor(line).lineWidth(.5).moveTo(left,footerY).lineTo(right,footerY).stroke();
    doc.fillColor("#64748b").font("Helvetica").fontSize(5.7).text(`${config.COMPANY_NAME} | ${config.COMPANY_ADDRESS} | ${config.COMPANY_WEBSITE}`,left,footerY+8,{width:pageWidth,align:"center"});

    // ---- Product specification pages (added after the approved one-page layout, which is unchanged) ----
    const seen=new Set<string>();
    const products=q.items.map(item=>{
      const key=item.skuSnapshot||item.descriptionSnapshot; if(seen.has(key))return null; seen.add(key);
      const details=parseDetails(item.detailsSnapshot)||(item.skuSnapshot?CATALOGUE_DETAILS[item.skuSnapshot]:null)||null;
      return details?{item,details,image:item.imageKeySnapshot||imageKeyFor(item.skuSnapshot||"",item.descriptionSnapshot)}:null;
    }).filter((x):x is NonNullable<typeof x>=>Boolean(x));
    if(products.length){
      const annexHeader=()=>{
        doc.addPage();
        if(existsSync(logoPath))doc.image(logoPath,left,36,{fit:[120,44]});
        doc.fillColor(purple).font("Helvetica-Bold").fontSize(14).text("PRODUCT SPECIFICATIONS",300,40,{width:235,align:"right",lineBreak:false});
        doc.fillColor("#64748b").font("Helvetica").fontSize(7).text(`Quotation ${clean(q.quotationNumber)}`,300,60,{width:235,align:"right",lineBreak:false});
        doc.save().strokeColor(purple).lineWidth(1.8).moveTo(left,92).lineTo(right,92).stroke().restore();
        return 108;
      };
      const annexFooter=()=>{
        doc.save().strokeColor(line).lineWidth(.5).moveTo(left,806).lineTo(right,806).stroke().restore();
        doc.fillColor("#64748b").font("Helvetica").fontSize(5.7).text(`${config.COMPANY_NAME} | ${clean(config.COMPANY_ADDRESS)} | ${config.COMPANY_WEBSITE}  -  Specifications are indicative and subject to manufacturer changes.`,left,814,{width:pageWidth,align:"center",lineBreak:false});
      };
      let py=annexHeader();
      for(const {item,details,image} of products){
        const imgW=150,imgH=112,textX=left+imgW+24,textW=pageWidth-imgW-36;
        const title=clean(item.descriptionSnapshot).split(/[.;]/)[0]!.slice(0,90);
        doc.font("Helvetica").fontSize(7.2);
        const highlights=details.highlights.slice(0,6).map(clean);
        const hlH=highlights.reduce((sum,t)=>sum+doc.heightOfString(`- ${t}`,{width:textW})+3,0);
        const textH=16+doc.heightOfString(clean(item.descriptionSnapshot),{width:textW})+8+hlH;
        const topH=Math.max(imgH+20,textH+16);
        const specs=details.specs.slice(0,30).map(x=>({label:clean(x.label),value:clean(x.value)}));
        doc.font("Helvetica").fontSize(6.8);
        const rowHs=specs.map(x=>Math.max(14,doc.heightOfString(x.value,{width:pageWidth-186})+6));
        const specH=specs.length?24+rowHs.reduce((a,b)=>a+b,0):0;
        const blockH=topH+specH+14;
        if(py+blockH>796&&py>130){annexFooter();py=annexHeader();}
        doc.roundedRect(left,py,pageWidth,Math.min(blockH,796-py),6).lineWidth(.8).strokeColor(line).stroke();
        doc.fillColor(pale).roundedRect(left+8,py+10,imgW+8,imgH+8,6).fill();
        const imageFile=item.imagePathSnapshot&&existsSync(path.resolve("storage/product-images",path.basename(item.imagePathSnapshot)))?path.resolve("storage/product-images",path.basename(item.imagePathSnapshot)):productImagePath(image);
        if(existsSync(imageFile))doc.image(imageFile,left+12,py+14,{fit:[imgW,imgH],align:"center",valign:"center"});
        let ty=py+14;
        doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text(title,textX,ty,{width:textW,lineBreak:false}); ty+=16;
        doc.fillColor("#475569").font("Helvetica").fontSize(7.2).text(clean(item.descriptionSnapshot),textX,ty,{width:textW}); ty=doc.y+8;
        for(const h of highlights){doc.fillColor(purple).font("Helvetica-Bold").fontSize(7.2).text("-",textX,ty,{width:8,lineBreak:false});doc.fillColor(ink).font("Helvetica").fontSize(7.2).text(h,textX+9,ty,{width:textW-9});ty=doc.y+3;}
        let sy=py+topH;
        if(specs.length){
          doc.fillColor(purple).rect(left+8,sy,pageWidth-16,16).fill();
          doc.fillColor(white).font("Helvetica-Bold").fontSize(7).text("SPECIFICATIONS",left+14,sy+5,{width:200,lineBreak:false}); sy+=16;
          specs.forEach((x,i)=>{
            const h=rowHs[i]!;
            if(i%2===0)doc.fillColor(pale).rect(left+8,sy,pageWidth-16,h).fill();
            doc.fillColor(ink).font("Helvetica-Bold").fontSize(6.8).text(x.label,left+14,sy+3.5,{width:150});
            doc.fillColor("#334155").font("Helvetica").fontSize(6.8).text(x.value,left+172,sy+3.5,{width:pageWidth-186});
            sy+=h;
          });
        }
        py+=blockH+12;
      }
      annexFooter();
    }
    doc.end();
  });
}
