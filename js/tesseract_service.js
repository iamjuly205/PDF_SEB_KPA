/**
 * Tesseract.js OCR Service
 * Performs offline OCR on question images directly in the browser.
 * Supports Vietnamese (vie) and Simplified Chinese (chi_sim).
 * No API Key required, no quota limits.
 */

const TesseractService = {
  _worker: null,
  _isReady: false,
  _isLoading: false,
  _onReadyCallbacks: [],

  /**
   * Initialize Tesseract worker with Vietnamese + Chinese language packs.
   * Downloads language data on first use (~20MB). Cached by browser after first load.
   */
  async init() {
    if (this._isReady) return;
    if (this._isLoading) {
      // Already loading — wait for it
      return new Promise((resolve) => {
        this._onReadyCallbacks.push(resolve);
      });
    }

    this._isLoading = true;
    console.log("[Tesseract] Đang khởi tạo OCR engine (tải lần đầu ~20MB)...");

    try {
      // Use Tesseract v5 API
      this._worker = await Tesseract.createWorker(["vie", "chi_sim"], 1, {
        logger: (m) => {
          if (m.status === "loading tesseract core") {
            console.log("[Tesseract] Đang tải lõi OCR...");
          } else if (m.status === "loading language traineddata") {
            console.log(`[Tesseract] Đang tải gói ngôn ngữ: ${Math.round((m.progress || 0) * 100)}%`);
          }
        }
      });

      this._isReady = true;
      this._isLoading = false;
      console.log("[Tesseract] Sẵn sàng nhận diện chữ!");

      // Resolve all waiting callers
      this._onReadyCallbacks.forEach(cb => cb());
      this._onReadyCallbacks = [];
    } catch (err) {
      this._isLoading = false;
      console.error("[Tesseract] Lỗi khởi tạo:", err);
      throw new Error("Không thể khởi tạo OCR engine. Vui lòng kiểm tra kết nối mạng (tải lần đầu cần internet để tải gói ngôn ngữ).");
    }
  },

  /**
   * Run OCR on a base64 image and return a structured question object.
   * @param {string} base64Data - Base64 string WITHOUT the data:image prefix
   * @param {string} mimeType - e.g. 'image/png'
   * @returns {Promise<Object>} Structured question data compatible with Gemini output format
   */
  async extractQuestion(base64Data, mimeType) {
    if (!this._isReady) {
      await this.init();
    }

    const imageDataUrl = `data:${mimeType};base64,${base64Data}`;

    try {
      const { data } = await this._worker.recognize(imageDataUrl);
      const rawText = data.text || "";

      // Parse the OCR text to separate question and options
      return this._parseOcrText(rawText);
    } catch (err) {
      console.error("[Tesseract] Lỗi nhận diện:", err);
      throw new Error(`OCR Error: ${err.message}`);
    }
  },

  /**
   * Parse raw OCR text into structured question format.
   * Detects A. B. C. D. answer options and splits them out.
   */
  _parseOcrText(rawText) {
    // Normalize line breaks
    let text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

    // Remove common OCR artifacts
    text = text.replace(/\f/g, "").trim();

    if (!text) {
      return {
        question_number: "",
        question_text: "Không nhận diện được chữ trong ảnh. Vui lòng nhập thủ công.",
        has_illustration: false,
        options: [],
        illustration_box: []
      };
    }

    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    // Detect question number at start (e.g. "Câu 7:", "Question 5.", "7.")
    let questionNumber = "";
    let questionLines = [];
    let options = [];
    let inOptions = false;
    let currentOptionLetter = null;
    let currentOptionLines = [];

    const optionStartRegex = /^([ABCD])\s*[.:\)\/\-]\s*/i;
    const questionNumRegex = /^(câu\s*)?(\d+)\s*[.:)]/i;

    lines.forEach((line, i) => {
      // Check if this line starts a new option
      const optMatch = line.match(optionStartRegex);

      if (optMatch) {
        // Save previous option if any
        if (currentOptionLetter !== null) {
          options.push(currentOptionLines.join(" ").trim());
        }
        inOptions = true;
        currentOptionLetter = optMatch[1].toUpperCase();
        currentOptionLines = [line.replace(optionStartRegex, "").trim()];
      } else if (inOptions && currentOptionLetter !== null && line.length > 0) {
        // Continuation of current option
        currentOptionLines.push(line);
      } else {
        // Regular question text line
        if (i === 0) {
          // First line: try to extract question number
          const numMatch = line.match(questionNumRegex);
          if (numMatch) {
            questionNumber = numMatch[2];
            const rest = line.replace(questionNumRegex, "").trim();
            if (rest) questionLines.push(rest);
          } else {
            questionLines.push(line);
          }
        } else {
          questionLines.push(line);
        }
      }
    });

    // Push last option
    if (currentOptionLetter !== null) {
      options.push(currentOptionLines.join(" ").trim());
    }

    return {
      question_number: questionNumber,
      question_text: questionLines.join("\n"),
      has_illustration: false,
      options: options,
      illustration_box: []
    };
  },

  /**
   * Terminate the worker when done (optional cleanup)
   */
  async terminate() {
    if (this._worker) {
      await this._worker.terminate();
      this._worker = null;
      this._isReady = false;
    }
  }
};
