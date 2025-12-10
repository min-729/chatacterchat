// app/character/[id]/edit/page.tsx 파일의 상단 import 수정
// Storage 관련 import는 모두 삭제됩니다.
'use client';

// ⭐ 이 한 줄에 필요한 모든 기능이 정확히 들어 있어야 합니다.
import React, { useState, useEffect, use } from 'react'; 
import { useRouter } from 'next/navigation'; // useRouter는 여기서 가져옵니다.
import { doc, getDoc, updateDoc } from 'firebase/firestore'; 
import { db } from '@/firebase/clientApp'; 
// import { ref, uploadBytes, getDownloadURL, storage } from 'firebase/storage'; // 삭제

interface CharacterSettings {
  name: string;
  avatarUrl: string;
  characterPersona: string;
  userPersona: string;
  stylePrompt: string;
  systemPrompt?: string; 
}
// ... (생략)

export default function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const characterId = id;
  const router = useRouter();

  // 입력 필드 상태 관리
  const [name, setName] = useState('');
  const [characterPersona, setCharacterPersona] = useState('');
  const [userPersona, setUserPersona] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  
  // ⭐ URL 입력 상태로 복귀
  const [inputAvatarUrl, setInputAvatarUrl] = useState(''); 
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1. 기존 데이터 불러오기 (초기 세팅)
  useEffect(() => {
    async function fetchData() {
      if (!characterId) return;
      try {
        const docRef = doc(db, 'characters', characterId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as CharacterSettings;
          setName(data.name);
          setCharacterPersona(data.characterPersona || (data as any).systemPrompt || '');
          setUserPersona(data.userPersona || '');
          setStylePrompt(data.stylePrompt || '');
          // ⭐ 기존 URL을 불러와 입력 필드에 표시
          setInputAvatarUrl(data.avatarUrl); 
        } else {
          alert("캐릭터를 찾을 수 없어.");
          router.push('/');
        }
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [characterId, router]);

  // ⭐ 이미지 업로드/파일 변경 함수는 모두 삭제됩니다.

  // 4. 수정 내용 저장 (Update)
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      // Firestore 문서 업데이트 (updateDoc 사용)
      const docRef = doc(db, 'characters', characterId as string);
      await updateDoc(docRef, {
        name,
        characterPersona,
        userPersona,
        stylePrompt,
        // ⭐ 입력받은 URL로 바로 업데이트
        avatarUrl: inputAvatarUrl, 
      });

      console.log("수정 완료");
      router.push(`/character/${characterId}`); // 채팅방으로 복귀

    } catch (error) {
      console.error("수정 실패:", error);
      alert("수정 중에 문제가 생겼어. 콘솔을 확인해 줘.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-sky-600">데이터 불러오는 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 flex justify-center">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        <div className="bg-sky-600 p-6 text-center relative">
          <button 
            onClick={() => router.back()}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/80 hover:text-white"
          >
            ← 취소
          </button>
          <h1 className="text-xl font-bold text-white">캐릭터 설정 수정</h1>
        </div>
        
        <form onSubmit={handleUpdate} className="p-8 space-y-6">
          
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
              disabled={saving}
            />
            <p className="text-xs text-gray-400 mt-1">외부 이미지 링크를 사용하세요.</p>
          </div>

          {/* 이름 */}
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">이름</label>
            <input 
              type="text"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={saving}
            />
          </div>

          {/* 나머지 필드는 이전과 동일 */}
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">캐릭터 성격 & 배경</label>
            <textarea
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl h-28 resize-none focus:ring-2 focus:ring-sky-500 outline-none"
              value={characterPersona}
              onChange={(e) => setCharacterPersona(e.target.value)}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">유저 설정 & 상황</label>
            <textarea
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl h-24 resize-none focus:ring-2 focus:ring-sky-500 outline-none"
              value={userPersona}
              onChange={(e) => setUserPersona(e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">말투 & 출력 형식</label>
            <textarea
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl h-24 resize-none focus:ring-2 focus:ring-sky-500 outline-none"
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              disabled={saving}
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-sky-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-sky-700 transition shadow-lg disabled:opacity-50"
            disabled={saving}
          >
            {saving ? '수정 사항 저장 중...' : '수정 완료'}
          </button>
        </form>
      </div>
    </div>
  );
}