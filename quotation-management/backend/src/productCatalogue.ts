import path from "node:path";

/** Amazon/Flipkart-style product content: highlights plus a specification table. */
export type ProductDetails = { highlights: string[]; specs: Array<{ label: string; value: string }> };

export const IMAGE_KEYS = ["laptop","keyboard","mouse","desktop","monitor","ssd","ram","dock","ups","software-office","software-security","software-os","generic"] as const;

/** Picks the picture for a product: laptop -> laptop picture, monitor -> monitor picture, and so on. */
export function imageKeyFor(sku: string, name = ""): string {
  const s = `${sku} ${name}`.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/laptop|notebook|latitude/, "laptop"], [/keyboard|-kb-/, "keyboard"], [/mouse/, "mouse"],
    [/monitor|display|-mon-/, "monitor"], [/\bssd\b|nvme|solid state/, "ssd"], [/\bram\b|ddr\d|memory module/, "ram"],
    [/dock/, "dock"], [/\bups\b|uninterruptible/, "ups"], [/desktop|\bcpu\b|tower/, "desktop"],
    [/office|productivity/, "software-office"], [/security|antivirus|endpoint/, "software-security"], [/operating system|\bos\b|sw-os/, "software-os"]
  ];
  return rules.find(([re]) => re.test(s))?.[1] ?? "generic";
}
export const productImagePath = (key: string) => path.resolve("assets/products", `${(IMAGE_KEYS as readonly string[]).includes(key) ? key : "generic"}.png`);

export function parseDetails(value: unknown): ProductDetails | null {
  if (!value) return null;
  try {
    const raw = typeof value === "string" ? JSON.parse(value) : value as any;
    const highlights = Array.isArray(raw?.highlights) ? raw.highlights.map(String).filter(Boolean) : [];
    const specs = Array.isArray(raw?.specs) ? raw.specs.filter((x: any) => x?.label && x?.value).map((x: any) => ({ label: String(x.label), value: String(x.value) })) : [];
    return highlights.length || specs.length ? { highlights, specs } : null;
  } catch { return null; }
}

