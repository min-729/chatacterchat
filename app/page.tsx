'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserProfile, saveUserProfile, UserProfile } from '@/firebase/userProfile';

export default function UserProfilePage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [inputAvatarUrl, setInputAvatarUrl] = useState(''); 
    const [userPersona, setUserPersona] = useState(''); 
    const [userId, setUserId] = useState(''); // ⭐ 아이디 상태
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const profile = await getUserProfile();
                setName(profile.name);
                setInputAvatarUrl(profile.avatarUrl); 
                setUserPersona(profile.userPersona);
                setUserId(profile.userId || ''); // ⭐ 기존 아이디 불러오기
            } catch (error) { console.error(error); } finally { setLoading(false); }
        }
        fetchData();
    }, []);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            // ⭐ 아이디 앞에 @가 없으면 자동으로 붙여주기 (선택 사항)
            const formattedId = userId.startsWith('@') ? userId.substring(1) : userId;

            // ⭐ 여기에 userId가 꼭 들어가야 에러가 해결됩니다!
            const updatedProfile: UserProfile = {
                name,
                avatarUrl: inputAvatarUrl || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png',
                userPersona,
                userId: formattedId || 'user', // 아이디 저장 (없으면 user)
            };
            await saveUserProfile(updatedProfile);
            router.push('/'); 
        } catch (error) { alert("저장 실패"); } finally { setSaving(false); }
    };

    if (loading) return <div className="flex h-screen items-center justify-center text-sky-600">로딩 중...</div>;

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 flex justify-center">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-sky-500 p-6 text-center">
                    <h1 className="text-2xl font-bold text-white">👤 나의 프로필 설정</h1>
                </div>
                
                <form onSubmit={handleUpdate} className="p-8 space-y-6">
                    {/* 이미지 URL */}
                    <div className="flex flex-col items-center">
                        <img src={inputAvatarUrl || 'https://via.placeholder.com/150'} className="w-24 h-24 rounded-full object-cover border-4 border-sky-100 mb-3" />
                        <label className="block text-gray-700 font-bold mb-1 text-sm">프로필 이미지 URL</label>
                        <input type="url" className="w-full px-4 py-2 bg-gray-50 border rounded-xl" value={inputAvatarUrl} onChange={(e) => setInputAvatarUrl(e.target.value)} placeholder="https://..." />
                    </div>

                    {/* 이름 */}
                    <div>
                        <label className="block text-gray-700 font-bold mb-1 text-sm">이름 (표시 이름)</label>
                        <input type="text" className="w-full px-4 py-2 bg-gray-50 border rounded-xl" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>

                    {/* ⭐ 아이디 입력칸 */}
                    <div>
                        <label className="block text-gray-700 font-bold mb-1 text-sm">아이디 (예: minmin)</label>
                        <div className="flex items-center">
                            <span className="text-gray-500 mr-2">@</span>
                            <input type="text" className="w-full px-4 py-2 bg-gray-50 border rounded-xl" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="your_id" />
                        </div>
                    </div>
                    
                    {/* 페르소나 */}
                    <div>
                        <label className="block text-gray-700 font-bold mb-1 text-sm">나의 설정 (User Persona)</label>
                        <textarea className="w-full px-4 py-2 bg-gray-50 border rounded-xl h-24 resize-none" value={userPersona} onChange={(e) => setUserPersona(e.target.value)} />
                    </div>

                    <button type="submit" className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold hover:bg-sky-600 transition" disabled={saving}>저장하기</button>
                </form>
            </div>
        </div>
    );
}