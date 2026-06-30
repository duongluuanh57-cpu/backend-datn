import { getGeminiClient } from './_contentGeminiClient.ts';

/**
 * Node 1: Researcher Agent (Gemini 3.1 Flash-Lite)
 */
export async function researcherNode(state: any) {
  console.log('--- [Step 1] Researcher (Gemini 3.1 Flash-Lite) is researching... ---');
  try {
    const response = await getGeminiClient().invoke([
      ["system", "Bạn là một người nghiên cứu thông thái nhưng thích kể chuyện bằng ngôn ngữ bình dân. Hãy tóm tắt ngắn gọn, dễ hiểu nhất có thể về chủ đề này."],
      ["user", state.task]
    ]);
    return { research: typeof response.content === 'string' ? response.content : JSON.stringify(response.content) };
  } catch (error) {
    console.error('Researcher Error:', error);
    throw error;
  }
}

/**
 * Node 2: Writer Agent (Gemini 3.1 Flash-Lite)
 */
export async function writerNode(state: any) {
  console.log('--- [Step 2] Writer (Gemini 3.1 Flash-Lite) is writing... ---');
  try {
    const response = await getGeminiClient().invoke([
      ["system", "Bạn là một người kể chuyện tài ba. Hãy dựa trên nghiên cứu để viết một bài viết cực kỳ tối giản, dùng từ ngữ mà một người bình thường cũng hiểu được ngay. Tránh dùng từ chuyên môn khó hiểu."],
      ["user", `Nghiên cứu: ${state.research}`]
    ]);
    return { final_output: typeof response.content === 'string' ? response.content : JSON.stringify(response.content) };
  } catch (error) {
    console.error('Writer Error:', error);
    throw error;
  }
}

/**
 * Node 3: Reviewer Agent (Gemini 3.1) - Kiểm duyệt tính dễ hiểu
 */
export async function reviewerNode(state: any) {
  console.log('--- [Step 3] Reviewer (Gemini 3.1 Flash-Lite) is reviewing... ---');
  try {
    const response = await getGeminiClient().invoke([
      ["system", "Bạn là một biên tập viên quan tâm đến trải nghiệm người đọc phổ thông. Hãy kiểm tra bài viết sau, loại bỏ nốt những từ ngữ quá phức tạp, làm cho nó trở nên gần gũi, súc tích và dễ đọc nhất có thể. Đảm bảo văn phong tự nhiên."],
      ["user", `Bài viết cần duyệt: ${state.final_output}`]
    ]);
    return { final_output: typeof response.content === 'string' ? response.content : JSON.stringify(response.content) };
  } catch (error) {
    console.error('Reviewer Error:', error);
    throw error;
  }
}