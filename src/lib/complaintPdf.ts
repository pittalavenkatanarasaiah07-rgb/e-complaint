import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

export interface ComplaintEvidence {
  name: string;
  kind: "image" | "video" | "audio" | "file";
  url: string;
  dataUrl?: string;
  width?: number;
  height?: number;
}

export interface ComplaintReportItem {
  id: string;
  complaint_type: string;
  description: string;
  location: string | null;
  status: string;
  created_at: string;
  evidence?: ComplaintEvidence[];
}

const NAVY: [number, number, number] = [23, 42, 84];
const GREY: [number, number, number] = [110, 118, 132];

const statusLabel = (status: string) =>
  ({ pending: "Pending", in_progress: "In Progress", resolved: "Resolved", withdrawn: "Withdrawn" } as Record<string, string>)[status] ||
  status;

const title = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

/** Stable 12-character reference ID derived from the complaint UUID. */
export const formatReferenceId = (id: string) =>
  id.replace(/-/g, "").slice(0, 12).toUpperCase();

const kindFor = (name: string): ComplaintEvidence["kind"] => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "avi", "mkv", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus"].includes(ext)) return "audio";
  return "file";
};

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

const imageSize = (dataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 4, height: 3 });
    img.src = dataUrl;
  });

/** Loads evidence files for a complaint: images inlined, media as playable signed links. */
export async function loadComplaintEvidence(userId: string, complaintId: string): Promise<ComplaintEvidence[]> {
  const folder = `${userId}/${complaintId}`;
  const { data: files, error } = await supabase.storage.from("complaint-evidence").list(folder);
  if (error || !files?.length) return [];
  const out: ComplaintEvidence[] = [];
  for (const f of files) {
    const path = `${folder}/${f.name}`;
    const { data: signed } = await supabase.storage.from("complaint-evidence").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (!signed?.signedUrl) continue;
    const kind = kindFor(f.name);
    const item: ComplaintEvidence = { name: f.name, kind, url: signed.signedUrl };
    if (kind === "image") {
      try {
        const blob = await (await fetch(signed.signedUrl)).blob();
        item.dataUrl = await toDataUrl(blob);
        const size = await imageSize(item.dataUrl);
        item.width = size.width;
        item.height = size.height;
      } catch {
        // keep it as a link if the image cannot be inlined
      }
    }
    out.push(item);
  }
  return out;
}

