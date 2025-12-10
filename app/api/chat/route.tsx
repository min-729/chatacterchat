import { GoogleGenAI } from '@google/genai';

// GEMINI_API_KEY가 없으면, 이곳에서 에러가 발생하지 않도록
// 기본 설정을 비워둡니다. 키가 없으면 나중에 API 호출만 실패합니다.
const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    // 클라이언트에서 보낸 데이터 받기 (이전 대화 기록 및 설정)
    const { messages, characterSettings } = await req.json();

    // 1. 시스템 프롬프트 구성
    const systemInstruction = characterSettings.systemPrompt;
    
    // 2. 메시지 형식 변환 (Gemini API는 parts: [{text: string}] 형식을 사용)
    const history = messages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model', // 역할은 user 또는 model
      parts: [{ text: msg.content }],
    }));

    // 3. AI에게 요청 보내기
    const completion = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: history,
      config: {
        systemInstruction: systemInstruction, // 캐릭터 설정을 여기에 주입
        temperature: 0.7,
      }
    });

    // 4. 응답 반환
    const responseText = completion.text;
    
    return new Response(JSON.stringify({ 
      content: responseText 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // API 키가 없거나 호출이 실패하면 이리로 옵니다.
    console.error("Gemini API Error:", error);
    return new Response(JSON.stringify({ 
        error: '제미나이 배우가 대답을 망설이고 있어. 키가 없어서 그래.' 
    }), { status: 500 });
  }
}