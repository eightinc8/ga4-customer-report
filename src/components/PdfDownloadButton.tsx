"use client";

import { useState } from "react";

interface PdfDownloadButtonProps {
  companyName: string;
  weekStart: string;
  weekEnd: string;
}

export default function PdfDownloadButton({
  companyName,
  weekStart,
  weekEnd,
}: PdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const target = document.getElementById("report-content");
      if (!target) return;

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`GA4レポート_${companyName}_${weekStart}_${weekEnd}.pdf`);
    } catch (e) {
      console.error("PDF生成エラー:", e);
      alert("PDF生成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm transition-colors"
    >
      {loading ? "PDF生成中..." : "PDFダウンロード"}
    </button>
  );
}