function buildComplaintPdf(
  complaints: ComplaintReportItem[],
  meta: { name?: string | null; email?: string | null },
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = 0;

  const header = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 72, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("E-COMPLAINT", margin, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Complaint Status Report", margin, 52);
    doc.setTextColor(0, 0, 0);
    y = 104;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 56) {
      doc.addPage();
      header();
    }
  };

  header();

  doc.setFontSize(10);
  doc.setTextColor(...GREY);
  const generated = new Date().toLocaleString();
  doc.text(`Generated: ${generated}`, margin, y);
  y += 14;
  if (meta.name) { doc.text(`Complainant: ${meta.name}`, margin, y); y += 14; }
  if (meta.email) { doc.text(`Email: ${meta.email}`, margin, y); y += 14; }
  doc.text(`Total complaints: ${complaints.length}`, margin, y);
  y += 22;
  doc.setDrawColor(220, 224, 230);
  doc.line(margin, y, pageW - margin, y);
  y += 24;

  complaints.forEach((c, i) => {
    const descLines = doc.splitTextToSize(c.description || "-", pageW - margin * 2 - 24);
    ensureSpace(96 + descLines.length * 13);

    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${i + 1}. ${title(c.complaint_type)}`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GREY);
    doc.text(statusLabel(c.status), pageW - margin, y, { align: "right" });
    y += 16;

    doc.setTextColor(60, 66, 78);
    doc.text(`Reference: ${formatReferenceId(c.id)}`, margin + 12, y); y += 13;
    doc.text(`Filed on: ${new Date(c.created_at).toLocaleString()}`, margin + 12, y); y += 13;
    doc.text(`Location: ${c.location || "Not provided"}`, margin + 12, y); y += 13;
    doc.text("Description:", margin + 12, y); y += 13;
    descLines.forEach((line: string) => {
      ensureSpace(20);
      doc.text(line, margin + 24, y);
      y += 13;
    });
    y += 10;

    const evidence = c.evidence || [];
    if (evidence.length) {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text(`Evidence (${evidence.length})`, margin + 12, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 66, 78);
      y += 16;

      evidence.forEach((e) => {
        if (e.kind === "image" && e.dataUrl) {
          const maxW = pageW - margin * 2 - 24;
          const ratio = e.height && e.width ? e.height / e.width : 0.75;
          const w = Math.min(maxW, 300);
          const h = Math.min(w * ratio, 260);
          ensureSpace(h + 26);
          doc.setTextColor(...GREY);
          doc.text(`Photo: ${e.name}`, margin + 24, y);
          y += 10;
          try {
            doc.addImage(e.dataUrl, margin + 24, y, w, h);
          } catch {
            doc.setTextColor(60, 66, 78);
            doc.textWithLink(`Open photo: ${e.name}`, margin + 24, y + 10, { url: e.url });
          }
          y += h + 14;
        } else {
          ensureSpace(20);
          const label =
            e.kind === "video" ? `Video: ${e.name} — tap to play`
            : e.kind === "audio" ? `Audio: ${e.name} — tap to play`
            : `File: ${e.name} — tap to open`;
          doc.setTextColor(23, 78, 166);
          doc.textWithLink(label, margin + 24, y, { url: e.url });
          y += 15;
        }
        doc.setTextColor(60, 66, 78);
      });
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      ensureSpace(16);
      doc.text("Media links open in your device player and stay valid for 7 days.", margin + 24, y);
      doc.setFontSize(10);
      y += 14;
    }
    doc.setDrawColor(235, 238, 242);
    doc.line(margin, y, pageW - margin, y);
    y += 20;
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text("This report is generated by the E-COMPLAINT app for the registered user.", margin, pageH - 28);
    doc.text(`Page ${p} of ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName =
    complaints.length === 1
      ? `complaint-${formatReferenceId(complaints[0].id)}-${stamp}.pdf`
      : `my-complaints-${stamp}.pdf`;
  return { doc, fileName };
}

export function generateComplaintPdf(
  complaints: ComplaintReportItem[],
  meta: { name?: string | null; email?: string | null },
) {
  const { doc, fileName } = buildComplaintPdf(complaints, meta);
  doc.save(fileName);
}

export async function shareComplaintPdfToWhatsApp(
  complaints: ComplaintReportItem[],
  meta: { name?: string | null; email?: string | null },
): Promise<"shared" | "downloaded"> {
  const { doc, fileName } = buildComplaintPdf(complaints, meta);
  const blob = doc.output("blob") as Blob;
  const file = new File([blob], fileName, { type: "application/pdf" });
  const line = (c: ComplaintReportItem) =>
    [
      `Ref: ${formatReferenceId(c.id)}`,
      `Type: ${title(c.complaint_type)}`,
      `Status: ${statusLabel(c.status)}`,
      `Location: ${c.location || "Not provided"}`,
    ].join("\n");
  const text =
    complaints.length === 1
      ? `E-COMPLAINT report\n${line(complaints[0])}`
      : `E-COMPLAINT report — ${complaints.length} complaints\n\n${complaints.map(line).join("\n\n")}`;

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "E-COMPLAINT report", text });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "shared";
    }
  }

  // Fallback: download the PDF and open WhatsApp with a prefilled message to attach it.
  doc.save(fileName);
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n(PDF report downloaded as ${fileName} — attach it here)`)}`, "_blank");
  return "downloaded";
}

export function complaintsToCsv(complaints: ComplaintReportItem[]) {
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Reference ID", "Complaint Type", "Status", "Filed On", "Location", "Description"],
    ...complaints.map((c) => [
      formatReferenceId(c.id),
      title(c.complaint_type),
      statusLabel(c.status),
      new Date(c.created_at).toLocaleString(),
      c.location || "",
      (c.description || "").replace(/\r?\n/g, " "),
    ]),
  ];
  const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-complaints-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
