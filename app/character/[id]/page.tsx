'use client';

import React, { useState, useEffect, useCallback, useRef, use } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { db } from '@/firebase/clientApp';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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

  // ⭐ 요약 관련 상태 추가
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

  // 1. 기본 정보 및 저장된 요약 불러오기
  useEffect(() => {
    if (!characterId || !conversationId) return;
    
    async function fetchData() {
      try {
        // 캐릭터 정보
        const charDoc = await getDoc(doc(db, 'characters', characterId as string));
        if (charDoc.exists()) setCharacter(charDoc.data() as CharacterSettings);
        
        // 유저 프로필
        const profile = await getUserProfile();
        setUserProfile(profile);

        // ⭐ 저장된 대화 요약 불러오기
        const convDocRef = doc(db, 'characters', characterId as string, 'conversations', conversationId);
        const convDoc = await getDoc(convDocRef);
        if (convDoc.exists() && convDoc.data().currentSummary) {
            setSummary(convDoc.data().currentSummary);
        }

      } catch (error) {
        console.error("로딩 실패:", error);
      }
    }
    fetchData();
  }, [characterId, conversationId]);

  // 2. 실시간 대화 내역 불러오기
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

  // ⭐ [수정] 스크롤 튕김 방지 적용
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // ⭐ AI 자동 요약 요청 함수
  const handleAiSummarize = async () => {
    if (messages.length < 5 || !character || !userProfile) {
        alert("요약할 대화 내용이 충분하지 않습니다.");
        return;
    }
    setIsSummarizing(true);
    try {
        const response = await fetch('/api/summarize', {
            method: 'POST',
            body: JSON.stringify({
                messages: messages.slice(1), // 첫 인사는 제외
                characterName: character.name,
                userName: userProfile.name
            })
        });
        const data = await response.json();
        if (data.summary) {
            setSummary(data.summary);
        }
    } catch (e) {
        console.error("요약 실패", e);
        alert("요약에 실패했습니다.");
    } finally {
        setIsSummarizing(false);
    }
  };

  // ⭐ 요약 저장 함수
  const handleSaveSummary = async () => {
    if (!conversationId) return;
    try {
        const convDocRef = doc(db, 'characters', characterId as string, 'conversations', conversationId);
        // 요약 내용 업데이트 (병합)
        await setDoc(convDocRef, { currentSummary: summary }, { merge: true });
        alert("요약이 저장되었습니다. 다음 대화부터 적용됩니다.");
        setIsSummaryOpen(false); // 창 닫기
    } catch (e) {
        console.error("요약 저장 실패", e);
        alert("요약 저장에 실패했습니다.");
    }
  };

  // 3. 메시지 전송
  const handleSend = useCallback(async () => {
    if (!input.trim() || !character || !userProfile || isSending || !conversationId) return;

    setIsSending(true);
    const userInput = input;
    setInput('');

    try {
      const conversationDocRef = doc(db, 'characters', characterId as string, 'conversations', conversationId);
      // 대화방 정보 업데이트 (없으면 생성)
      await setDoc(conversationDocRef, { createdAt: serverTimestamp() }, { merge: true }); 
      const messageCollectionRef = collection(conversationDocRef, 'messages');

      await addDoc(messageCollectionRef, { role: 'user', content: userInput, createdAt: serverTimestamp() });

      // ⭐ 시스템 프롬프트에 '이전 대화 요약' 추가
      let summaryContext = "";
      if (summary) {
          summaryContext = `\n[Previous Conversation Summary]\n이전 대화의 요약입니다. 이 내용을 기억하고 대화를 이어나가세요:\n${summary}\n`;
      }

      const fullSystemInstruction = `
        [Character Persona] ${character.characterPersona || character.systemPrompt || ''}
        [User Persona] 유저의 이름은 ${userProfile.name}이며, 설정은 다음과 같다: ${userProfile.userPersona || '별다른 설정 없음.'}
        ${summaryContext}
        [Output Style] ${character.stylePrompt || '자연스러운 구어체를 사용해.'}
        위 설정을 완벽하게 지켜서 연기해.
      `.trim();
      
      // ⭐ 요약이 있으면 최근 메시지 개수를 줄여서 보냄 (비용 절약)
      const recentMessagesCount = summary ? -20 : -40; 
      const historyForAI = messages.slice(recentMessagesCount).map(msg => ({ 
        role: msg.role, 
        content: msg.content 
      }));
      historyForAI.push({ role: 'user', content: userInput });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterSettings: { ...character, systemPrompt: fullSystemInstruction },
          messages: historyForAI, 
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.content) {
        await addDoc(messageCollectionRef, { role: 'model', content: data.content, createdAt: serverTimestamp() });
      }

    } catch (error) {
      console.error("전송 실패:", error);
    } finally {
      setIsSending(false);
    }
  }, [input, character, userProfile, messages, characterId, isSending, conversationId, summary]); // summary 의존성 추가

  // ... (handleNewChat 등 나머지 함수는 동일)
  const handleNewChat = () => { router.push(`${pathname}`); }

  if (loading || !conversationId || !character) return <div className="flex h-screen items-center justify-center text-sky-600">무대 준비 중...</div>;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white border-x border-gray-100 relative">
      
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-sm z-10">
        <div className="flex items-center">
          <Link href="/" className="mr-4 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition">
            <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </Link>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{character?.name}</h2>
          </div>
        </div>

        <div className='flex items-center space-x-2'>
            {/* ⭐ 요약 관리 버튼 추가 */}
            <button
                onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                className={`p-2 transition rounded-full text-sm font-semibold flex items-center ${summary ? 'text-sky-600 bg-sky-50' : 'text-gray-500 hover:bg-gray-50'}`}
                title="대화 요약 관리"
            >
                📝 요약 {summary && 'ON'}
            </button>
            <Link href={`/character/${characterId}/conversations`} className="p-2 text-gray-500 hover:text-gray-700 transition rounded-full hover:bg-gray-50 text-sm font-semibold">기록</Link>
            <button onClick={handleNewChat} className="p-2 text-sky-500 hover:text-sky-700 transition rounded-full hover:bg-sky-50 text-sm font-semibold">새 대화</button>
            <Link href={`/character/${characterId}/edit`} className="p-2 text-gray-400 hover:text-sky-500 transition rounded-full hover:bg-sky-50">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </Link>
        </div>
      </div>

      {/* ⭐ 요약 관리 패널 (헤더 아래에 열림) */}
      {isSummaryOpen && (
          <div className="bg-gray-50 border-b border-gray-200 p-4 shadow-inner">
              <h3 className="font-bold text-gray-800 mb-2">대화 기억(요약) 관리</h3>
              <p className="text-sm text-gray-600 mb-3">긴 대화의 핵심을 요약하여 AI가 기억하게 합니다. 직접 수정할 수도 있습니다.</p>
              
              <textarea 
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 outline-none resize-none h-32 text-sm"
                  placeholder="아직 요약된 내용이 없습니다. 'AI 자동 요약'을 눌러보세요."
              />
              
              <div className="flex justify-end space-x-3 mt-3">
                  <button 
                      onClick={handleAiSummarize}
                      disabled={isSummarizing || messages.length < 5}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 text-sm transition disabled:opacity-50"
                  >
                      {isSummarizing ? '요약 생성 중...' : 'AI 자동 요약'}
                  </button>
                  <button 
                      onClick={handleSaveSummary}
                      className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-bold transition"
                  >
                      요약 저장 및 적용
                  </button>
              </div>
          </div>
      )}

      {/* 대화 영역 */}
      <div className="flex-1 overflow-y-auto">
        {/* (기존 메시지 표시 로직 동일) */}
        {messages.filter(m => m.role !== 'model' || m.createdAt.seconds > 0).length === 0 && (
            <div className="p-10 text-center border-b border-gray-100">
                {/* ... */}
                <div className="mt-6 text-sky-500 text-sm">대화를 시작해보세요!</div>
            </div>
        )}
        {messages.map((msg) => {
          if (msg.role === 'model' && msg.createdAt.seconds === 0) return null; 
          const isModel = msg.role === 'model';
          const name = isModel ? character?.name : userProfile?.name;
          const avatar = isModel ? character?.avatarUrl : userProfile?.avatarUrl;
          
          return (
            <div key={msg.id} className="flex px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
              <div className="flex-shrink-0 mr-3">
                <img src={avatar} alt="Profile" className="w-10 h-10 rounded-full object-cover"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center mb-0.5">
                  <span className="font-bold text-gray-900 mr-1.5">{name}</span>
                  <span className="text-gray-500 text-sm">{isModel ? `@ai_bot` : `@user`}</span>
                </div>
                <div className="text-gray-900 text-[15px] leading-normal whitespace-pre-wrap break-words">{msg.content}</div>
              </div>
            </div>
          );
        })}
        {isSending && (
            // (로딩 인디케이터 동일)
          <div className="flex px-4 py-3 border-b border-gray-100 opacity-50">
             <div className="flex-shrink-0 mr-3"><img src={character?.avatarUrl} className="w-10 h-10 rounded-full" /></div>
             <div className="flex-1"><span className="font-bold text-gray-900">{character?.name}</span><div className="text-sky-500 text-sm mt-1 animate-pulse">작성 중...</div></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="p-3 bg-white border-t border-gray-100 sticky bottom-0">
        <div className="flex items-end bg-gray-100 rounded-2xl px-4 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-500 resize-none py-2 max-h-32"
            placeholder={`@${userProfile?.name || '나'}로 답글 게시하기`}
            rows={1}
            style={{ minHeight: '24px' }}
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className={`ml-2 mb-1 px-4 py-1.5 rounded-full font-bold text-sm transition-colors ${
              input.trim() && !isSending
                ? 'bg-sky-500 text-white hover:bg-sky-600'
                : 'bg-sky-200 text-white cursor-not-allowed'
            }`}
          >
            게시
          </button>
        </div>
      </div>
    </div>
  );
}