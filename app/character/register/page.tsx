'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { db } from '@/firebase/clientApp'; 
// Storage 관련 import는 여기서 모두 제거됩니다.

// 데이터 구조 확장
interface CharacterSettings {
  name: string;
  avatarUrl: string; // URL을 직접 받습니다.
  characterPersona: string; 
  userPersona: string;      
  stylePrompt: string;      
}

export default function CharacterRegistrationPage() {
  const [characterName, setCharacterName] = useState('');
  const [characterPersona, setCharacterPersona] = useState('');
  const [userPersona, setUserPersona] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  
  // ⭐ URL 입력 상태로 변경
  const [inputAvatarUrl, setInputAvatarUrl] = useState(''); 
  
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; 
    setLoading(true);

    try {
      // 1. 문서 ID를 미리 생성
      const newDocRef = doc(collection(db, 'characters'));
      const characterId = newDocRef.id;

      // 2. 최종 데이터 저장
      const finalData = {
          name: characterName,
          characterPersona,
          userPersona,
          stylePrompt,
          // ⭐ URL을 바로 사용
          avatarUrl: inputAvatarUrl || 'https://via.placeholder.com/150/007AFF/FFFFFF?text=AI', 
          createdAt: serverTimestamp() 
      };

      await setDoc(newDocRef, finalData); 

      console.log("저장 완료:", characterId);
      
      router.push(`/character/${characterId}`);

    } catch (e) {
      console.error("데이터 저장 오류:", e);
      alert("저장에 실패했어. 콘솔을 확인해 줘.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 flex justify-center">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        <div className="bg-sky-500 p-6 text-center">
          <h1 className="text-2xl font-bold text-white">🎀 캐릭터 메이커</h1>
          <p className="text-sky-100 text-sm mt-1">우리만의 이야기를 만들어볼까?</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* ⭐ 프로필 사진 URL 입력 및 미리보기 */}
          <div className="flex flex-col items-center">
             <img 
                src={inputAvatarUrl || 'https://via.placeholder.com/150/007AFF/FFFFFF?text=AI'} 
                alt="Preview" 
                className="w-32 h-32 rounded-full object-cover border-4 border-sky-100 shadow-sm mb-3" 
            />
            <label className="block text-gray-700 font-bold mb-2 text-sm">프로필 이미지 URL</label>
            <input 
              type="url"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none"
              value={inputAvatarUrl}
              onChange={(e) => setInputAvatarUrl(e.target.value)}
              placeholder="예: https://i.imgur.com/your_image.jpg"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-1">픽사베이 등 외부 이미지 링크를 사용하세요.</p>
          </div>

          {/* 1. 이름 */}
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">이름</label>
            <input 
              type="text"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="예: 카미시로 루이"
              required
              disabled={loading}
            />
          </div>

          {/* 2. 캐릭터 성격 */}
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">캐릭터 성격 & 배경</label>
            <textarea
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl h-28 resize-none focus:ring-2 focus:ring-sky-500 outline-none"
              value={characterPersona}
              onChange={(e) => setCharacterPersona(e.target.value)}
              placeholder="예: 원더랜즈×쇼타임의 연출가. 기상천외한 발상을 좋아하고 항상 여유로운 태도를 보임."
              required
              disabled={loading}
            />
          </div>

          {/* 3. 유저 설정 */}
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">유저 설정 & 현재 상황</label>
            <textarea
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl h-24 resize-none focus:ring-2 focus:ring-sky-500 outline-none"
              value={userPersona}
              onChange={(e) => setUserPersona(e.target.value)}
              placeholder="예: 유저는 '아키야마 미즈키'. 학교 옥상에서 수업을 땡땡이치고 있는 상황."
              disabled={loading}
            />
          </div>

          {/* 4. 출력 스타일 */}
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">말투 & 출력 형식</label>
            <textarea
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl h-24 resize-none focus:ring-2 focus:ring-sky-500 outline-none"
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              placeholder="예: 행동은 (괄호) 안에 묘사할 것. 대사는 따옴표 없이 작성. 3문장 이내로 짧게."
              disabled={loading}
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-sky-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-sky-600 transition shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? '데이터 저장 중...' : '캐릭터 생성하기'}
          </button>
        </form>
      </div>
    </div>
  );
}