import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const template = { code: "NEXZIBYTE", name: "NexziByte quotation format" };
  const existing = await db.template.findFirst({ where: { code: template.code, version: 1 } });
  if (!existing) await db.template.create({ data: { ...template, version: 1, definition: { layout: "A4", sourceStatus: "NEXZIBYTE_STANDARD" } } });

  const catalogue = [
    { sku: "HW-DELL-LAT-001", name: "Dell Latitude Business Laptop", description: "Dell business laptop, configurable memory and storage", packageSize: "Latitude", uom: "Unit", price: 68500 },
    { sku: "HW-DELL-KB-001", name: "Dell USB Keyboard", description: "Dell wired USB keyboard", packageSize: "USB", uom: "Unit", price: 950 },
    { sku: "HW-DELL-MOUSE-001", name: "Dell USB Optical Mouse", description: "Dell wired optical USB mouse", packageSize: "USB", uom: "Unit", price: 550 },
    { sku: "HW-DESKTOP-CPU-001", name: "Business Desktop CPU", description: "Business desktop tower, configurable processor and memory", packageSize: "Desktop", uom: "Unit", price: 42500 },
    { sku: "HW-DELL-MON-001", name: "Dell 24-inch Monitor", description: "Dell 24-inch business monitor", packageSize: "24 inch", uom: "Unit", price: 11200 },
    { sku: "HW-SSD-001", name: "1TB NVMe SSD", description: "1TB NVMe solid state drive", packageSize: "1TB", uom: "Unit", price: 6500 },
    { sku: "HW-RAM-001", name: "16GB DDR4 RAM", description: "16GB DDR4 memory module", packageSize: "16GB", uom: "Unit", price: 3200 },
    { sku: "HW-DOCK-001", name: "USB-C Laptop Dock", description: "USB-C docking station for compatible laptops", packageSize: "USB-C", uom: "Unit", price: 7800 },
    { sku: "HW-UPS-001", name: "650VA UPS", description: "650VA uninterruptible power supply", packageSize: "650VA", uom: "Unit", price: 3400 },
    { sku: "SW-OFFICE-001", name: "Office Productivity Software Licence", description: "Productivity software licence; final edition and term to be confirmed", packageSize: "Licence", uom: "Licence", price: 8500 },
    { sku: "SW-SECURITY-001", name: "Endpoint Security Software Licence", description: "Endpoint security software licence; term to be confirmed", packageSize: "Licence", uom: "Licence", price: 1800 },
    { sku: "SW-OS-001", name: "Desktop Operating System Licence", description: "Operating system licence; edition to be confirmed", packageSize: "Licence", uom: "Licence", price: 11500 },
  ];

  for (const item of catalogue) {
    await db.product.upsert({
      where: { sku: item.sku },
      update: { name: item.name, description: item.description, packageSize: item.packageSize, uom: item.uom, status: "ACTIVE" },
      create: {
        sku: item.sku, name: item.name, description: item.description, packageSize: item.packageSize,
        uom: item.uom, moq: 1, gstRate: 18, status: "ACTIVE",
        prices: { create: { listPrice: item.price, unitPrice: item.price, defaultDiscount: 0, effectiveFrom: new Date() } },
      },
    });
  }
  console.log("NexziByte quotation template and hardware/software product catalogue are ready.");
}

main().finally(() => db.$disconnect());
