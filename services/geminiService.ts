import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = ai.models;

const PROMPTS = {
  fa: {
    plantId: `
شما یک دستیار متخصص باغبانی به زبان فارسی هستید. وظیفه شما شناسایی گیاه موجود در این تصویر است.
لطفاً پاسخ خود را با فرمت زیر و به زبان فارسی ارائه دهید:

**نام گیاه:** [نام رایج گیاه به فارسی] / [نام علمی به انگلیسی]

**معرفی:**
[توضیح مختصر و جالبی درباره گیاه، منشأ آن و ویژگی‌های اصلی آن.]

**دستورالعمل‌های مراقبت:**
*   **نور:** [توضیح کامل در مورد نیاز نوری گیاه. مثلا: نور غیرمستقیم و زیاد، تحمل نور کم و... ]
*   **آبیاری:** [توضیح کامل در مورد نحوه و زمان آبیاری. مثلا: خاک بین دو آبیاری خشک شود، همیشه مرطوب بماند و... ]
*   **خاک:** [نوع خاک مناسب برای گیاه. مثلا: خاک با زهکشی خوب، ترکیبی از پیت ماس و پرلیت و... ]
*   **دما و رطوبت:** [بازه دمایی و سطح رطوبت ایده‌آل برای گیاه.]
*   **کوددهی:** [زمان و نوع کود مناسب برای گیاه در فصول مختلف.]

**مشکلات رایج:**
[فهرستی از آفات و بیماری‌های شایع گیاه همراه با راه‌حل‌های ساده.]

اگر تصویر واضح نیست یا گیاهی در آن وجود ندارد، لطفاً به صورت محترمانه از کاربر بخواهید عکس بهتری ارسال کند.
`,
    systemInstruction: "شما یک دستیار باغبانی دانا و مفید به زبان فارسی هستید. به سوالات کاربران در مورد گیاهان و باغبانی به طور دقیق و دوستانه پاسخ دهید."
  },
  en: {
    plantId: `
You are an expert gardening assistant. Your task is to identify the plant in this image.
Please provide your response in the following format and in English:

**Plant Name:** [Common Plant Name] / [Scientific Name]

**Introduction:**
[A brief and interesting description of the plant, its origin, and main characteristics.]

**Care Instructions:**
*   **Light:** [Detailed explanation of the plant's light requirements. e.g., bright, indirect light, tolerates low light, etc.]
*   **Watering:** [Detailed explanation on how and when to water. e.g., let the soil dry out between waterings, keep consistently moist, etc.]
*   **Soil:** [The suitable soil type for the plant. e.g., well-draining soil, a mix of peat moss and perlite, etc.]
*   **Temperature & Humidity:** [The ideal temperature range and humidity level for the plant.]
*   **Fertilizing:** [When and what type of fertilizer is suitable for the plant in different seasons.]

**Common Problems:**
[A list of common pests and diseases for the plant, along with simple solutions.]

If the image is not clear or does not contain a plant, please politely ask the user to send a better picture.
`,
    systemInstruction: "You are a knowledgeable and helpful gardening assistant. Answer user questions about plants and gardening accurately and in a friendly tone."
  }
};

export type Language = 'fa' | 'en';

export const analyzePlantImage = async (base64Image: string, mimeType: string, lang: Language): Promise<GenerateContentResponse> => {
  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType,
    },
  };

  const textPart = {
    text: PROMPTS[lang].plantId,
  };

  const response = await model.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
  });
  
  return response;
};


export const createChatSession = (lang: Language): Chat => {
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: PROMPTS[lang].systemInstruction
        }
    });
};

export const sendMessageToChat = async (chat: Chat, message: string): Promise<GenerateContentResponse> => {
    const response = await chat.sendMessage({ message });
    return response;
};