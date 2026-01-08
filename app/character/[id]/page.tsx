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
  
  // 제목 수정 상태
  const [chatTitle, setChatTitle] = useState(''); 
  const [isEditingTitle, setIsEditingTitle] = useState(false);

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

        const convDoc = await getDoc(doc(db, 'characters', characterId as string, 'conversations', conversationId));
        if (convDoc.exists()) {
            const data = convDoc.data();
            if (data.currentSummary) setSummary(data.currentSummary);
            setChatTitle(data.title || '제목 없는 대화');
        } else {
            setChatTitle('새로운 대화');
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
      if (msgs.length === 0 && character) {
          msgs.push({ role: 'model', content: `${character.name} (이)가 무대에 등장했어요!`, createdAt: { seconds: 0 } });
      }
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [characterId, conversationId, character]);

  // 스크롤 튕김 방지
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // 제목 저장
  const handleSaveTitle = async () => {
      if (!conversationId || !chatTitle.trim()) return;
      try {
          await setDoc(doc(db, 'characters', characterId as string, 'conversations', conversationId), { 
              title: chatTitle,
              createdAt: serverTimestamp() 
          }, { merge: true });
          setIsEditingTitle(false);
      } catch (e) { console.error("제목 저장 실패", e); }
  };

  // 요약 기능
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
      const convRef = doc(db, 'characters', characterId as string, 'conversations', conversationId);
      await setDoc(convRef, { createdAt: serverTimestamp() }, { merge: true }); 
      
      const msgRef = collection(convRef, 'messages');
      await addDoc(msgRef, { role: 'user', content: userInput, createdAt: serverTimestamp() });

      const summaryContext = summary ? `\n[기억된 대화 요약]\n${summary}\n` : "";
      const fullSystemInstruction = `
        [Character] ${character.characterPersona}
        [User] ${userProfile.name} (${userProfile.userPersona})
        ${summaryContext}
        [Style] ${character.stylePrompt}
      `.trim();
      
      const historyForAI = messages.slice(-40).map(msg => ({ role: msg.role, content: msg.content }));
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
        <div className="flex items-center min-w-0 flex-1 mr-2">
            <Link href="/" className="mr-3 flex-shrink-0"><svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg></Link>
            <div className="flex flex-col min-w-0">
                <div className="text-xs text-sky-500 font-bold mb-0.5">{character?.name}</div>
                {isEditingTitle ? (
                    <input 
                        type="text" 
                        value={chatTitle} 
                        onChange={(e) => setChatTitle(e.target.value)}
                        className="text-sm font-bold text-gray-900 border-b border-sky-500 focus:outline-none bg-transparent w-full"
                        autoFocus
                        onBlur={handleSaveTitle} 
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                    />
                ) : (
                    <div onClick={() => setIsEditingTitle(true)} className="text-sm font-bold text-gray-900 truncate cursor-pointer flex items-center">
                        {chatTitle} 
                        <svg className="w-3 h-3 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </div>
                )}
            </div>
        </div>
        <div className='flex items-center space-x-1 flex-shrink-0'>
            <button onClick={() => setIsSummaryOpen(!isSummaryOpen)} className={`p-2 rounded-full text-xs font-semibold ${summary ? 'text-sky-600 bg-sky-50' : 'text-gray-500'}`}>📝요약</button>
            <Link href={`/character/${characterId}/conversations`} className="p-2 text-gray-500 text-xs font-semibold">목록</Link>
            <button onClick={handleNewChat} className="p-2 text-sky-500 text-xs font-semibold">새 대화</button>
        </div>
      </div>

      {/* 요약 패널 */}
      {isSummaryOpen && (
          <div className="bg-gray-50 border-b p-4 shadow-inner">
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="w-full p-3 border rounded-md h-24 text-sm" placeholder="AI 요약 결과..." />
              <div className="flex justify-end space-x-2 mt-2">
                  <button onClick={handleAiSummarize} disabled={isSummarizing} className="px-3 py-1 bg-white border rounded text-sm">🤖 자동 요약</button>
                  <button onClick={handleSaveSummary} className="px-3 py-1 bg-sky-600 text-white rounded text-sm font-bold">저장</button>
              </div>
          </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto">
        {/* ⭐⭐⭐ 여기가 핵심 수정 사항입니다: (m.createdAt && m.createdAt.seconds > 0) */}
        {messages.filter(m => m.role !== 'model' || (m.createdAt && m.createdAt.seconds > 0)).length === 0 && (
            <div className="p-10 text-center border-b border-gray-100">
                <div className="mt-6 text-sky-500 text-sm">대화를 시작해보세요!</div>
            </div>
        )}

        {messages.map((msg) => {
          // 튕김 방지 이중 체크: createdAt이 없으면 아예 그리지 않음
          if (msg.role === 'model' && (!msg.createdAt || !msg.createdAt.seconds)) return null; 

          const isModel = msg.role === 'model';
          return (
            <div key={msg.id} className="flex px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
              <img src={isModel ? character?.avatarUrl : userProfile?.avatarUrl} className="w-10 h-10 rounded-full object-cover mr-3"/>
              <div className="flex-1">
                <div className="flex items-center mb-0.5">
                    <span className="font-bold text-gray-900 mr-1.5">{isModel ? character?.name : userProfile?.name}</span>
                    {/* 아이디 표시 */}
                    <span className="text-gray-500 text-sm">{isModel ? `@ai_bot` : `@${userProfile?.userId || 'user'}`}</span>
                </div>
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