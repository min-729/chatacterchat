import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("API Key is missing!");
      return NextResponse.json({ error: 'API Key not found' }, { status: 500 });
    }

    const genAI = new GoogleGenAI({ apiKey });

    const { messages, characterName, userName } = await req.json();

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

    // ⭐ 모델 이름을 맨 처음 썼던 것으로 되돌림 (이게 맞는 이름이었어!)
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    });

    // 여기서부터는 안전 장치야. 
    // 혹시 text가 바로 안 나오면 후보군(candidates)을 뒤져서라도 꺼내올 거야.
    let summary = response.text;

    // 만약 summary가 비어있다면, 수동으로 깊숙이 있는 대답을 찾는다.
    if (!summary && response.candidates && response.candidates.length > 0) {
       const firstCandidate = response.candidates[0];
       
       if (firstCandidate.content && firstCandidate.content.parts && firstCandidate.content.parts.length > 0) {
           summary = firstCandidate.content.parts[0].text;
       }
    }

    // 그래도 없으면 에러 로그를 남기자.
    if (!summary) {
        console.error("No summary found in response:", JSON.stringify(response, null, 2));
        return NextResponse.json({ error: 'No summary generated' }, { status: 500 });
    }

    return NextResponse.json({ summary });

  } catch (error) {
    console.error('Summary Error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}