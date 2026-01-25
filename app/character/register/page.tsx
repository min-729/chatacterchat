'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/firebase/clientApp';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function RegisterCharacterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [characterPersona, setCharacterPersona] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      await addDoc(collection(db, 'characters'), {
        name,
        description,
        avatarUrl: avatarUrl || 'https://via.placeholder.com/150',
        characterPersona,
        stylePrompt,
        createdAt: serverTimestamp(),
      });
      alert('캐릭터가 생성되었습니다!');
      router.push('/'); 
    } catch (error) {
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 flex justify-center">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-md p-8 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">+ 새 캐릭터 만들기</h1>
        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-4">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">캐릭터 이름</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded-md" required /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">한줄 소개</label><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 border rounded-md" required /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">이미지 URL</label><input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="w-full p-2 border rounded-md" placeholder="https://..." /></div>
          </div>
          <div className="space-y-4 pt-4 border-t">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">성격 및 배경</label><textarea value={characterPersona} onChange={(e) => setCharacterPersona(e.target.value)} className="w-full p-3 border rounded-md h-32" required /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">말투 가이드</label><textarea value={stylePrompt} onChange={(e) => setStylePrompt(e.target.value)} className="w-full p-3 border rounded-md h-24" required /></div>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-md">취소</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-sky-600 text-white font-bold rounded-md hover:bg-sky-700">{loading ? '생성 중...' : '생성하기'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}