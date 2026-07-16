/**
 * PDF Generator Module
 * Wraps html2pdf.js to convert the live HTML preview into a high-quality A4 PDF.
 */

const PDFGenerator = {
  /**
   * Triggers the download of the PDF based on the preview element.
   * @param {string} elementId - ID of the HTML element to render (e.g., 'pdf-to-print')
   * @param {Object} metadata - Metadata for the filename (examTitle, subject)
   * @returns {Promise<void>}
   */
  async download(elementId, metadata = {}) {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Không tìm thấy phần tử DOM #${elementId} để in.`);
    }

    // Clean up filename: replace special characters with underscores
    const examTitle = (metadata.examTitle || "").trim();
    const subject = (metadata.subject || "").trim();
    
    let baseTitle = "";
    if (examTitle && subject) {
      baseTitle = `${examTitle}_${subject}`;
    } else {
      baseTitle = examTitle || subject || "De_Thi";
    }

    const safeTitle = baseTitle
      .replace(/[^a-zA-Z0-9\sÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂĐÊÔƠƯưăâđêôơư]/g, "")
      .replace(/\s+/g, "_");
    
    const filename = `${safeTitle}.pdf`;

    // Configure html2pdf parameters for crisp A4 rendering
    const options = {
      margin: [15, 15, 15, 15], // Margin: Top, Left, Bottom, Right in mm (A4 standards)
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2, // Double resolution for ultra-sharp text and images
        useCORS: true, // Allow cross-origin images/fonts
        letterRendering: true, // Render letters individually for perfect typography spacing
        logging: false
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait"
      },
      // Ensure elements with 'page-break-inside: avoid' are not cut in half across pages
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: ".pdf-question-item, .pdf-header-wrapper, .pdf-student-details"
      }
    };

    // Temporarily add a class for printing layout optimizations
    element.classList.add("printing-pdf");

    // Hide CSS watermark during HTML-to-Canvas capture to print vector watermark instead (much sharper)
    const originalWatermark = element.getAttribute("data-watermark");
    element.setAttribute("data-watermark", "");

    let worker = html2pdf().set(options).from(element);

    // Apply watermark on PDF pages if enabled
    if (metadata.watermarkEnabled && metadata.watermarkText) {
      worker = worker.toPdf().get("pdf").then((pdf) => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          
          pdf.saveGraphicsState();
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(45);
          pdf.setTextColor(240, 240, 240); // Very light grey vector text
          
          // Center coordinate for A4 (210 x 297 mm)
          const centerX = 105;
          const centerY = 148.5;
          
          pdf.text(metadata.watermarkText, centerX, centerY, {
            align: "center",
            angle: 325 // rotate diagonally bottom-left to top-right
          });
          
          pdf.restoreGraphicsState();
        }
      });
    }

    try {
      await worker.save();
    } catch (error) {
      console.error("Lỗi khi xuất file PDF:", error);
      throw new Error(`Lỗi tạo file PDF: ${error.message}`);
    } finally {
      // Clean up printing class and restore live-preview watermark
      element.classList.remove("printing-pdf");
      element.setAttribute("data-watermark", originalWatermark);
    }
  }
};