const s = (label: string, value: string) => ({ label, value });
/** Indicative starter content keyed by SKU. Administrators can edit every line in Products; verify against approved datasheets. */
export const CATALOGUE_DETAILS: Record<string, ProductDetails> = {
  "HW-DELL-LAT-001": { highlights: ["14-inch Full HD anti-glare display for all-day office use", "Latest-generation Intel Core processor with fast SSD storage", "Backlit keyboard, fingerprint reader and HD webcam", "Business-grade build with Wi-Fi 6 and Bluetooth connectivity"], specs: [s("Brand","Dell"),s("Series","Latitude business laptop"),s("Display","14-inch FHD (1920 x 1080), anti-glare"),s("Processor","Intel Core i5 (configurable)"),s("Memory","16 GB DDR4/DDR5 (configurable)"),s("Storage","512 GB NVMe SSD (configurable)"),s("Graphics","Integrated Intel Iris Xe"),s("Connectivity","Wi-Fi 6, Bluetooth 5.x, Gigabit LAN via adapter"),s("Ports","USB-C / Thunderbolt, USB-A, HDMI, audio combo"),s("Operating system","Licence quoted separately"),s("Warranty","As per manufacturer terms")] },
  "HW-DELL-KB-001": { highlights: ["Full-size wired keyboard with numeric keypad","Quiet, low-profile keys suited to long typing sessions","Plug-and-play USB connection, no driver needed","Spill-resistant design for office desks"], specs: [s("Brand","Dell"),s("Type","Wired USB keyboard"),s("Layout","Full size, 104-key with numeric pad"),s("Interface","USB-A, plug and play"),s("Cable length","Approx. 1.8 m"),s("Compatibility","Windows, Linux, ChromeOS"),s("Warranty","As per manufacturer terms")] },
  "HW-DELL-MOUSE-001": { highlights: ["Optical sensor for smooth, accurate tracking","Comfortable ambidextrous shape","Three-button design with scroll wheel","Plug-and-play USB connection"], specs: [s("Brand","Dell"),s("Type","Wired optical mouse"),s("Buttons","3 (left, right, scroll wheel)"),s("Resolution","1000 DPI (typical)"),s("Interface","USB-A"),s("Compatibility","Windows, Linux, macOS"),s("Warranty","As per manufacturer terms")] },
  "HW-DESKTOP-CPU-001": { highlights: ["Compact business desktop tower for everyday office workloads","Configurable processor, memory and storage","Quiet cooling with front-accessible USB ports","Ready for dual-monitor setups"], specs: [s("Form factor","Tower / small form factor"),s("Processor","Intel Core i5 / AMD Ryzen 5 class (configurable)"),s("Memory","8 GB - 32 GB DDR4 (configurable)"),s("Storage","256 GB - 1 TB SSD (configurable)"),s("Graphics","Integrated"),s("Ports","USB 3.x, USB-C, HDMI / DisplayPort, audio, LAN"),s("Connectivity","Gigabit Ethernet; Wi-Fi optional"),s("Operating system","Licence quoted separately"),s("Warranty","As per manufacturer terms")] },
  "HW-DELL-MON-001": { highlights: ["24-inch Full HD IPS panel with wide viewing angles","Thin bezels for tidy multi-monitor desks","Tilt-adjustable stand with HDMI and VGA/DisplayPort inputs","Flicker-free, low blue-light comfort features"], specs: [s("Brand","Dell"),s("Screen size","24 inch (61 cm)"),s("Resolution","1920 x 1080 Full HD"),s("Panel type","IPS, anti-glare"),s("Refresh rate","60 Hz (typical) / 75 Hz on select models"),s("Response time","5 ms (typical)"),s("Inputs","HDMI, DisplayPort / VGA"),s("Stand","Tilt adjustable, VESA mount compatible"),s("Warranty","As per manufacturer terms")] },
  "HW-SSD-001": { highlights: ["1 TB capacity for operating system, applications and data","NVMe PCIe M.2 for much faster boot and load times","Low power draw and silent, shock-resistant operation","Easy upgrade for compatible laptops and desktops"], specs: [s("Capacity","1 TB"),s("Form factor","M.2 2280"),s("Interface","NVMe PCIe Gen3 x4 / Gen4 x4"),s("Sequential read","Up to 3,000 MB/s (typical)"),s("Sequential write","Up to 2,000 MB/s (typical)"),s("Compatibility","M.2 NVMe slot required"),s("Warranty","As per manufacturer terms")] },
  "HW-RAM-001": { highlights: ["16 GB module for smoother multitasking","DDR4 3200 MHz for reliable everyday performance","Plug-and-play installation, no special setup","Tested for compatibility with business systems"], specs: [s("Capacity","16 GB (1 x 16 GB)"),s("Type","DDR4 SDRAM"),s("Speed","3200 MHz (PC4-25600)"),s("Form factor","DIMM (desktop) / SO-DIMM (laptop) - confirm before ordering"),s("Voltage","1.2 V"),s("Warranty","As per manufacturer terms")] },
  "HW-DOCK-001": { highlights: ["One USB-C cable for power, display, network and accessories","Dual-display output for a full desk setup","Gigabit Ethernet and multiple USB ports","Compact aluminium-style body for the desk"], specs: [s("Host connection","USB-C (DisplayPort Alt Mode)"),s("Video outputs","HDMI and DisplayPort"),s("USB ports","USB-A 3.x and USB-C"),s("Network","Gigabit Ethernet (RJ-45)"),s("Audio","3.5 mm combo jack"),s("Power delivery","Up to 65 W pass-through (model dependent)"),s("Compatibility","USB-C laptops with DisplayPort support"),s("Warranty","As per manufacturer terms")] },
  "HW-UPS-001": { highlights: ["650VA backup for desktops, monitors and network gear","Automatic voltage regulation protects against surges and sags","LED status indicators with audible alarm","Battery backup to save work during power cuts"], specs: [s("Capacity","650 VA"),s("Topology","Line interactive / offline (model dependent)"),s("Input voltage","220 - 240 V AC, 50 Hz"),s("Outlets","3 - 4 backed-up sockets"),s("Backup time","Approx. 5 - 10 minutes at typical PC load"),s("Indicators","LED status with audible alarm"),s("Battery","Sealed maintenance-free lead-acid"),s("Warranty","As per manufacturer terms")] },
  "SW-OFFICE-001": { highlights: ["Word processing, spreadsheets and presentations in one suite","Edition and subscription term to be confirmed at order","Compatible with common document formats","Per-user licence with vendor support"], specs: [s("Type","Productivity software licence"),s("Delivery","Digital licence key / account assignment"),s("Applications","Word processor, spreadsheet, presentation, email (edition dependent)"),s("Licence model","Per user / per device - to be confirmed"),s("Term","To be confirmed"),s("Support","Vendor support as per licence terms")] },
  "SW-SECURITY-001": { highlights: ["Real-time protection against malware, ransomware and phishing","Central console for policy and reporting (edition dependent)","Light on system resources for business PCs","Term and device count to be confirmed at order"], specs: [s("Type","Endpoint security licence"),s("Protection","Antivirus, anti-ransomware, web protection"),s("Management","Cloud or on-premise console (edition dependent)"),s("Platforms","Windows, macOS, Linux (edition dependent)"),s("Licence term","To be confirmed"),s("Support","Vendor support as per licence terms")] },
  "SW-OS-001": { highlights: ["Genuine operating system licence for business PCs","Edition to be confirmed at order","Regular security updates from the vendor","Supports domain join and device management (Pro editions)"], specs: [s("Type","Desktop operating system licence"),s("Edition","To be confirmed (Home / Pro)"),s("Architecture","64-bit"),s("Delivery","Digital licence key / pre-installed"),s("Support","Vendor support as per licence terms")] }
};
