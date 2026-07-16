/**
 * Main Application Controller (app.js)
 * Manages the state, drag-and-drop uploading, queue list, question editor,
 * HTML canvas cropper integration, live PDF preview, and A4 drag-and-drop sorting.
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- App State ---
  let state = {
    apiKey: localStorage.getItem("gemini_api_key") || "",
    questions: [],
    editingQuestionId: null,
    processingQueue: [], // Files currently in queue
    isProcessing: false // Flag to prevent parallel extraction loops
  };

  // --- DOM Elements ---
  const btnApiStatus = document.getElementById("btn-api-status");
  const btnThemeToggle = document.getElementById("btn-theme-toggle");
  const iconTheme = document.getElementById("icon-theme");
  const btnOpenSettings = document.getElementById("btn-open-settings");
  const modalSettings = document.getElementById("modal-settings");
  const btnCloseSettings = document.getElementById("btn-close-settings");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const btnClearSettings = document.getElementById("btn-clear-settings");
  const inputApiKey = document.getElementById("settings-api-key");
  const btnToggleKeyVisibility = document.getElementById("btn-toggle-key-visibility");
  const iconEyeKey = document.getElementById("icon-eye-key");

  const uploadZone = document.getElementById("upload-zone");
  const fileInput = document.getElementById("file-input");
  const queueCount = document.getElementById("queue-count");
  const queueList = document.getElementById("queue-list");
  const queueEmpty = document.getElementById("queue-empty");
  const btnClearQueue = document.getElementById("btn-clear-queue");

  const editorSection = document.getElementById("editor-section");
  const btnCloseEditor = document.getElementById("btn-close-editor");
  const editingIndexLabel = document.getElementById("editing-index-label");
  const editorOriginalImg = document.getElementById("editor-original-img");
  const btnCropIllustration = document.getElementById("btn-crop-illustration");
  const croppedPreviewContainer = document.getElementById("cropped-preview-container");
  const editorCroppedImg = document.getElementById("editor-cropped-img");
  const btnRemoveCropped = document.getElementById("btn-remove-cropped");
  const btnUploadEditorImg = document.getElementById("btn-upload-editor-img");
  const editorImageUpload = document.getElementById("editor-image-upload");
  const editQuestionText = document.getElementById("edit-question-text");
  const btnAddOption = document.getElementById("btn-add-option");
  const editorOptionsContainer = document.getElementById("editor-options-container");
  const btnCancelEdit = document.getElementById("btn-cancel-edit");
  const btnSaveEdit = document.getElementById("btn-save-edit");
  const btnAutoSplit = document.getElementById("btn-auto-split");

  const btnAddCustomQuestion = document.getElementById("btn-add-custom-question");
  const btnDownloadPdf = document.getElementById("btn-download-pdf");
  
  // Config inputs
  const cfgSubjectCode = document.getElementById("cfg-subject-code");
  const cfgChoicesLayout = document.getElementById("cfg-choices-layout");
  const cfgWatermarkEnable = document.getElementById("cfg-watermark-enable");
  const cfgWatermarkText = document.getElementById("cfg-watermark-text");

  // Preview elements
  const pdfToPrint = document.getElementById("pdf-to-print");
  const pdfViewSubjectCode = document.getElementById("pdf-view-subject-code");
  const pdfQuestionsList = document.getElementById("pdf-questions-list");
  const pdfEmptyState = document.getElementById("pdf-empty-state");

  // Initialize Canvas Cropper
  ImageCropper.init();

  // --- 1. Theme Configuration & API Key Initialization ---
  updateApiStatusUI();

  // Theme Toggle
  btnThemeToggle.addEventListener("click", () => {
    const isLight = document.body.classList.contains("light-mode");
    if (isLight) {
      document.body.classList.replace("light-mode", "dark-mode");
      iconTheme.setAttribute("data-lucide", "sun");
    } else {
      document.body.classList.replace("dark-mode", "light-mode");
      iconTheme.setAttribute("data-lucide", "moon");
    }
    lucide.createIcons();
  });

  // Open Settings
  btnOpenSettings.addEventListener("click", () => {
    inputApiKey.value = state.apiKey;
    modalSettings.classList.remove("hidden");
  });

  btnApiStatus.addEventListener("click", () => {
    inputApiKey.value = state.apiKey;
    modalSettings.classList.remove("hidden");
  });

  // Close Settings
  btnCloseSettings.addEventListener("click", () => {
    modalSettings.classList.add("hidden");
  });

  // Toggle API Key visibility
  btnToggleKeyVisibility.addEventListener("click", () => {
    const isPassword = inputApiKey.type === "password";
    inputApiKey.type = isPassword ? "text" : "password";
    iconEyeKey.setAttribute("data-lucide", isPassword ? "eye-off" : "eye");
    lucide.createIcons();
  });

  // Save Settings
  btnSaveSettings.addEventListener("click", () => {
    state.apiKey = inputApiKey.value.trim();
    localStorage.setItem("gemini_api_key", state.apiKey);
    updateApiStatusUI();
    modalSettings.classList.add("hidden");
  });

  // Clear Settings
  btnClearSettings.addEventListener("click", () => {
    state.apiKey = "";
    localStorage.removeItem("gemini_api_key");
    inputApiKey.value = "";
    updateApiStatusUI();
    modalSettings.classList.add("hidden");
  });

  function updateApiStatusUI() {
    if (state.apiKey) {
      btnApiStatus.className = "api-status-btn success";
      btnApiStatus.innerHTML = `
        <span class="status-dot"></span>
        <span class="status-label">API Key: Hoạt động</span>
      `;
    } else {
      btnApiStatus.className = "api-status-btn warning";
      btnApiStatus.innerHTML = `
        <span class="status-dot"></span>
        <span class="status-label">Chưa cấu hình API Key</span>
      `;
    }
  }

  // --- 2. Live Configuration Updates (A4 Preview Linkage) ---
  cfgSubjectCode.addEventListener("input", (e) => {
    pdfViewSubjectCode.textContent = e.target.value.toUpperCase();
  });
  cfgChoicesLayout.addEventListener("change", () => {
    renderQuestionsList();
  });

  // Bidirectional contenteditable syncing back to inputs
  pdfViewSubjectCode.addEventListener("blur", (e) => {
    cfgSubjectCode.value = e.target.textContent;
  });

  // Watermark interactive controls
  cfgWatermarkEnable.addEventListener("change", (e) => {
    if (e.target.checked) {
      pdfToPrint.classList.remove("no-watermark");
      pdfToPrint.setAttribute("data-watermark", cfgWatermarkText.value);
    } else {
      pdfToPrint.classList.add("no-watermark");
      pdfToPrint.setAttribute("data-watermark", "");
    }
  });

  cfgWatermarkText.addEventListener("input", (e) => {
    if (cfgWatermarkEnable.checked) {
      pdfToPrint.setAttribute("data-watermark", e.target.value);
    }
  });

  // --- 3. File Upload & Queue Processing ---
  
  // Drag over upload zone
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("dragover");
  });

  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("dragover");
  });

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // Input file change
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  });

  // Click on upload zone triggers file input
  uploadZone.addEventListener("click", (e) => {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "SPAN") {
      fileInput.click();
    }
  });

  /**
   * Handle the uploaded files, add them to the state queue
   */
  function handleFiles(files) {
    if (!state.apiKey) {
      alert("Vui lòng nhập Google Gemini API Key trong phần cài đặt trước khi tải ảnh!");
      btnOpenSettings.click();
      return;
    }

    Array.from(files).forEach(file => {
      if (!file.type.startsWith("image/")) {
        alert(`File "${file.name}" không phải là định dạng hình ảnh hợp lệ!`);
        return;
      }

      const queueItem = {
        id: "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        file: file,
        name: file.name,
        status: "pending", // pending, extracting, done, error
        error: "",
        base64: "",
        mimeType: file.type
      };

      state.processingQueue.push(queueItem);
      renderQueueUI();

      // Read file to Base64
      const reader = new FileReader();
      reader.onload = (e) => {
        queueItem.base64 = e.target.result.split(",")[1];
        processNextInQueue();
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Sequentially process images in queue to prevent rate limit spikes
   */
  async function processNextInQueue() {
    if (state.isProcessing) return;

    const nextItem = state.processingQueue.find(item => item.status === "pending");
    if (!nextItem) {
      state.isProcessing = false;
      return;
    }

    state.isProcessing = true;
    nextItem.status = "extracting";
    nextItem.error = "";
    renderQueueUI();

    let extractedData = null;
    let attempts = 0;
    const maxAttempts = 4;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        if (attempts > 1) {
          const waitSec = attempts === 2 ? 20 : 40;
          nextItem.error = `Bị giới hạn tốc độ (Rate Limit). Đang chờ ${waitSec}s rồi thử lại (Lần ${attempts - 1}/${maxAttempts - 1})...`;
          nextItem.status = "extracting";
          renderQueueUI();
          await new Promise(r => setTimeout(r, waitSec * 1000));
        }

        nextItem.status = "extracting";
        nextItem.error = "";
        renderQueueUI();

        extractedData = await GeminiService.extractQuestion(
          nextItem.base64,
          nextItem.mimeType,
          state.apiKey
        );
        break; // Succeeded!
      } catch (err) {
        const errMsg = err.message || "";
        const isRateLimit = errMsg.includes("429") || 
                            errMsg.includes("RESOURCE_EXHAUSTED") || 
                            errMsg.includes("quota") || 
                            errMsg.includes("Too Many Requests");

        if (!isRateLimit || attempts >= maxAttempts) {
          nextItem.status = "error";
          nextItem.error = errMsg;
          renderQueueUI();
          state.isProcessing = false;
          setTimeout(processNextInQueue, 3000);
          return;
        }
      }
    }

    // Build the question object from extracted data
    const newQuestion = {
      id: "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      questionNumber: extractedData.question_number || (state.questions.length + 1).toString(),
      questionText: extractedData.question_text || "",
      originalImage: `data:${nextItem.mimeType};base64,${nextItem.base64}`,
      croppedImage: null,
      options: extractedData.options || []
    };

    // Auto crop illustration if Gemini provided bounding box
    if (extractedData.has_illustration && 
        extractedData.illustration_box && 
        extractedData.illustration_box.length === 4) {
      try {
        const croppedDataURL = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let [ymin, xmin, ymax, xmax] = extractedData.illustration_box;
            
            let divisor = 1;
            const maxVal = Math.max(ymin, xmin, ymax, xmax);
            if (maxVal > 100) {
              divisor = 1000;
            } else if (maxVal > 1) {
              divisor = 100;
            }
            
            const x = Math.max(0, (xmin / divisor) * img.naturalWidth);
            const y = Math.max(0, (ymin / divisor) * img.naturalHeight);
            const w = Math.min(img.naturalWidth - x, ((xmax - xmin) / divisor) * img.naturalWidth);
            const h = Math.min(img.naturalHeight - y, ((ymax - ymin) / divisor) * img.naturalHeight);
            
            if (w > 10 && h > 10) {
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
              resolve(canvas.toDataURL("image/png"));
            } else {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = newQuestion.originalImage;
        });
        
        if (croppedDataURL) {
          newQuestion.croppedImage = croppedDataURL;
        }
      } catch (cropErr) {
        console.error("Lỗi tự động cắt hình:", cropErr);
      }
    }

    // Add to main list and update UI
    state.questions.push(newQuestion);
    nextItem.status = "done";
    renderQuestionsList();

    // Auto open editor if illustration found
    if (extractedData.has_illustration) {
      openEditor(newQuestion.id);
    }

    state.isProcessing = false;
    renderQueueUI();
    
    // Delay 4 seconds between each image to stay well within 15 RPM free tier limit
    setTimeout(processNextInQueue, 4000);
  }

  /**
   * Render the sidebar queue UI list
   */
  function renderQueueUI() {
    queueCount.textContent = state.processingQueue.length;
    
    if (state.processingQueue.length === 0) {
      queueEmpty.classList.remove("hidden");
      return;
    } else {
      queueEmpty.classList.add("hidden");
    }

    // Keep existing items, update their status to minimize layout churn
    const currentHtml = state.processingQueue.map((item, index) => {
      let statusIcon = "";
      let statusText = "";
      
      if (item.status === "pending") {
        statusIcon = `<i data-lucide="clock" class="status-pending"></i>`;
        statusText = `<span class="status-pending">Đang chờ xử lý...</span>`;
      } else if (item.status === "extracting") {
        statusIcon = `<span class="spinner"></span>`;
        statusText = `<span class="status-extracting">Đang trích xuất AI...</span>`;
      } else if (item.status === "done") {
        statusIcon = `<i data-lucide="check-circle" class="status-done"></i>`;
        statusText = `<span class="status-done">Hoàn thành</span>`;
      } else {
        statusIcon = `<i data-lucide="alert-triangle" class="status-error" title="${escapeHtml(item.error || "")}"></i>`;
        statusText = `
          <span class="status-error">Lỗi trích xuất</span>
          <div style="font-size: 11px; color: var(--destructive); word-break: break-word; margin-top: 2px; line-height: 1.3;">
            ${escapeHtml(item.error || "")}
          </div>
        `;
      }

      // Convert thumbnail
      const thumbnailSrc = item.base64 ? `data:${item.mimeType};base64,${item.base64}` : "";

      return `
        <div class="queue-card" data-id="${item.id}">
          <div class="queue-card-thumb">
            ${thumbnailSrc ? `<img src="${thumbnailSrc}" alt="thumb">` : `<i data-lucide="file-image"></i>`}
          </div>
          <div class="queue-card-info">
            <div class="queue-card-name" title="${item.name}">${item.name}</div>
            <div class="queue-card-status">${statusIcon} ${statusText}</div>
          </div>
          <div class="queue-card-actions">
            ${item.status === "error" ? `
              <button class="icon-btn-sm btn-retry-extract" data-index="${index}" title="Thử lại">
                <i data-lucide="refresh-cw"></i>
              </button>
            ` : ""}
            <button class="icon-btn-sm btn-delete-queue text-danger" data-index="${index}" title="Xóa">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");

    queueList.innerHTML = currentHtml;
    lucide.createIcons();

    // Attach Event Listeners to Queue buttons
    document.querySelectorAll(".btn-delete-queue").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute("data-index"));
        state.processingQueue.splice(index, 1);
        renderQueueUI();
      });
    });

    document.querySelectorAll(".btn-retry-extract").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute("data-index"));
        state.processingQueue[index].status = "pending";
        renderQueueUI();
        processNextInQueue();
      });
    });
  }

  // Clear entire queue
  btnClearQueue.addEventListener("click", () => {
    if (state.processingQueue.length > 0 && confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách hàng đợi không?")) {
      state.processingQueue = [];
      renderQueueUI();
    }
  });

  // --- 4. Question Editing Interface ---
  
  /**
   * Opens the Editor Section on the left for a specific question
   * @param {string} qId - Question ID
   */
  function openEditor(qId) {
    const qIndex = state.questions.findIndex(q => q.id === qId);
    if (qIndex === -1) return;

    const question = state.questions[qIndex];
    state.editingQuestionId = qId;

    editingIndexLabel.textContent = `#${qIndex + 1}`;
    editQuestionText.value = question.questionText;
    
    // Manage Original Image Display
    if (question.originalImage) {
      editorOriginalImg.src = question.originalImage;
      btnCropIllustration.style.display = "inline-flex";
    } else {
      editorOriginalImg.src = "";
      btnCropIllustration.style.display = "none";
    }

    // Manage Cropped Image Display
    if (question.croppedImage) {
      editorCroppedImg.src = question.croppedImage;
      croppedPreviewContainer.classList.remove("hidden");
    } else {
      editorCroppedImg.src = "";
      croppedPreviewContainer.classList.add("hidden");
    }

    // Render Option Inputs
    renderEditorOptions(question.options);

    // Show Editor Panel & scroll to view
    editorSection.classList.remove("hidden");
    editorSection.scrollIntoView({ behavior: "smooth" });
  }

  /**
   * Render option input boxes dynamically inside the editing panel
   */
  function renderEditorOptions(options) {
    editorOptionsContainer.innerHTML = "";
    
    options.forEach((opt, idx) => {
      const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D...
      const div = document.createElement("div");
      div.className = "option-row-item";
      div.innerHTML = `
        <span class="option-badge">${optionLetter}</span>
        <input type="text" class="edit-option-input" data-index="${idx}" value="${escapeHtml(opt)}">
        <button class="icon-btn-sm text-danger btn-delete-option" data-index="${idx}" title="Xóa lựa chọn">
          <i data-lucide="trash-2"></i>
        </button>
      `;
      editorOptionsContainer.appendChild(div);
    });
    
    lucide.createIcons();

    // Attach deletion handlers
    divAttachDeleteOptionHandlers();
  }

  function divAttachDeleteOptionHandlers() {
    document.querySelectorAll(".btn-delete-option").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-index"));
        const qIndex = state.questions.findIndex(q => q.id === state.editingQuestionId);
        if (qIndex === -1) return;
        
        // Grab current form options inputs to preserve current text edits before deletion
        const currentInputs = Array.from(document.querySelectorAll(".edit-option-input"));
        const currentOptions = currentInputs.map(input => input.value);
        currentOptions.splice(idx, 1);
        
        renderEditorOptions(currentOptions);
      });
    });
  }

  // Add Option Button click
  btnAddOption.addEventListener("click", () => {
    const currentInputs = Array.from(document.querySelectorAll(".edit-option-input"));
    const currentOptions = currentInputs.map(input => input.value);
    currentOptions.push(""); // Add empty option
    renderEditorOptions(currentOptions);
  });

  // Cancel edit
  btnCancelEdit.addEventListener("click", () => {
    closeEditor();
  });
  
  btnCloseEditor.addEventListener("click", () => {
    closeEditor();
  });

  function closeEditor() {
    editorSection.classList.add("hidden");
    state.editingQuestionId = null;
  }

  // Update/Save Question details
  btnSaveEdit.addEventListener("click", () => {
    const qIndex = state.questions.findIndex(q => q.id === state.editingQuestionId);
    if (qIndex === -1) return;

    const question = state.questions[qIndex];
    question.questionText = editQuestionText.value;
    
    // Extract current option input values
    const currentInputs = Array.from(document.querySelectorAll(".edit-option-input"));
    question.options = currentInputs.map(input => input.value.trim()).filter(val => val !== "");

    // Save and re-render
    renderQuestionsList();
    closeEditor();
  });

  // Crop illustration button
  btnCropIllustration.addEventListener("click", () => {
    const qIndex = state.questions.findIndex(q => q.id === state.editingQuestionId);
    if (qIndex === -1) return;

    const question = state.questions[qIndex];
    if (!question.originalImage) return;

    // Open image cropper canvas modal
    ImageCropper.open(question.originalImage, (croppedBase64) => {
      question.croppedImage = croppedBase64;
      editorCroppedImg.src = croppedBase64;
      croppedPreviewContainer.classList.remove("hidden");
      renderQuestionsList(); // update preview instantly
    });
  });

  // Remove cropped image button
  btnRemoveCropped.addEventListener("click", () => {
    const qIndex = state.questions.findIndex(q => q.id === state.editingQuestionId);
    if (qIndex === -1) return;

    state.questions[qIndex].croppedImage = null;
    editorCroppedImg.src = "";
    croppedPreviewContainer.classList.add("hidden");
    renderQuestionsList();
  });

  // --- 5. Custom Manual Question Creation ---
  btnAddCustomQuestion.addEventListener("click", () => {
    const newQuestion = {
      id: "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      questionNumber: (state.questions.length + 1).toString(),
      questionText: "Nhấp để nhập nội dung câu hỏi mới...",
      originalImage: null,
      croppedImage: null,
      options: ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"]
    };

    state.questions.push(newQuestion);
    renderQuestionsList();
    openEditor(newQuestion.id);
  });

  // --- 6. Live PDF Preview Generator & A4 Renderer ---

  /**
   * Helper utility to calculate the auto layout class for choices
   * If any option has long characters, stack them vertically (1 column)
   * If short, group in 2 columns or 4 columns
   */
  function determineChoicesLayoutClass(options) {
    const manualLayout = cfgChoicesLayout.value;
    if (manualLayout !== "auto") {
      return `layout-${manualLayout}`;
    }

    if (!options || options.length === 0) return "layout-1col";

    // Auto layout calculation
    const maxLength = Math.max(...options.map(opt => opt.length));
    
    if (maxLength <= 8) {
      return "layout-4col"; // Fit all on one line
    } else if (maxLength <= 20) {
      return "layout-2col"; // Two columns
    } else {
      return "layout-1col"; // Single column vertical
    }
  }

  /**
   * Render the main visual preview of questions on the A4 sheet page
   */
  function renderQuestionsList() {
    if (state.questions.length === 0) {
      pdfEmptyState.classList.remove("hidden");
      pdfQuestionsList.innerHTML = "";
      return;
    } else {
      pdfEmptyState.classList.add("hidden");
    }

    let listHtml = "";

    state.questions.forEach((q, index) => {
      // Re-index question titles for print
      const indexDisplay = index + 1;
      // Render options or essay lines
      let choicesHtml = "";
      if (q.options && q.options.length > 0) {
        const choicesClass = determineChoicesLayoutClass(q.options);
        const optionsHtml = q.options.map((opt, optIdx) => {
          const optionLetter = String.fromCharCode(65 + optIdx); // A, B, C, D
          return `
            <div class="pdf-choice-item">
              <span class="choice-prefix">${optionLetter}.</span>
              <span class="choice-text">${escapeHtml(opt)}</span>
            </div>
          `;
        }).join("");
        choicesHtml = `<div class="pdf-choices-list ${choicesClass}">${optionsHtml}</div>`;
      } else {
        // Essay question - render dotted lines for answer writing
        choicesHtml = `
          <div class="pdf-essay-lines">
            <div class="essay-line">....................................................................................................................................................</div>
            <div class="essay-line">....................................................................................................................................................</div>
          </div>
        `;
      }

      // Image attachment markup
      const imgMarkup = q.croppedImage ? `
        <div class="pdf-question-image-box">
          <img src="${q.croppedImage}" alt="Ảnh câu ${indexDisplay}">
        </div>
      ` : "";

      listHtml += `
        <div class="pdf-question-item" data-id="${q.id}" draggable="true">
          <!-- Web-only manipulation handles -->
          <div class="question-controls">
            <button class="ctrl-btn drag-handle" title="Kéo thả sắp xếp thứ tự">
              <i data-lucide="grip-vertical"></i>
            </button>
            <button class="ctrl-btn btn-preview-edit" data-id="${q.id}" title="Sửa câu hỏi">
              <i data-lucide="edit"></i>
            </button>
            <button class="ctrl-btn danger btn-preview-delete" data-id="${q.id}" title="Xóa câu hỏi">
              <i data-lucide="trash-2"></i>
            </button>
          </div>

          <div class="pdf-question-body">
            <div class="pdf-question-title">Câu ${indexDisplay}:</div>
            <div class="pdf-question-text">${escapeHtml(q.questionText || "").replace(/\n/g, "<br>")}</div>
            ${imgMarkup}
            ${choicesHtml}
          </div>
        </div>
      `;
    });

    pdfQuestionsList.innerHTML = listHtml;
    lucide.createIcons();

    // Attach UI controls handlers
    attachPreviewControlsHandlers();
    
    // Attach Drag and Drop reordering on A4 preview list
    attachDragAndDropHandlers();
  }

  function attachPreviewControlsHandlers() {
    // Delete question button
    document.querySelectorAll(".btn-preview-delete").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute("data-id");
        if (confirm("Bạn có chắc chắn muốn xóa câu hỏi này không?")) {
          // If we are currently editing this question, close the editor
          if (state.editingQuestionId === id) {
            closeEditor();
          }
          state.questions = state.questions.filter(q => q.id !== id);
          renderQuestionsList();
        }
      });
    });

    // Edit question button
    document.querySelectorAll(".btn-preview-edit").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute("data-id");
        openEditor(id);
      });
    });
  }

  // --- 7. Drag-and-Drop Reordering Logic ---
  let dragSrcEl = null;

  function attachDragAndDropHandlers() {
    const cols = document.querySelectorAll(".pdf-question-item");
    
    cols.forEach(col => {
      col.addEventListener("dragstart", handleDragStart, false);
      col.addEventListener("dragover", handleDragOver, false);
      col.addEventListener("dragenter", handleDragEnter, false);
      col.addEventListener("dragleave", handleDragLeave, false);
      col.addEventListener("drop", handleDrop, false);
      col.addEventListener("dragend", handleDragEnd, false);
    });
  }

  function handleDragStart(e) {
    this.classList.add("dragging");
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", this.innerHTML);
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    return false;
  }

  function handleDragEnter() {
    this.classList.add("over");
  }

  function handleDragLeave() {
    this.classList.remove("over");
  }

  function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    if (dragSrcEl !== this) {
      const srcId = dragSrcEl.getAttribute("data-id");
      const targetId = this.getAttribute("data-id");
      
      const srcIdx = state.questions.findIndex(q => q.id === srcId);
      const targetIdx = state.questions.findIndex(q => q.id === targetId);

      if (srcIdx !== -1 && targetIdx !== -1) {
        // Move element in state array
        const temp = state.questions[srcIdx];
        state.questions.splice(srcIdx, 1);
        state.questions.splice(targetIdx, 0, temp);

        // Re-number and re-render
        renderQuestionsList();

        // If editor is open, update its index title too
        if (state.editingQuestionId === srcId) {
          editingIndexLabel.textContent = `#${targetIdx + 1}`;
        } else if (state.editingQuestionId === targetId) {
          editingIndexLabel.textContent = `#${srcIdx + 1}`;
        }
      }
    }
    return false;
  }

  function handleDragEnd() {
    this.classList.remove("dragging");
    const cols = document.querySelectorAll(".pdf-question-item");
    cols.forEach(col => {
      col.classList.remove("over");
    });
  }

  // --- 8. Export to PDF Button ---
  btnDownloadPdf.addEventListener("click", async () => {
    if (state.questions.length === 0) {
      alert("Đề thi rỗng! Vui lòng trích xuất ít nhất một câu hỏi trước khi xuất PDF.");
      return;
    }

    const originalText = btnDownloadPdf.innerHTML;
    btnDownloadPdf.disabled = true;
    btnDownloadPdf.innerHTML = `<span class="spinner"></span> Đang kết xuất...`;

    try {
      const subject = cfgSubjectCode.value.trim() || "TRAC_NGHIEM";
      const watermarkEnabled = cfgWatermarkEnable.checked;
      const watermarkText = cfgWatermarkText.value.trim();
      
      // Call PDF Generator wrapper with watermark options
      await PDFGenerator.download("pdf-to-print", { 
        examTitle: "", 
        subject,
        watermarkEnabled,
        watermarkText
      });
    } catch (err) {
      alert(`Đã xảy ra lỗi khi tạo PDF: ${err.message}`);
    } finally {
      btnDownloadPdf.disabled = false;
      btnDownloadPdf.innerHTML = originalText;
    }
  });

  // --- 9. Manual Question Creation and Image Upload ---
  
  // Add Question Manually click handler
  btnAddCustomQuestion.addEventListener("click", () => {
    const newQuestion = {
      id: "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      questionNumber: (state.questions.length + 1).toString(),
      questionText: "Nhập nội dung câu hỏi tự luận hoặc trắc nghiệm tại đây...",
      originalImage: null,
      croppedImage: null,
      options: [] // Starts as essay, they can click "Thêm đáp án" to make it multiple choice
    };

    state.questions.push(newQuestion);
    renderQuestionsList();
    openEditor(newQuestion.id);
  });

  // Editor manual image upload button trigger
  btnUploadEditorImg.addEventListener("click", () => {
    editorImageUpload.click();
  });

  // Editor manual image input change handler
  editorImageUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const qIndex = state.questions.findIndex(q => q.id === state.editingQuestionId);
    if (qIndex === -1) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      state.questions[qIndex].originalImage = base64Data;
      
      // Update editor original image preview
      editorOriginalImg.src = base64Data;
      btnCropIllustration.style.display = "inline-flex";
      
      // Reset input value so same image can be reselected
      editorImageUpload.value = "";
    };
    reader.readAsDataURL(file);
  });

  // Auto split question & options from pasted text inside editor
  btnAutoSplit.addEventListener("click", () => {
    const rawText = editQuestionText.value;
    if (!rawText.trim()) {
      alert("Vui lòng nhập nội dung câu hỏi chứa các đáp án A B C D vào ô văn bản trước.");
      return;
    }

    const parsed = parseQuestionText(rawText);
    
    // Update textarea content with the cleaned question text
    editQuestionText.value = parsed.questionText;

    // Render the parsed options into inputs
    renderEditorOptions(parsed.options);
  });

  // Pure JavaScript parsing helper for copy-paste text questions
  function parseQuestionText(text) {
    const indices = [];
    const letters = ['A', 'B', 'C', 'D'];
    
    letters.forEach(letter => {
      const regex = new RegExp(`(?:\\b|[^a-zA-Z0-9])${letter}[\\.\\:\\)\\/\-\\s]`, 'i');
      const idx = text.search(regex);
      if (idx !== -1) {
        indices.push({ letter, index: idx });
      }
    });
    
    // Sort indices by their position in the text
    indices.sort((a, b) => a.index - b.index);
    
    let questionPart = text;
    let options = [];
    
    if (indices.length > 0) {
      // Question text is everything before the first option
      questionPart = text.substring(0, indices[0].index).trim();
      
      // Extract option texts
      for (let i = 0; i < indices.length; i++) {
        const current = indices[i];
        const next = indices[i + 1];
        let optionText = "";
        
        if (next) {
          optionText = text.substring(current.index, next.index);
        } else {
          optionText = text.substring(current.index);
        }
        
        // Remove prefix like "A.", "B:"
        const cleanRegex = new RegExp(`^(?:\\b|[^a-zA-Z0-9])${current.letter}[\\.\\:\\)\\/\-\\s]+\\s*`, 'i');
        optionText = optionText.replace(cleanRegex, "").trim();
        options.push(optionText);
      }
    }
    
    return {
      questionText: questionPart,
      options: options
    };
  }

  // --- Utility Helpers ---
  function escapeHtml(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
