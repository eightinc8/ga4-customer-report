"use client";

export default function PdfDownloadButton() {
  function handlePrint() {
    window.print();
  }

  return (
    <button
      onClick={handlePrint}
      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm transition-colors print:hidden"
    >
      PDF保存 / 印刷
    </button>
  );
}
