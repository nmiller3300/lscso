type PdfLine = { text: string; size?: number; bold?: boolean; indent?: number; spaceAfter?: number };
type PdfSection = { title: string; lines: PdfLine[] };

type PersonnelPdfInput = {
  departmentName: string;
  documentLabel?: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  generatedBy: string;
  purpose: string;
  sections: PdfSection[];
};

const PAGE_W = 612;
const PAGE_H = 792;
const LEFT = 50;
const RIGHT = 50;
const TOP = 54;
const BOTTOM = 48;
const CONTENT_W = PAGE_W - LEFT - RIGHT;

function clean(value: string) {
  return value
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7E\n]/g, "?");
}

function escapePdf(value: string) {
  return clean(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, fontSize = 9, indent = 0) {
  const normalized = clean(text).replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  const usable = CONTENT_W - indent;
  const approxCharWidth = fontSize * 0.49;
  const maxChars = Math.max(24, Math.floor(usable / approxCharWidth));
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function buildPersonnelRecordPdf(input: PersonnelPdfInput) {
  const pages: string[][] = [];
  let ops: string[] = [];
  let y = PAGE_H - TOP;
  let pageNumber = 1;

  function text(value: string, x: number, atY: number, size: number, bold = false) {
    ops.push(`BT /${bold ? "F2" : "F1"} ${size.toFixed(1)} Tf ${x.toFixed(1)} ${atY.toFixed(1)} Td (${escapePdf(value)}) Tj ET`);
  }

  function line(x1: number, y1: number, x2: number, y2: number, width = 0.6) {
    ops.push(`${width.toFixed(1)} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
  }

  function pageHeader() {
    text(input.departmentName, LEFT, PAGE_H - 34, 8.5, true);
    const label = input.documentLabel || "OFFICIAL PERSONNEL RECORD";
    const approximateWidth = Math.min(220, Math.max(110, label.length * 4.3));
    text(label, PAGE_W - RIGHT - approximateWidth, PAGE_H - 34, 8, true);
    line(LEFT, PAGE_H - 42, PAGE_W - RIGHT, PAGE_H - 42, 0.8);
  }

  function pageFooter() {
    line(LEFT, 35, PAGE_W - RIGHT, 35, 0.4);
    text(`Generated ${input.generatedAt}`, LEFT, 22, 7, false);
    text(`Page ${pageNumber}`, PAGE_W - RIGHT - 40, 22, 7, false);
  }

  function newPage() {
    if (ops.length) {
      pageFooter();
      pages.push(ops);
      pageNumber += 1;
    }
    ops = [];
    pageHeader();
    y = PAGE_H - 64;
  }

  function ensure(height: number) {
    if (y - height < BOTTOM) newPage();
  }

  function writeWrapped(value: string, size = 9, bold = false, indent = 0, gap = 3) {
    const lines = wrapText(value, size, indent);
    const leading = size + gap;
    ensure(lines.length * leading + 2);
    for (const row of lines) {
      text(row, LEFT + indent, y, size, bold);
      y -= leading;
    }
  }

  newPage();
  writeWrapped(input.title, 18, true, 0, 4);
  writeWrapped(input.subtitle, 10, false, 0, 3);
  y -= 3;
  line(LEFT, y, PAGE_W - RIGHT, y, 1);
  y -= 16;
  writeWrapped(`Release purpose: ${input.purpose || "Authorized personnel record release"}`, 9, true);
  writeWrapped(`Prepared by: ${input.generatedBy}`, 8.5);
  y -= 8;

  for (const section of input.sections) {
    ensure(34);
    text(section.title.toUpperCase(), LEFT, y, 10.5, true);
    y -= 7;
    line(LEFT, y, PAGE_W - RIGHT, y, 0.5);
    y -= 13;
    if (!section.lines.length) {
      writeWrapped("No records on file.", 8.5);
    } else {
      for (const item of section.lines) {
        const size = item.size ?? 8.5;
        writeWrapped(item.text, size, item.bold ?? false, item.indent ?? 0, 2.5);
        y -= item.spaceAfter ?? 2;
      }
    }
    y -= 8;
  }

  pageFooter();
  pages.push(ops);

  const objects: string[] = [];
  const addObject = (body: string) => { objects.push(body); return objects.length; };
  const catalogRef = addObject("");
  const pagesRef = addObject("");
  const fontRegularRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageRefs: number[] = [];

  for (const pageOps of pages) {
    const stream = pageOps.join("\n") + "\n";
    const contentRef = addObject(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`);
    const pageRef = addObject(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegularRef} 0 R /F2 ${fontBoldRef} 0 R >> >> /Contents ${contentRef} 0 R >>`);
    pageRefs.push(pageRef);
  }

  objects[catalogRef - 1] = `<< /Type /Catalog /Pages ${pagesRef} 0 R >>`;
  objects[pagesRef - 1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;

  let pdf = "%PDF-1.4\n%LSCSO\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
