/**
 * Simple HTML5 Canvas Image Cropper
 * Allows users to select and crop a portion of the original question screenshot.
 */

const ImageCropper = {
  canvas: null,
  ctx: null,
  image: null,
  isDrawing: false,
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  onCropCallback: null,

  // CSS Scaled to Natural pixels calculations
  scaleX: 1,
  scaleY: 1,

  /**
   * Initialize Cropper event handlers
   */
  init() {
    this.canvas = document.getElementById("cropper-canvas");
    this.ctx = this.canvas.getContext("2d");

    // Add Canvas Event Listeners
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    window.addEventListener("mouseup", this.handleMouseUp.bind(this));

    // Bind Button actions
    document.getElementById("btn-cancel-cropper").addEventListener("click", () => this.close());
    document.getElementById("btn-close-cropper").addEventListener("click", () => this.close());
    document.getElementById("btn-confirm-cropper").addEventListener("click", () => this.confirmCrop());
  },

  /**
   * Open the cropper modal with a specific image source
   * @param {string} imgSrc - Image URL/DataURL
   * @param {function} callback - Function called with cropped base64 string
   */
  open(imgSrc, callback) {
    this.onCropCallback = callback;
    this.image = new Image();
    
    this.image.onload = () => {
      // Set canvas natural dimensions
      this.canvas.width = this.image.naturalWidth;
      this.canvas.height = this.image.naturalHeight;
      
      // Draw full image initially
      this.resetSelection();
      this.drawImageAndMask();

      // Show Modal
      document.getElementById("modal-cropper").classList.remove("hidden");
    };
    
    this.image.src = imgSrc;
  },

  /**
   * Close the cropper modal
   */
  close() {
    document.getElementById("modal-cropper").classList.add("hidden");
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.image = null;
    this.onCropCallback = null;
  },

  /**
   * Reset the crop selection coordinates
   */
  resetSelection() {
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.endX = this.canvas.width;
    this.endY = this.canvas.height;
  },

  /**
   * Calculate conversion ratio between mouse client coordinates and canvas actual resolution
   */
  updateScaleRatios() {
    const rect = this.canvas.getBoundingClientRect();
    this.scaleX = this.canvas.width / rect.width;
    this.scaleY = this.canvas.height / rect.height;
  },

  /**
   * Get coordinates relative to canvas pixels
   */
  getCanvasCoords(e) {
    this.updateScaleRatios();
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    return {
      x: Math.max(0, Math.min(this.canvas.width, clientX * this.scaleX)),
      y: Math.max(0, Math.min(this.canvas.height, clientY * this.scaleY))
    };
  },

  handleMouseDown(e) {
    if (!this.image) return;
    const coords = this.getCanvasCoords(e);
    this.isDrawing = true;
    this.startX = coords.x;
    this.startY = coords.y;
    this.endX = coords.x;
    this.endY = coords.y;
  },

  handleMouseMove(e) {
    if (!this.isDrawing || !this.image) return;
    const coords = this.getCanvasCoords(e);
    this.endX = coords.x;
    this.endY = coords.y;
    this.drawImageAndMask();
  },

  handleMouseUp() {
    if (this.isDrawing) {
      this.isDrawing = false;
      // Ensure we have a valid positive width/height selection
      if (Math.abs(this.endX - this.startX) < 10 || Math.abs(this.endY - this.startY) < 10) {
        // If selection is too small, default to full image selection
        this.resetSelection();
        this.drawImageAndMask();
      }
    }
  },

  /**
   * Draw the image, overlay a dark transparent mask, and clear out the selection box.
   */
  drawImageAndMask() {
    // 1. Draw original image
    this.ctx.drawImage(this.image, 0, 0);

    // Get current selection bounds
    const x = Math.min(this.startX, this.endX);
    const y = Math.min(this.startY, this.endY);
    const w = Math.abs(this.endX - this.startX);
    const h = Math.abs(this.endY - this.startY);

    // 2. Draw dark transparent overlay
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 3. Clear/Cutout the selection box (show full-color original image)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
    this.ctx.drawImage(this.image, 0, 0);
    this.ctx.restore();

    // 4. Draw selection boundary box (dashed line)
    this.ctx.strokeStyle = "#2563eb";
    this.ctx.lineWidth = Math.max(2, this.canvas.width / 500); // Scale line width with resolution
    this.ctx.setLineDash([6, 6]);
    this.ctx.strokeRect(x, y, w, h);
  },

  /**
   * Crop the selected area and return it via the callback
   */
  confirmCrop() {
    if (!this.image || !this.onCropCallback) return;

    const x = Math.min(this.startX, this.endX);
    const y = Math.min(this.startY, this.endY);
    const w = Math.abs(this.endX - this.startX);
    const h = Math.abs(this.endY - this.startY);

    if (w <= 0 || h <= 0) {
      alert("Vui lòng kéo chọn vùng ảnh trước khi xác nhận!");
      return;
    }

    // Create a temporary canvas to draw the cropped area
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext("2d");

    // Draw the cropped section onto the temp canvas
    tempCtx.drawImage(
      this.image,
      x, y, w, h,      // Source coordinates & size
      0, 0, w, h       // Destination coordinates & size
    );

    // Convert temp canvas to base64 DataURL (PNG format to keep quality)
    const croppedDataURL = tempCanvas.toDataURL("image/png");
    
    // Fire callback and close modal
    this.onCropCallback(croppedDataURL);
    this.close();
  }
};
