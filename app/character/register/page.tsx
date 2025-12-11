'use client';

import React, { useState, useEffect, useCallback, useRef, use } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { db } from '@/firebase/clientApp';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getUserProfile, UserProfile } from '@/firebase/userProfile';
import Link from 'next/link';

// 데이터 구조 정의
interface CharacterSettings {
  name: string;
  avatarUrl: string;
  characterPersona: string;
  userPersona: string;
  stylePrompt: string;
  systemPrompt?: string; 
}

interface Message {
  id?: string;
  role: 'user' | 'model';
  content: string;
  createdAt?: any;
}

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const characterId = id;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const initialConversationId = searchParams.get('conversationId');

  const [conversationId, setConversationId] = useState(initialConversationId || '');
  const [character, setCharacter] = useState<CharacterSettings | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  // 요약 관련 상태
  const [summary, setSummary] = useState('');
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 0. 대화방 ID 관리
  useEffect(() => {
    if (!initialConversationId && !conversationId) {
      const newId = generateUUID();
      router.replace(`${pathname}?conversationId=${newId}`);
      setConversationId(newId);
    } else if (initialConversationId && !conversationId) {
      setConversationId(initialConversationId);
    }
  }, [initialConversationId, conversationId, pathname, router]);

  // 1. 기본 정보 로드
  useEffect(() => {
    if (!characterId || !conversationId) return;
    async function fetchData() {
      try {
        const charDoc = await getDoc(doc(db, 'characters', characterId as string));
        if (charDoc.exists()) setCharacter(charDoc.data() as CharacterSettings);
        
        const profile = await getUserProfile();
        setUserProfile(profile);

        // 요약 불러오기
        const convDoc = await getDoc(doc(db, 'characters', characterId as string, 'conversations', conversationId));
        if (convDoc.exists() && convDoc.data().currentSummary) {
            setSummary(convDoc.data().currentSummary);
        }
      } catch (error) { console.error("로딩 실패:", error); }
    }
    fetchData();
  }, [characterId, conversationId]);

  // 2. 실시간 메시지 로드
  useEffect(() => {
    if (!characterId || !conversationId || !character) {
      setLoading(true);
      return;
    }
    setLoading(false);

    const q = query(
      collection(db, 'characters', characterId as string, 'conversations', conversationId, 'messages'), 
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      // 빈 대화방일 때 첫 인사
      if (msgs.length === 0 && character) {
          msgs.push({ role: 'model', content: `${character.name} (이)가 무대에 등장했어요!`, createdAt: { seconds: 0 } });
      }
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [characterId, conversationId, character]);

  // 스크롤 튕김 방지 (지연 스크롤)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // 요약 기능 핸들러들
  const handleAiSummarize = async () => {
    if (messages.length < 5) return alert("대화가 너무 짧아요!");
    setIsSummarizing(true);
    try {
        const res = await fetch('/api/summarize', {
            method: 'POST',
            body: JSON.stringify({ messages: messages.slice(1), characterName: character?.name, userName: userProfile?.name })
        });
        const data = await res.json();
        if (data.summary) setSummary(data.summary);
    } catch (e) { alert("요약 실패"); } finally { setIsSummarizing(false); }
  };

  const handleSaveSummary = async () => {
    if (!conversationId) return;
    await setDoc(doc(db, 'characters', characterId as string, 'conversations', conversationId), { currentSummary: summary }, { merge: true });
    alert("요약 저장 완료!");
    setIsSummaryOpen(false);
  };

  // 3. 메시지 전송
  const handleSend = useCallback(async () => {
    if (!input.trim() || !character || !userProfile || isSending || !conversationId) return;
    setIsSending(true);
    const userInput = input;
    setInput('');

    try {
      // 유령 문서 방지 (대화방 생성)
      const convRef = doc(db, 'characters', characterId as string, 'conversations', conversationId);
      await setDoc(convRef, { createdAt: serverTimestamp() }, { merge: true }); 
      
      // 메시지 저장
      const msgRef = collection(convRef, 'messages');
      await addDoc(msgRef, { role: 'user', content: userInput, createdAt: serverTimestamp() });

      // 시스템 프롬프트 구성
      const summaryContext = summary ? `\n[기억된 대화 요약]\n${summary}\n` : "";
      const fullSystemInstruction = `
        [Character] ${character.characterPersona}
        [User] ${userProfile.name} (${userProfile.userPersona})
        ${summaryContext}
        [Style] ${character.stylePrompt}
      `.trim();
      
      const historyCount = summary ? -60 : -60; // 요약 있으면 기억 범위 줄여서 비용 절약
      const historyForAI = messages.slice(historyCount).map(msg => ({ role: msg.role, content: msg.content }));
      historyForAI.push({ role: 'user', content: userInput });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterSettings: { ...character, systemPrompt: fullSystemInstruction }, messages: historyForAI }),
      });

      const data = await res.json();
      if (res.ok && data.content) {
        await addDoc(msgRef, { role: 'model', content: data.content, createdAt: serverTimestamp() });
      }
    } catch (error) { console.error("전송 실패:", error); } finally { setIsSending(false); }
  }, [input, character, userProfile, messages, characterId, isSending, conversationId, summary]);

  const handleNewChat = () => { router.push(`${pathname}`); }

  if (loading || !conversationId || !character) return <div className="flex h-screen items-center justify-center text-sky-600">로딩 중...</div>;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white border-x border-gray-100 relative">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-sm z-10">
        <div className="flex items-center">
            <Link href="/" className="mr-4"><svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg></Link>
            <h2 className="text-lg font-bold text-gray-900">{character?.name}</h2>
        </div>
        <div className='flex items-center space-x-2'>
            <button onClick={() => setIsSummaryOpen(!isSummaryOpen)} className={`p-2 rounded-full text-sm font-semibold ${summary ? 'text-sky-600' : 'text-gray-500'}`}>📝 요약</button>
            <Link href={`/character/${characterId}/conversations`} className="p-2 text-gray-500 text-sm font-semibold">기록</Link>
            <button onClick={handleNewChat} className="p-2 text-sky-500 text-sm font-semibold">새 대화</button>
        </div>
      </div>

      {/* 요약 패널 */}
      {isSummaryOpen && (
          <div className="bg-gray-50 border-b p-4">
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="w-full p-3 border rounded-md h-24 text-sm" placeholder="AI 요약 결과가 여기 표시됩니다." />
              <div className="flex justify-end space-x-2 mt-2">
                  <button onClick={handleAiSummarize} disabled={isSummarizing} className="px-3 py-1 bg-white border rounded text-sm">🤖 자동 요약</button>
                  <button onClick={handleSaveSummary} className="px-3 py-1 bg-sky-600 text-white rounded text-sm font-bold">저장</button>
              </div>
          </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((msg) => {
          // ⭐ [튕김 방지 핵심] createdAt이 없거나(null), seconds가 없으면 렌더링하지 않고 넘어감
          if (msg.role === 'model' && (!msg.createdAt || msg.createdAt.seconds === 0)) return null; 

          const isModel = msg.role === 'model';
          return (
            <div key={msg.id} className="flex px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
              <img src={isModel ? character?.avatarUrl : userProfile?.avatarUrl} className="w-10 h-10 rounded-full object-cover mr-3"/>
              <div className="flex-1">
                <div className="font-bold text-gray-900 text-sm mb-1">{isModel ? character?.name : userProfile?.name}</div>
                <div className="text-gray-900 whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              </div>
            </div>
          );
        })}
        {isSending && <div className="px-4 py-3 text-sky-500 text-sm animate-pulse">작성 중...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      <div className="p-3 bg-white border-t sticky bottom-0">
        <div className="flex items-end bg-gray-100 rounded-2xl px-4 py-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()} className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2 max-h-32" placeholder="메시지 입력..." rows={1}/>
          <button onClick={handleSend} disabled={!input.trim() || isSending} className="ml-2 mb-1 px-4 py-1.5 bg-sky-500 text-white rounded-full font-bold text-sm disabled:bg-gray-300">전송</button>
        </div>
      </div>
    </div>
  );
}