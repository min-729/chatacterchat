// ⭐ 표준 라이브러리 import로 변경
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// API 키 설정
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { messages, characterName, userName } = await req.json();

    const conversationText = messages.map((msg: any) => {
        const speaker = msg.role === 'user' ? userName : characterName;
        return `${speaker}: ${msg.content}`;
    }).join('\n');

    // ⭐ 모델 호출 방식 수정
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
    다음은 ${userName}와 ${characterName}의 대화 기록입니다.
    이 대화의 핵심 내용, 주요 사건, 그리고 두 사람 사이의 관계 변화나 중요한 정보를 길이에 무관하게 핵심을 잘 짚어 빠짐없이 요약해주세요. (최대 1000자)
    나중에 이 요약만 보고도 이전 대화 흐름을 파악할 수 있어야 합니다.

    [대화 기록]
    ${conversationText}
    `;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Summary Error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}