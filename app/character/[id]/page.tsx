'use client';

import React, { useState, useEffect, useCallback, useRef, use } from 'react';
// Next.js 라우팅을 위해 useSearchParams와 usePathname을 가져옵니다.
import { useSearchParams, useRouter, usePathname } from 'next/navigation'; 
import { db } from '@/firebase/clientApp';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
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

// ⭐ UUID 생성 함수 (새로운 대화방 ID를 위해 사용)
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  
  // ⭐ use 훅을 사용하여 Promise인 params를 풀어서 실제 값을 얻습니다.
  const { id } = use(params); 
  const characterId = id; // 이제 characterId는 안전한 string 값입니다.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // ⭐ URL에서 conversationId를 읽어옵니다.
  const initialConversationId = searchParams.get('conversationId');

  const [conversationId, setConversationId] = useState(initialConversationId || '');
  const [character, setCharacter] = useState<CharacterSettings | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 0. 대화방 ID 관리 및 리디렉션
  useEffect(() => {
    // conversationId가 없으면 새로 생성하여 리디렉션합니다.
    if (!initialConversationId && !conversationId) {
      const newId = generateUUID();
      // 현재 URL에 새로운 conversationId를 쿼리 파라미터로 추가하여 리디렉션
      router.replace(`${pathname}?conversationId=${newId}`);
      setConversationId(newId);
    } else if (initialConversationId && !conversationId) {
      // URL에는 있지만, 아직 상태에 설정되지 않은 경우 설정
      setConversationId(initialConversationId);
    }
  }, [initialConversationId, conversationId, pathname, router]);

  // 1. 유저 & 캐릭터 정보 불러오기
  useEffect(() => {
    if (!characterId) return;
    
    // 이 부분은 conversationId에 의존하지 않고 캐릭터와 유저 정보만 로드합니다.
    async function fetchData() {
      try {
        const docRef = doc(db, 'characters', characterId as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCharacter(docSnap.data() as CharacterSettings);
        } else {
          console.error("캐릭터를 찾을 수 없습니다.");
        }
        
        const profile = await getUserProfile();
        setUserProfile(profile);

      } catch (error) {
        console.error("로딩 실패:", error);
      } finally {
        // 이 로딩 상태는 캐릭터/유저 데이터가 로드된 시점에 종료됩니다.
        // 메시지 로딩은 conversationId가 설정된 후 시작됩니다.
      }
    }
    fetchData();
  }, [characterId]);

  // 2. 실시간 대화 내역 불러오기 (onSnapshot)
  useEffect(() => {
    // ⭐ conversationId가 확실히 있어야 메시지 로드를 시작합니다.
    if (!characterId || !conversationId || !character) {
      setLoading(true); // ID가 없으면 로딩 상태 유지
      return;
    }
    setLoading(false); // ID가 있으면 로딩 해제

    // ⭐ 경로가 conversations/{conversationId}로 변경되었습니다.
    const messageCollectionRef = collection(db, 'characters', characterId as string, 'conversations', conversationId, 'messages');
    
    const q = query(
      messageCollectionRef, 
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));

      if (msgs.length === 0 && character) {
          // 대화가 없을 때만 AI의 첫 인사 메시지 추가
          msgs.push({
              role: 'model',
              content: `${character.name} (이)가 무대에 등장했어요! 새로운 대화를 시작해보세요.`,
              createdAt: { seconds: 0 }
          });
      }
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [characterId, conversationId, character]); // conversationId와 character에 의존성 추가

  // 스크롤 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. 메시지 전송 및 저장
  const handleSend = useCallback(async () => {
    if (!input.trim() || !character || !userProfile || isSending || !conversationId) return; // conversationId 확인 추가

    setIsSending(true);
    const userInput = input;
    setInput('');

    try {
      // ⭐ 메시지 컬렉션 경로 재설정
      const messageCollectionRef = collection(db, 'characters', characterId as string, 'conversations', conversationId, 'messages');

      // (1) 내 메시지를 DB에 저장
      await addDoc(messageCollectionRef, {
        role: 'user',
        content: userInput,
        createdAt: serverTimestamp()
      });

      // (2) 시스템 프롬프트 구성 (이전과 동일)
      const fullSystemInstruction = `
        [Character Persona] ${character.characterPersona || character.systemPrompt || ''}
        [User Persona] 유저의 이름은 ${userProfile.name}이며, 설정은 다음과 같다: ${userProfile.userPersona || '별다른 설정 없음.'}
        [Output Style] ${character.stylePrompt || '자연스러운 구어체를 사용해.'}
        
        위 설정을 완벽하게 지켜서 연기해.
      `.trim();
      
      // (3) AI에게 보낼 대화 기록 구성 (이전과 동일)
      const historyForAI = messages.slice(-20).map(msg => ({ 
        role: msg.role, 
        content: msg.content 
      }));
      historyForAI.push({ role: 'user', content: userInput });

      // (4) API 호출 (이전과 동일)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterSettings: {
            ...character,
            systemPrompt: fullSystemInstruction
          },
          messages: historyForAI, 
        }),
      });

      const data = await response.json();
      
      // (5) AI 응답을 DB에 저장
      if (response.ok && data.content) {
        await addDoc(messageCollectionRef, { // ⭐ 메시지 컬렉션 경로 재설정
          role: 'model',
          content: data.content,
          createdAt: serverTimestamp()
        });
      }

    } catch (error) {
      console.error("전송 실패:", error);
    } finally {
      setIsSending(false);
    }
  }, [input, character, userProfile, messages, characterId, isSending, conversationId]); // 의존성 배열에 conversationId 추가

  // ⭐ 새로운 대화방 시작 함수
  const handleNewChat = () => {
    // 현재 캐릭터 ID로 새로운 conversationId를 생성하여 리디렉션 (기존 쿼리 파라미터를 제거)
    router.push(`${pathname}`); 
  }

  if (loading || !conversationId || !character) return <div className="flex h-screen items-center justify-center text-sky-600">무대 준비 중...</div>;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white border-x border-gray-100">
      
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-sm z-10">
        <div className="flex items-center">
          <Link href="/" className="mr-4 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition">
            <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </Link>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{character?.name}</h2>
            <p className="text-xs text-gray-500">대화방 ID: {conversationId.slice(0, 8)}...</p> 
          </div>
        </div>

        {/* ⭐ 1. 대화 기록 목록 버튼 추가 */}
            <Link 
                href={`/character/${characterId}/conversations`} // 새 페이지로 이동
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-full hover:bg-gray-50 text-sm font-semibold"
                title="이 캐릭터와의 모든 대화 기록 보기"
            >
                기록
            </Link>

        <div className='flex items-center space-x-2'>
            {/* ⭐ 새 대화방 버튼 */}
            <button
                onClick={handleNewChat}
                className="p-2 text-sky-500 hover:text-sky-700 transition rounded-full hover:bg-sky-50 text-sm font-semibold"
                title="새로운 대화 시작"
            >
                새 대화
            </button>
            
            {/* 설정 버튼 */}
            <Link href={`/character/${characterId}/edit`} className="p-2 text-gray-400 hover:text-sky-500 transition rounded-full hover:bg-sky-50">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </Link>
        </div>
      </div>

      {/* 대화 영역 (댓글 스타일) */}
      <div className="flex-1 overflow-y-auto">
        
        {/* 캐릭터 소개 (첫 화면 - 대화가 없을 때만 표시) */}
        {messages.filter(m => m.role !== 'model' || m.createdAt.seconds > 0).length === 0 && (
            <div className="p-10 text-center border-b border-gray-100">
                <h3 className="font-bold text-xl text-gray-900">{character?.name}</h3>
                <p className="text-gray-500 text-sm mt-2 whitespace-pre-wrap">설정: {character?.characterPersona?.slice(0, 50)}...</p>
                <div className="mt-6 text-sky-500 text-sm">대화를 시작해보세요!</div>
                <Link href="/profile" className="text-xs text-gray-400 mt-2 block underline">나의 프로필을 설정하고 오면 더 좋아!</Link>
            </div>
        )}

        {messages.map((msg) => {
          // 필터링된 메시지 (임시로 추가된 메시지는 건너뜁니다.)
          if (msg.role === 'model' && msg.createdAt.seconds === 0) return null; 

          const isModel = msg.role === 'model';
          const name = isModel ? character?.name : userProfile?.name;
          const avatar = isModel ? character?.avatarUrl : userProfile?.avatarUrl;
          
          return (
            <div key={msg.id} className="flex px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
              {/* 프로필 사진 */}
              <div className="flex-shrink-0 mr-3">
                <img 
                  src={avatar || 'https://via.placeholder.com/150'} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full object-cover"
                />
              </div>
              
              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center mb-0.5">
                  <span className="font-bold text-gray-900 mr-1.5">
                    {name}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {isModel ? `@ai_bot` : `@${name?.toLowerCase().replace(/\s/g, '_') || 'me'}`}
                  </span>
                </div>
                <div className="text-gray-900 text-[15px] leading-normal whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* 로딩 인디케이터 */}
        {isSending && (
          <div className="flex px-4 py-3 border-b border-gray-100 opacity-50">
             <div className="flex-shrink-0 mr-3">
                <img src={character?.avatarUrl} className="w-10 h-10 rounded-full" />
             </div>
             <div className="flex-1">
                <span className="font-bold text-gray-900">{character?.name}</span>
                <div className="text-sky-500 text-sm mt-1 animate-pulse">작성 중...</div>
             </div>
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
            disabled={isSending || loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending || loading}
            className={`ml-2 mb-1 px-4 py-1.5 rounded-full font-bold text-sm transition-colors ${
              input.trim() && !isSending && !loading
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