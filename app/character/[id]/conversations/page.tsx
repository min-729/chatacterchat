'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/firebase/clientApp';
import { doc, getDoc, collection, query, orderBy, onSnapshot, DocumentData, getDocs } from 'firebase/firestore';

// 데이터 타입 정의
interface CharacterSettings {
  name: string;
  avatarUrl: string;
}

interface Conversation {
  id: string;
  lastMessageContent: string;
  lastUpdatedAt: Date;
}

// Next.js 16 이상에서 params를 안전하게 처리
export default function ConversationListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const characterId = id;
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSettings | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. 캐릭터 정보 및 대화방 목록 불러오기
  useEffect(() => {
    if (!characterId) return;

    async function fetchData() {
      try {
        // 1-1. 캐릭터 정보 로드
        const charDocRef = doc(db, 'characters', characterId);
        const charSnap = await getDoc(charDocRef);
        if (charSnap.exists()) {
          setCharacter(charSnap.data() as CharacterSettings);
        } else {
          alert("캐릭터 정보를 찾을 수 없습니다.");
          router.push('/');
          return;
        }

        // 1-2. 모든 대화방 목록 로드
        const convsCollectionRef = collection(db, 'characters', characterId, 'conversations');
        const convsSnapshot = await getDocs(convsCollectionRef);
        
        const loadedConversations: Conversation[] = [];

        // 각 대화방별로 마지막 메시지 내용을 찾아야 합니다.
        for (const docSnapshot of convsSnapshot.docs) {
          const conversationId = docSnapshot.id;
          
          // 해당 대화방의 메시지 컬렉션에서 가장 최근 메시지 1개만 조회
          const messagesQuery = query(
            collection(db, 'characters', characterId, 'conversations', conversationId, 'messages'),
            orderBy('createdAt', 'desc')
          );

          const messagesSnapshot = await getDocs(messagesQuery);

          let lastMessageContent = "대화 시작 전";
          let lastUpdatedAt = new Date(0); 

          if (!messagesSnapshot.empty) {
            const lastMsg = messagesSnapshot.docs[0].data() as DocumentData;
            lastMessageContent = lastMsg.content.length > 50 
                ? lastMsg.content.substring(0, 50) + '...' 
                : lastMsg.content;
            
            // Firebase Timestamp를 JavaScript Date 객체로 변환
            if (lastMsg.createdAt && lastMsg.createdAt.toDate) {
                lastUpdatedAt = lastMsg.createdAt.toDate();
            }
          }

          loadedConversations.push({
            id: conversationId,
            lastMessageContent: lastMessageContent,
            lastUpdatedAt: lastUpdatedAt,
          });
        }
        
        // 최신 업데이트 날짜 순으로 정렬
        loadedConversations.sort((a, b) => b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime());

        setConversations(loadedConversations);

      } catch (error) {
        console.error("대화 목록 로딩 실패:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [characterId, router]);

  const formatDate = (date: Date) => {
    if (date.getTime() === 0) return '새 대화';
    return date.toLocaleDateString('ko-KR', {
        year: '2-digit',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-sky-600">대화 기록을 불러오는 중...</div>;
  if (!character) return null; // 캐릭터 정보 없으면 아무것도 표시 안함

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white border-x border-gray-100">
      
      {/* 헤더 */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center sticky top-0 bg-white/90 backdrop-blur-sm z-10">
        <button onClick={() => router.back()} className="mr-4 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition">
          <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{character.name}과의 대화 기록</h1>
      </div>

      {/* 대화 목록 */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            아직 저장된 대화 기록이 없어요.
          </div>
        ) : (
          conversations.map((conv) => (
            // ⭐ 대화방 ID를 쿼리 파라미터로 넘겨줍니다.
            <Link 
              key={conv.id} 
              href={`/character/${characterId}?conversationId=${conv.id}`}
              className="flex items-center p-4 border-b border-gray-100 hover:bg-sky-50 transition-colors"
            >
              {/* 캐릭터 프로필 사진 */}
              <img 
                src={character.avatarUrl} 
                alt={character.name} 
                className="w-12 h-12 rounded-full object-cover mr-3 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                    {/* 대화방 이름 (임시로 ID 일부 사용) */}
                    <h3 className="font-semibold text-gray-900 text-base">
                        대화방 {conv.id.slice(0, 4)}...
                    </h3>
                    {/* 마지막 업데이트 시간 */}
                    <span className="text-xs text-gray-400">
                        {formatDate(conv.lastUpdatedAt)}
                    </span>
                </div>
                {/* 마지막 메시지 미리보기 */}
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {conv.lastMessageContent}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
      
      {/* 새 대화 버튼 (편의상 추가) */}
      <div className="p-4 border-t border-gray-100">
        <Link 
            href={`/character/${characterId}`} // 쿼리 파라미터 없이 이동하면 새 대화가 생성됨
            className="block w-full text-center bg-sky-500 text-white py-3 rounded-xl font-bold hover:bg-sky-600 transition"
        >
            새 대화 시작하기
        </Link>
      </div>
    </div>
  );
}