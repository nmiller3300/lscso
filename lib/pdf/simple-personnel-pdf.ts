type PdfLine = { text: string; size?: number; bold?: boolean; indent?: number; spaceAfter?: number };
type PdfSection = { title: string; lines: PdfLine[] };
type Color = [number, number, number];

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
const BOTTOM = 50;
const CONTENT_W = PAGE_W - LEFT - RIGHT;

const INK: Color = [0.067, 0.067, 0.059];
const GOLD: Color = [0.733, 0.643, 0.373];
const GOLD_LIGHT: Color = [0.831, 0.745, 0.475];
const PAPER: Color = [0.953, 0.941, 0.91];
const MUTED: Color = [0.31, 0.298, 0.267];
const WHITE: Color = [0.988, 0.984, 0.973];
const LIGHT_TEXT: Color = [0.76, 0.75, 0.71];
const LINE: Color = [0.78, 0.75, 0.68];

function clean(value: string) {
  return value
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
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

function inferredDocumentLabel(input: PersonnelPdfInput) {
  if (input.documentLabel) return input.documentLabel;
  if (input.title.startsWith("Open Records Request Personnel File")) return "OPEN RECORDS RELEASE COPY";
  if (input.title.startsWith("Lateral Transfer Personnel File")) return "LATERAL TRANSFER PERSONNEL FILE";
  if (input.title.startsWith("Normal Personnel File") || input.title.startsWith("Internal Personnel File")) return "INTERNAL PERSONNEL FILE";
  return "OFFICIAL PERSONNEL RECORD";
}

function rgb(color: Color) {
  return color.map((value) => value.toFixed(3)).join(" ");
}

function normalizedDisplayText(value: string) {
  return value.replace(/^Normal Personnel File/, "Internal Personnel File");
}

function normalizedSections(input: PersonnelPdfInput, documentLabel: string): PdfSection[] {
  return input.sections.flatMap((section) => {
    if (section.title.toLowerCase() !== "legal framework") return [section];
    if (documentLabel !== "OPEN RECORDS RELEASE COPY") return [];

    const start = section.lines.findIndex((line) => line.text.includes("STATE OF SAN ANDREAS") || line.text.includes("OCSA §"));
    const sanAndreasLines = (start >= 0 ? section.lines.slice(start) : section.lines)
      .filter((line) => !/GEORGIA|O\.C\.G\.A\.|three business days|strong presumption/i.test(line.text))
      .map((line) => ({
        ...line,
        text: line.text
          .replace("STATE OF SAN ANDREAS / ROLEPLAY ANALOG", "STATE OF SAN ANDREAS")
          .replace("Quoted RP statutory language:", "Statutory language:"),
      }));

    return [{ title: "Open Records Authority", lines: sanAndreasLines }];
  });
}

export function buildPersonnelRecordPdf(input: PersonnelPdfInput) {
  const pages: string[][] = [];
  let ops: string[] = [];
  let y = 0;
  let pageNumber = 1;
  const documentLabel = inferredDocumentLabel(input);
  const displayTitle = normalizedDisplayText(input.title);
  const displayPurpose = normalizedDisplayText(input.purpose);
  const sections = normalizedSections(input, documentLabel);

  function text(value: string, x: number, atY: number, size: number, bold = false, color: Color = INK) {
    ops.push(`${rgb(color)} rg BT /${bold ? "F2" : "F1"} ${size.toFixed(1)} Tf ${x.toFixed(1)} ${atY.toFixed(1)} Td (${escapePdf(value)}) Tj ET`);
  }

  function line(x1: number, y1: number, x2: number, y2: number, width = 0.6, color: Color = LINE) {
    ops.push(`${rgb(color)} RG ${width.toFixed(1)} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
  }

  function rect(x: number, atY: number, width: number, height: number, color: Color) {
    ops.push(`${rgb(color)} rg ${x.toFixed(1)} ${atY.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)} re f`);
  }

  function pageHeader() {
    rect(0, PAGE_H - 92, PAGE_W, 92, INK);
    rect(0, PAGE_H - 96, PAGE_W, 4, GOLD);
    text("LSCSO", LEFT, PAGE_H - 41, 19, true, GOLD_LIGHT);
    text(input.departmentName, LEFT + 76, PAGE_H - 38, 10.2, true, WHITE);
    text("DRIVEN TO PROTECT. DEDICATED TO SERVE.", LEFT + 76, PAGE_H - 55, 6.8, false, LIGHT_TEXT);
    const labelWidth = Math.min(235, Math.max(120, documentLabel.length * 4.4));
    text(documentLabel, PAGE_W - RIGHT - labelWidth, PAGE_H - 77, 7.8, true, GOLD_LIGHT);
  }

  function pageFooter() {
    line(LEFT, 39, PAGE_W - RIGHT, 39, 0.7, GOLD);
    text("LOS SANTOS COUNTY SHERIFF'S OFFICE", LEFT, 22, 6.7, true, INK);
    const labelWidth = Math.min(205, Math.max(105, documentLabel.length * 3.7));
    text(documentLabel, (PAGE_W - labelWidth) / 2, 22, 6.4, true, GOLD);
    text(`Page ${pageNumber}`, PAGE_W - RIGHT - 34, 22, 6.7, true, MUTED);
  }

  function newPage() {
    if (ops.length) {
      pageFooter();
      pages.push(ops);
      pageNumber += 1;
    }
    ops = [];
    pageHeader();
    y = PAGE_H - 122;
  }

  function ensure(height: number) {
    if (y - height < BOTTOM) newPage();
  }

  function writeWrapped(value: string, size = 9, bold = false, indent = 0, gap = 3, color?: Color) {
    const rows = wrapText(value, size, indent);
    const leading = size + gap;
    ensure(rows.length * leading + 2);
    const resolvedColor = color ?? (bold ? INK : MUTED);
    for (const row of rows) {
      text(row, LEFT + indent, y, size, bold, resolvedColor);
      y -= leading;
    }
  }

  newPage();
  text("OFFICIAL PERSONNEL RECORD EXPORT", LEFT, y, 7.8, true, GOLD);
  y -= 21;
  writeWrapped(displayTitle, 20, true, 0, 4, INK);
  writeWrapped(input.subtitle, 9.5, false, 0, 3, MUTED);
  y -= 6;

  ensure(66);
  rect(LEFT, y - 53, CONTENT_W, 51, PAPER);
  rect(LEFT, y - 53, 4, 51, GOLD);
  text("RELEASE PURPOSE", LEFT + 14, y - 17, 6.8, true, GOLD);
  const purposeLines = wrapText(displayPurpose || "Authorized personnel record release", 8.5, 0).slice(0, 2);
  purposeLines.forEach((row, index) => text(row, LEFT + 14, y - 31 - (index * 11), 8.5, true, INK));
  text(`Prepared by ${input.generatedBy} · ${input.generatedAt}`, LEFT + 14, y - 47, 6.8, false, MUTED);
  y -= 70;

  for (const section of sections) {
    ensure(38);
    rect(LEFT, y - 4, 4, 15, GOLD);
    text(section.title.toUpperCase(), LEFT + 13, y, 10.2, true, INK);
    y -= 10;
    line(LEFT + 13, y, PAGE_W - RIGHT, y, 0.45, LINE);
    y -= 14;
    if (!section.lines.length) {
      writeWrapped("No records on file.", 8.5, false, 0, 2.5, MUTED);
    } else {
      for (const item of section.lines) {
        const size = item.size ?? 8.5;
        writeWrapped(item.text, size, item.bold ?? false, item.indent ?? 0, 2.5);
        y -= item.spaceAfter ?? 2;
      }
    }
    y -= 10;
  }

  pageFooter();
  pages.push(ops);

  const objects: string[] = [];
  const addObject = (body: string) => { objects.push(body); return objects.length; };
  const catalogRef = addObject("");
  const pagesRef = addObject("");
  const fontRegularRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBoldRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
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
