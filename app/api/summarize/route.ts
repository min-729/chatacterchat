import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not found' }, { status: 500 });
    }

    // GoogleGenAI 클라이언트 초기화
    const genAI = new GoogleGenAI({ apiKey });

    const { messages, characterName, userName } = await req.json();

    // 대화 메시지 포맷팅
    const conversationText = messages.map((msg: any) => {
        const speaker = msg.role === 'user' ? userName : characterName;
        return `${speaker}: ${msg.content}`;
    }).join('\n');

    const prompt = `
    다음은 ${userName}와 ${characterName}의 대화 기록입니다.
    이 대화의 핵심 내용, 주요 사건, 그리고 두 사람 사이의 관계 변화나 중요한 정보를 빠진 부분 없이 요약해 1000자 이내로 작성해 주세요.
    
    [대화 기록]
    ${conversationText}
    `;

    // 콘텐츠 생성 요청
    const response = await genAI.models.generateContent({
      model: 'gemini-1.5-flash-001',
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    });

    // 응답 텍스트 추출
    const summary = response.text ?? ""; 

    return NextResponse.json({ summary });

  } catch (error) {
    console.error('Summary Error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}