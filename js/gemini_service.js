/**
 * Gemini API Service Module
 * Handles OCR and structured question extraction from screenshots.
 */

const GeminiService = {
  /**
   * Sends an image to the Gemini API and returns a structured question object.
   * @param {string} base64Data - Base64 encoded image data (without prefix)
   * @param {string} mimeType - The mime type of the image (e.g., 'image/png')
   * @param {string} apiKey - Google Gemini API Key
   * @returns {Promise<Object>} The structured question data
   */
  async extractQuestion(base64Data, mimeType, apiKey) {
    if (!apiKey) {
      throw new Error("Vui lòng cấu hình Gemini API Key trước khi thực hiện trích xuất.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Bạn là một trợ lý AI chuyên nghiệp về số hóa đề thi.
Hãy phân tích hình ảnh câu hỏi được cung cấp và trích xuất nội dung chính xác.
Đặc biệt lưu ý:
1. Đề bài có thể chứa chữ tiếng Trung (Hán tự), tiếng Việt và tiếng Anh. Hãy trích xuất nguyên trạng tất cả ngôn ngữ.
2. Trích xuất nội dung câu hỏi một cách chi tiết (bao gồm cả chỉ dẫn nếu có, ví dụ: 'Xem hình và cho biết...', 'Đọc và chọn từ...').
3. Nhận diện các phương án lựa chọn và tách chúng ra thành một danh sách (mảng). Bỏ qua các ký tự đầu dạng hình tròn nút bấm trắc nghiệm hoặc chữ cái A, B, C, D ở đầu đáp án nếu có, chỉ lấy nội dung văn bản của đáp án.
4. BẤT KỲ câu hỏi nào chứa hình vẽ, tranh minh hoạ, ảnh chụp vật thể (như cái bàn, cái ghế, con vật, phong cảnh...), biểu đồ, sơ đồ nằm bên trong đề bài thì ĐỀU BẮT BUỘC phải đặt has_illustration = true.
5. CỰC KỲ QUAN TRỌNG VỀ XUỐNG DÒNG: Hãy giữ nguyên cấu trúc dòng và các ký tự xuống dòng (\\n) từ hình ảnh gốc. Không được tự ý gộp các câu hướng dẫn, các lưu ý gạch đầu dòng (bullet points) hay các phần khác nhau của câu hỏi thành một hàng liên tục. Hãy sử dụng ký tự xuống dòng '\\n' để phân tách rõ ràng các phần này trong văn bản câu hỏi (ví dụ: tránh gộp dính chữ dạng 'tiếng Trung:Lưu ý:Cuối câu').
6. HỘP BAO HÌNH MINH HỌA (illustration_box): Khi has_illustration = true, hãy phân tích tọa độ của vùng hình ảnh minh họa đó trong ảnh gốc. Cung cấp tọa độ [ymin, xmin, ymax, xmax] dưới dạng tỷ lệ phần trăm từ 0 đến 100 (Ví dụ: [20, 15, 65, 80]).
   Nếu không có hình vẽ minh họa, trả về mảng rỗng [].

Trả về kết quả ở định dạng JSON phù hợp với lược đồ (schema) yêu cầu.`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            question_number: { 
              type: "STRING",
              description: "Số thứ tự của câu hỏi nếu có trong hình, ví dụ '7' hoặc '10'. Nếu không tìm thấy, để trống."
            },
            question_text: { 
              type: "STRING", 
              description: "Văn bản câu hỏi đầy đủ. CỰC KỲ QUAN TRỌNG: Nếu câu hỏi có nhiều dòng chỉ dẫn, lưu ý gạch đầu dòng, hoặc phần hướng dẫn dịch nghĩa tiếng Trung và tiếng Việt riêng biệt, bắt buộc phải sử dụng ký tự xuống dòng \\n để phân tách từng dòng riêng biệt, tuyệt đối không gộp chung tất cả thành một hàng liên tục." 
            },
            has_illustration: { 
              type: "BOOLEAN", 
              description: "Đặt là true nếu trong câu hỏi có tranh minh họa, sơ đồ, biểu đồ cần giữ lại. Đặt false nếu chỉ có chữ."
            },
            options: {
              type: "ARRAY",
              description: "Danh sách các đáp án lựa chọn trắc nghiệm. Trích xuất riêng biệt từng lựa chọn.",
              items: { type: "STRING" }
            },
            illustration_box: {
              type: "ARRAY",
              description: "Mảng gồm 4 số nguyên [ymin, xmin, ymax, xmax] biểu diễn tỷ lệ phần trăm vùng chứa hình minh họa (0-100). Trả về mảng rỗng [] nếu has_illustration = false.",
              items: { type: "NUMBER" }
            }
          },
          required: ["question_number", "question_text", "has_illustration", "options", "illustration_box"]
        }
      }
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP error! status: ${response.status}`;
        throw new Error(`Gemini API Error: ${errorMessage}`);
      }

      const result = await response.json();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) {
        throw new Error("Không nhận được dữ liệu phản hồi từ AI.");
      }

      // Parse JSON từ phản hồi của Gemini (dọn dẹp markdown block nếu có)
      let cleanedText = textResponse.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
      }
      cleanedText = cleanedText.trim();

      try {
        const parsedQuestion = JSON.parse(cleanedText);
        return parsedQuestion;
      } catch (parseError) {
        console.error("Lỗi parse JSON kết quả Gemini:", textResponse);
        throw new Error("Dữ liệu phản hồi của AI không đúng định dạng JSON yêu cầu.");
      }
    } catch (error) {
      console.error("Lỗi trong quá trình gọi API Gemini:", error);
      throw error;
    }
  },

  /**
   * Sends multiple images to the Gemini API in a single request and returns a list of structured question objects.
   * @param {Array<Object>} images - Array of { base64, mimeType } objects
   * @param {string} apiKey - Google Gemini API Key
   * @returns {Promise<Array<Object>>} The array of structured question data
   */
  async extractQuestionsBatch(images, apiKey) {
    if (!apiKey) {
      throw new Error("Vui lòng cấu hình Gemini API Key trước khi thực hiện trích xuất.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Bạn là một trợ lý AI chuyên nghiệp về số hóa đề thi.
Bạn sẽ nhận được một danh sách gồm một hoặc nhiều hình ảnh chứa các câu hỏi độc lập được gửi kèm bên dưới.
Nhiệm vụ của bạn là phân tích từng hình ảnh theo thứ tự xuất hiện (ảnh thứ 1, ảnh thứ 2,...) và trích xuất nội dung chính xác của câu hỏi tương ứng.

Đặc biệt lưu ý khi trích xuất cho mỗi câu hỏi:
1. Đề bài có thể chứa chữ tiếng Trung (Hán tự), tiếng Việt và tiếng Anh. Hãy trích xuất nguyên trạng tất cả ngôn ngữ.
2. Trích xuất nội dung câu hỏi một cách chi tiết (bao gồm cả chỉ dẫn nếu có, ví dụ: 'Xem hình và cho biết...', 'Đọc và chọn từ...').
3. Nhận diện các phương án lựa chọn và tách chúng ra thành một danh sách (mảng). Bỏ qua các ký tự đầu dạng hình tròn nút bấm trắc nghiệm hoặc chữ cái A, B, C, D ở đầu đáp án nếu có, chỉ lấy nội dung văn bản của đáp án.
4. BẤT KỲ câu hỏi nào chứa hình vẽ, tranh minh hoạ, ảnh chụp vật thể (như cái bàn, cái ghế, con vật...), biểu đồ, sơ đồ nằm bên trong đề bài thì ĐỀU BẮT BUỘC phải đặt has_illustration = true.
5. CỰC KỲ QUAN TRỌNG VỀ XUỐNG DÒNG: Hãy giữ nguyên cấu trúc dòng và các ký tự xuống dòng (\\n) từ hình ảnh gốc. Không được tự ý gộp các câu hướng dẫn, các lưu ý gạch đầu dòng (bullet points) hay các phần khác nhau của câu hỏi thành một hàng liên tục. Hãy sử dụng ký tự xuống dòng '\\n' để phân tách rõ ràng các phần này trong văn bản câu hỏi.
6. HỘP BAO HÌNH MINH HỌA (illustration_box): Khi has_illustration = true, hãy phân tích tọa độ của vùng hình ảnh minh họa đó trong ảnh gốc. Cung cấp tọa độ [ymin, xmin, ymax, xmax] dưới dạng tỷ lệ phần trăm từ 0 đến 100 (Ví dụ: [20, 15, 65, 80]). Nếu không có hình vẽ minh họa, trả về mảng rỗng [].
7. Chỉ số index hình ảnh (image_index): BẮT BUỘC phải gán thuộc tính image_index bằng đúng chỉ số index của hình ảnh tương ứng trong danh sách ảnh được gửi lên (ảnh thứ nhất có image_index = 0, ảnh thứ hai có image_index = 1, v.v.).

Trả về kết quả ở định dạng JSON phù hợp với lược đồ (schema) yêu cầu bên dưới.`;

    // Construct request parts: prompt text followed by inlineData for each image
    const parts = [{ text: prompt }];
    images.forEach(img => {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64
        }
      });
    });

    const requestBody = {
      contents: [
        {
          parts: parts
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            questions: {
              type: "ARRAY",
              description: "Danh sách các câu hỏi được trích xuất từ các hình ảnh tương ứng.",
              items: {
                type: "OBJECT",
                properties: {
                  image_index: {
                    type: "NUMBER",
                    description: "Chỉ số index của hình ảnh tương ứng trong danh sách ảnh gửi lên, bắt đầu từ 0."
                  },
                  question_number: { 
                    type: "STRING",
                    description: "Số thứ tự của câu hỏi nếu có trong hình. Nếu không tìm thấy, để trống."
                  },
                  question_text: { 
                    type: "STRING", 
                    description: "Văn bản câu hỏi đầy đủ. Bắt buộc sử dụng ký tự xuống dòng \\n để phân tách các dòng chỉ dẫn hoặc lưu ý riêng biệt." 
                  },
                  has_illustration: { 
                    type: "BOOLEAN", 
                    description: "Đặt là true nếu trong câu hỏi có hình minh họa/hình vẽ đồ vật cần trích xuất."
                  },
                  options: {
                    type: "ARRAY",
                    description: "Danh sách các đáp án lựa chọn trắc nghiệm.",
                    items: { type: "STRING" }
                  },
                  illustration_box: {
                    type: "ARRAY",
                    description: "Tọa độ hộp bao [ymin, xmin, ymax, xmax] từ 0 đến 100 của hình minh họa. Trả về mảng rỗng [] nếu không có hình.",
                    items: { type: "NUMBER" }
                  }
                },
                required: ["image_index", "question_number", "question_text", "has_illustration", "options", "illustration_box"]
              }
            }
          },
          required: ["questions"]
        }
      }
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP error! status: ${response.status}`;
        throw new Error(`Gemini API Error: ${errorMessage}`);
      }

      const result = await response.json();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) {
        throw new Error("Không nhận được dữ liệu phản hồi từ AI.");
      }

      let cleanedText = textResponse.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
      }
      cleanedText = cleanedText.trim();

      try {
        const parsedResult = JSON.parse(cleanedText);
        return parsedResult.questions || [];
      } catch (parseError) {
        console.error("Lỗi parse JSON kết quả Gemini:", textResponse);
        throw new Error("Dữ liệu phản hồi của AI không đúng định dạng JSON yêu cầu.");
      }
    } catch (error) {
      console.error("Lỗi trong quá trình gọi API Gemini:", error);
      throw error;
    }
  }
};
