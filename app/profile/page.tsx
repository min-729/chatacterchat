'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Firebase Storage 관련 import는 모두 제거되었습니다.
import { getUserProfile, saveUserProfile, UserProfile } from '@/firebase/userProfile';

export default function UserProfilePage() {
    const router = useRouter();
    const [name, setName] = useState('');
    // ⭐ URL 입력 상태로 변경
    const [inputAvatarUrl, setInputAvatarUrl] = useState(''); 
    // ⭐ User Persona 상태 추가
    const [userPersona, setUserPersona] = useState(''); 
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 1. 기존 유저 데이터 불러오기
    useEffect(() => {
        async function fetchData() {
            try {
                const profile = await getUserProfile();
                setName(profile.name);
                setInputAvatarUrl(profile.avatarUrl); 
                setUserPersona(profile.userPersona); // ⭐ 유저 설정 불러오기
            } catch (error) {
                console.error("유저 프로필 로딩 실패:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    // 2. 프로필 업데이트 (Update)
    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);

        try {
            const updatedProfile: UserProfile = {
                name,
                // ⭐ URL을 바로 사용
                avatarUrl: inputAvatarUrl || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png',
                userPersona, // ⭐ 유저 설정 저장
            };

            await saveUserProfile(updatedProfile);

            console.log("유저 프로필 저장 완료");
            router.push('/'); // 홈 화면으로 복귀

        } catch (error) {
            console.error("저장 실패:", error);
            alert("저장 중에 문제가 생겼어.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center text-sky-600">로딩 중...</div>;

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 flex justify-center">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                
                <div className="bg-sky-500 p-6 text-center">
                    <h1 className="text-2xl font-bold text-white">👤 나의 프로필 설정</h1>
                    <p className="text-sky-100 text-sm mt-1">캐릭터들에게 보여줄 나의 모습</p>
                </div>
                
                <form onSubmit={handleUpdate} className="p-8 space-y-6">
                    
                    {/* 프로필 사진 URL */}
                    <div className="flex flex-col items-center">
                        <img 
                            src={inputAvatarUrl || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png'} 
                            alt="Profile Avatar" 
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
                        <label className="block text-gray-700 font-bold mb-2 text-sm">나의 이름 (캐릭터 대화 시 표시)</label>
                        <input 
                            type="text"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="예: 미즈키"
                            required
                            disabled={saving}
                        />
                    </div>
                    
                    {/* 유저 설정 (User Persona) */}
                    <div>
                        <label className="block text-gray-700 font-bold mb-2 text-sm">나의 배경 설정 (User Persona)</label>
                        <textarea
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl h-24 resize-none focus:ring-2 focus:ring-sky-500 outline-none"
                            value={userPersona}
                            onChange={(e) => setUserPersona(e.target.value)}
                            placeholder="예: 나는 루이의 오랜 친구이며, 그의 기상천외한 발명품에 익숙하다."
                            disabled={saving}
                        />
                        <p className="text-xs text-gray-400 mt-1">이 설정은 모든 캐릭터와의 대화에 기본적으로 적용됩니다.</p>
                    </div>

                    <button 
                        type="submit"
                        className="w-full bg-sky-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-sky-600 transition shadow-lg disabled:opacity-50"
                        disabled={saving}
                    >
                        {saving ? '저장 중...' : '프로필 저장하기'}
                    </button>
                </form>
            </div>
        </div>
    );
}