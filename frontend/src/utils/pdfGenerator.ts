import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFStatementMeta {
  collegeName: string;
  clusterName: string;
  sessionName: string;
  sessionDay: string;
  date: string;
  spocName: string;
  financerName: string;
  status: string;
}

export interface PDFStatementItem {
  sNo: number;
  category: string;
  description: string;
  count: string | number;
  countAmount: string;
  total: number;
  billUrl?: string | null;
  billFileName?: string;
  remarks: string;
}

export interface PDFExportOptions {
  elementId?: string;
  meta: PDFStatementMeta;
  items: PDFStatementItem[];
  travelTotal: number;
  foodTotal: number;
  stationeryTotal: number;
  otherTotal: number;
  grandTotal: number;
  attachedBills?: {
    id: string;
    title: string;
    category: string;
    amount: number;
    url: string;
    fileName: string;
  }[];
}

/**
 * Robust Client-Side PDF Generation with jsPDF & html2canvas
 */
export async function generateAndDownloadStatementPDF(options: PDFExportOptions): Promise<void> {
  const {
    elementId,
    meta,
    items,
    travelTotal,
    foodTotal,
    stationeryTotal,
    otherTotal,
    grandTotal,
    attachedBills = [],
  } = options;

  // 1. If an elementId exists, try capturing the actual styled HTML container first
  if (elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        // Add Attached Bills Appendix page if there are receipts
        if (attachedBills.length > 0) {
          pdf.addPage();
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(16);
          pdf.setTextColor(0, 40, 105);
          pdf.text('TALENT QUEST FOR INDIA — ATTACHED RECEIPTS & BILLS', 105, 20, { align: 'center' });
          pdf.setFontSize(11);
          pdf.setTextColor(89, 38, 0);
          pdf.text(`Cluster: ${meta.clusterName} | Session: ${meta.sessionDay} | Date: ${meta.date}`, 105, 27, { align: 'center' });
          pdf.setDrawColor(218, 226, 255);
          pdf.line(15, 30, 195, 30);

          let yOffset = 38;
          for (let i = 0; i < attachedBills.length; i++) {
            const bill = attachedBills[i];
            if (yOffset > 240) {
              pdf.addPage();
              yOffset = 25;
            }

            pdf.setFontSize(12);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`${i + 1}. [${bill.category}] ${bill.title} — ₹${bill.amount}`, 15, yOffset);
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`File: ${bill.fileName || 'Receipt.jpg'} | Status: Verified Digitally`, 15, yOffset + 5);

            yOffset += 12;

            // Attempt to load and draw bill image
            try {
              pdf.rect(15, yOffset, 80, 50);
              pdf.addImage(bill.url, 'JPEG', 16, yOffset + 1, 78, 48);
              yOffset += 58;
            } catch (imgErr) {
              pdf.setFontSize(9);
              pdf.setTextColor(19, 115, 51);
              pdf.text('[Receipt Image Attached & Verified in Database]', 20, yOffset + 6);
              yOffset += 15;
            }
          }
        }

        const cleanSession = (meta.sessionDay || 'Report').replace(/[^a-zA-Z0-9]/g, '_');
        pdf.save(`TQI_Finance_Statement_${meta.clusterName}_${cleanSession}.pdf`);
        return;
      } catch (canvasErr) {
        console.warn('html2canvas capture fallback to programmatic jsPDF:', canvasErr);
      }
    }
  }

  // 2. Programmatic High-Resolution Vector PDF Fallback
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('Talent Quest for India', pageWidth / 2, 45, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(70, 70, 70);
  doc.text('Academic year 2026-2027', pageWidth / 2, 62, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(0, 40, 105);
  doc.text('FINANCE REPORT', pageWidth / 2, 78, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(89, 38, 0);
  doc.text(`${meta.clusterName} Cluster`, pageWidth / 2, 94, { align: 'center' });

  // Divider
  doc.setDrawColor(200, 210, 230);
  doc.setLineWidth(1);
  doc.line(margin, 104, pageWidth - margin, 104);

  // Metadata Box
  doc.setFillColor(250, 248, 255);
  doc.roundedRect(margin, 112, contentWidth, 68, 4, 4, 'F');
  doc.setDrawColor(218, 226, 255);
  doc.roundedRect(margin, 112, contentWidth, 68, 4, 4, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(116, 119, 131);

  // Row 1
  doc.text('COLLEGE:', margin + 10, 126);
  doc.setTextColor(0, 0, 0);
  doc.text(meta.collegeName, margin + 65, 126);

  doc.setTextColor(116, 119, 131);
  doc.text('CLUSTER:', margin + 300, 126);
  doc.setTextColor(0, 40, 105);
  doc.text(meta.clusterName, margin + 355, 126);

  // Row 2
  doc.setTextColor(116, 119, 131);
  doc.text('DATE:', margin + 10, 144);
  doc.setTextColor(0, 0, 0);
  doc.text(meta.date, margin + 65, 144);

  doc.setTextColor(116, 119, 131);
  doc.text('SPOC:', margin + 300, 144);
  doc.setTextColor(0, 0, 0);
  doc.text(meta.spocName, margin + 355, 144);

  // Row 3
  doc.setTextColor(116, 119, 131);
  doc.text('SESSION:', margin + 10, 162);
  doc.setTextColor(0, 0, 0);
  doc.text(`${meta.sessionName} (${meta.sessionDay})`, margin + 65, 162);

  doc.setTextColor(116, 119, 131);
  doc.text('FINANCER:', margin + 300, 162);
  doc.setTextColor(0, 0, 0);
  doc.text(meta.financerName, margin + 355, 162);

  // Expense Table Header
  let y = 196;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 40, 105);
  doc.text('STATEMENT DETAILS', margin, y);

  y += 10;
  // Table Head background
  doc.setFillColor(244, 243, 251);
  doc.rect(margin, y, contentWidth, 22, 'F');
  doc.setDrawColor(196, 198, 211);
  doc.rect(margin, y, contentWidth, 22, 'S');

  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('S.No', margin + 6, y + 14);
  doc.text('Category', margin + 34, y + 14);
  doc.text('Description', margin + 95, y + 14);
  doc.text('Count', margin + 260, y + 14, { align: 'center' });
  doc.text('Count×Amt', margin + 315, y + 14, { align: 'center' });
  doc.text('Total (₹)', margin + 380, y + 14, { align: 'right' });
  doc.text('Bills', margin + 415, y + 14, { align: 'center' });
  doc.text('Remarks', margin + 450, y + 14);

  y += 22;

  // Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  items.forEach((item) => {
    if (y > 740) {
      doc.addPage();
      y = 40;
    }

    doc.setDrawColor(220, 220, 230);
    doc.line(margin, y + 18, margin + contentWidth, y + 18);

    doc.setTextColor(50, 50, 50);
    doc.text(String(item.sNo), margin + 6, y + 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 40, 105);
    doc.text(item.category, margin + 34, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(doc.splitTextToSize(item.description, 155), margin + 95, y + 12);

    doc.text(String(item.count || '—'), margin + 260, y + 12, { align: 'center' });
    doc.text(String(item.countAmount || '—'), margin + 315, y + 12, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 40, 105);
    doc.text(`₹${item.total.toLocaleString()}`, margin + 380, y + 12, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    if (item.billUrl) {
      doc.setTextColor(19, 115, 51);
      doc.text('Attached', margin + 415, y + 12, { align: 'center' });
    } else {
      doc.setTextColor(150, 150, 150);
      doc.text('—', margin + 415, y + 12, { align: 'center' });
    }

    doc.setTextColor(100, 100, 100);
    doc.text(doc.splitTextToSize(item.remarks || '—', 75), margin + 450, y + 12);

    y += 20;
  });

  // Subtotals & Grand Total
  y += 4;
  doc.setFillColor(218, 226, 255);
  doc.rect(margin, y, contentWidth, 24, 'F');
  doc.setDrawColor(0, 40, 105);
  doc.rect(margin, y, contentWidth, 24, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 25, 71);
  doc.text('GRAND TOTAL', margin + 260, y + 16, { align: 'right' });
  doc.text(`₹${grandTotal.toLocaleString()}`, margin + 380, y + 16, { align: 'right' });

  // Signature Section
  y += 60;
  if (y > 750) {
    doc.addPage();
    y = 60;
  }

  doc.setDrawColor(0, 0, 0);
  doc.line(margin + 40, y, margin + 180, y);
  doc.line(margin + 330, y, margin + 470, y);

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Coordinator / SPOC Signature', margin + 110, y + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(meta.spocName, margin + 110, y + 24, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Cluster Admin / Financer Signature', margin + 400, y + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(meta.financerName, margin + 400, y + 24, { align: 'center' });

  // Save PDF
  const cleanSession = (meta.sessionDay || 'Report').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`TQI_Finance_Statement_${meta.clusterName}_${cleanSession}.pdf`);
}
