'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/clientApp';

// 캐릭터 데이터 타입 정의
interface Character {
  id: string;
  name: string;
  avatarUrl: string;
}

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Firebase에서 캐릭터 목록 불러오기
  useEffect(() => {
    async function fetchCharacters() {
      try {
        const querySnapshot = await getDocs(collection(db, 'characters'));
        const characterList: Character[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          characterList.push({
            id: doc.id,
            name: data.name,
            avatarUrl: data.avatarUrl || 'https://via.placeholder.com/150',
          });
        });

        setCharacters(characterList);
      } catch (error) {
        console.error("캐릭터 목록을 불러오는 중 오류가 발생했어:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCharacters();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      
      {/* 타이틀 영역 */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-10 mt-4">
        <h1 className="text-3xl font-bold text-indigo-700">🎭 나의 AI 캐릭터</h1>
        <Link 
          href="/character/register" 
          className="bg-indigo-600 text-white px-5 py-2 rounded-full font-bold hover:bg-indigo-700 transition shadow-md"
        >
          + 새 캐릭터 등록
        </Link>
      </header>

      {/* 로딩 중일 때 */}
      {loading && (
        <p className="text-xl text-gray-500 mt-10">대기실 명단 확인 중...</p>
      )}

      {/* 캐릭터 목록 영역 */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
          
          {/* 캐릭터가 하나도 없을 때 */}
          {characters.length === 0 && (
            <div className="col-span-full text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
              <p className="text-gray-500 text-lg mb-4">아직 등록된 캐릭터가 없네.</p>
              <p className="text-indigo-500">새로운 배우를 무대에 올려볼까?</p>
            </div>
          )}

          {/* 캐릭터 카드 리스트 */}
          {characters.map((char) => (
            <Link 
              key={char.id} 
              href={`/character/${char.id}`}
              className="bg-white p-5 rounded-xl shadow-md hover:shadow-xl transition transform hover:-translate-y-1 border border-gray-100 flex flex-col items-center cursor-pointer"
            >
              <img 
                src={char.avatarUrl} 
                alt={char.name} 
                className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100 mb-4"
              />
              <h2 className="text-xl font-bold text-gray-800">{char.name}</h2>
              <span className="text-sm text-indigo-500 mt-2 font-medium">대화하기 →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}