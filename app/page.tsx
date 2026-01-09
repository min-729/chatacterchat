'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/firebase/clientApp';
import { collection, getDocs } from 'firebase/firestore';
import { getUserProfile } from '@/firebase/userProfile';
import { useRouter } from 'next/navigation';

interface Character {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
}

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. 프로필 확인 (이름만 있으면 통과!)
        const profile = await getUserProfile();
        if (!profile.name) {
            router.push('/profile'); // 이름 없으면 설정 페이지로 보냄
            return;
        }

        // 2. 캐릭터 목록 가져오기
        const querySnapshot = await getDocs(collection(db, 'characters'));
        const chars = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Character));
        setCharacters(chars);
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  if (loading) return <div className="flex h-screen items-center justify-center text-sky-600">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur-sm z-10">
        <h1 className="text-xl font-bold text-gray-900">Chatacter</h1>
        <Link href="/profile" className="p-2 text-gray-400 hover:text-sky-500 transition rounded-full hover:bg-gray-50">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        </Link>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="p-6 pb-24 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">누구와 대화할까요?</h2>
        
        <div className="grid gap-4">
          {characters.map((char) => (
            <Link key={char.id} href={`/character/${char.id}`} className="block group">
              <div className="flex items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-sky-100 transition-all duration-200 transform hover:-translate-y-1">
                <img 
                  src={char.avatarUrl} 
                  alt={char.name} 
                  className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm mr-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-sky-600 transition-colors">{char.name}</h3>
                    <span className="text-xs text-sky-500 bg-sky-50 px-2 py-1 rounded-full font-bold">Chat</span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{char.description}</p>
                </div>
                <div className="ml-3 text-gray-300 group-hover:text-sky-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {characters.length === 0 && (
            <div className="text-center py-20">
                <p className="text-gray-400 mb-4">아직 등록된 캐릭터가 없어요.</p>
                <Link href="/character/register" className="inline-block px-6 py-3 bg-sky-500 text-white rounded-full font-bold hover:bg-sky-600 transition shadow-lg hover:shadow-sky-200">
                    + 캐릭터 만들기
                </Link>
            </div>
        )}
      </main>
      
      {/* 하단 플로팅 버튼 (캐릭터 추가) */}
      <div className="fixed bottom-6 right-6">
          <Link href="/character/register" className="flex items-center justify-center w-14 h-14 bg-sky-600 text-white rounded-full shadow-xl hover:bg-sky-700 hover:scale-105 transition-all duration-200">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          </Link>
      </div>
    </div>
  );
}