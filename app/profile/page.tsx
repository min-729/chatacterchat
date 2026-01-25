'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    getUserProfile, saveUserProfile, 
    getAllSavedProfiles, addToLibrary, deleteFromLibrary, UserProfile 
} from '@/firebase/userProfile';

export default function UserProfilePage() {
    const router = useRouter();
    
    // 입력 폼 상태 (현재 편집 중인 내용)
    const [name, setName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState(''); 
    const [userPersona, setUserPersona] = useState(''); 
    
    // 보관함 데이터 상태
    const [savedProfiles, setSavedProfiles] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    // 초기 로딩
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. 현재 적용 중인 프로필 불러오기
            const active = await getUserProfile();
            setName(active.name);
            setAvatarUrl(active.avatarUrl);
            setUserPersona(active.userPersona);

            // 2. 보관함에 저장된 목록 불러오기
            const list = await getAllSavedProfiles();
            setSavedProfiles(list);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // [적용] 현재 입력한 내용을 '활성 프로필'로 저장하고 홈으로 이동
    const handleApply = async () => {
        if (!name) return alert("이름은 필수입니다.");
        try {
            // saveUserProfile은 '현재 사용 중인 프로필'을 덮어씁니다.
            await saveUserProfile({ name, avatarUrl, userPersona });
            router.push('/');
        } catch (e) { alert("저장 실패"); }
    };

    // [보관함 추가] 현재 내용을 보관함에 새 항목으로 저장
    const handleAddToLibrary = async () => {
        if (!name) return alert("이름을 입력해주세요.");
        if (!confirm(`'${name}' 프로필을 보관함에 추가할까요?`)) return;
        try {
            await addToLibrary({ name, avatarUrl, userPersona });
            alert("보관함에 추가되었습니다!");
            loadData(); // 목록 새로고침
        } catch (e) { alert("추가 실패"); }
    };

    // [불러오기] 목록에서 클릭하면 입력창에 채우기
    const handleLoadProfile = (profile: UserProfile) => {
        if (!confirm(`'${profile.name}' 프로필을 불러오시겠습니까?`)) return;
        setName(profile.name);
        setAvatarUrl(profile.avatarUrl);
        setUserPersona(profile.userPersona);
    };

    // [삭제] 목록에서 삭제
    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // 부모 클릭 방지
        if (!confirm("정말 삭제하시겠습니까?")) return;
        await deleteFromLibrary(id);
        loadData();
    };

    if (loading) return <div className="flex h-screen items-center justify-center text-sky-600">로딩 중...</div>;

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4">
            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* 왼쪽: 편집기 */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-sky-500 p-4 text-center">
                        <h2 className="text-xl font-bold text-white">📝 프로필 편집</h2>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="flex flex-col items-center">
                            <img src={avatarUrl || 'https://via.placeholder.com/100'} className="w-24 h-24 rounded-full object-cover border-4 border-sky-100 mb-2 shadow-sm" />
                            <p className="text-xs text-gray-400">미리보기</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">이름</label>
                            <input type="text" className="w-full px-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition" value={name} onChange={(e) => setName(e.target.value)} placeholder="표시될 이름" />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">이미지 URL</label>
                            <input type="text" className="w-full px-4 py-2 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none transition" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">나의 설정 (페르소나)</label>
                            <textarea className="w-full px-4 py-3 bg-gray-50 border rounded-xl h-32 resize-none text-sm focus:ring-2 focus:ring-sky-500 outline-none transition" value={userPersona} onChange={(e) => setUserPersona(e.target.value)} placeholder="예: 나는 셜록홈즈의 조수 왓슨이다. 의학 지식이 풍부하다." />
                        </div>

                        <div className="flex flex-col space-y-3 pt-2">
                            <button onClick={handleApply} className="w-full py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 shadow-md transition transform hover:-translate-y-0.5">
                                ✅ 이 프로필로 시작하기
                            </button>
                            <button onClick={handleAddToLibrary} className="w-full py-3 bg-white border-2 border-sky-100 text-sky-600 font-bold rounded-xl hover:bg-sky-50 transition">
                                📥 보관함에 추가하기
                            </button>
                        </div>
                    </div>
                </div>

                {/* 오른쪽: 보관함 목록 */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-[600px]">
                    <div className="bg-gray-800 p-4 text-center">
                        <h2 className="text-xl font-bold text-white">📚 내 페르소나 보관함</h2>
                    </div>
                    
                    <div className="p-4 flex-1 overflow-y-auto bg-gray-50 space-y-3">
                        {savedProfiles.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                                <span className="text-4xl">📭</span>
                                <p>저장된 프로필이 없어요.</p>
                                <p className="text-xs">왼쪽에서 작성 후 '보관함에 추가' 해보세요!</p>
                            </div>
                        ) : (
                            savedProfiles.map((p) => (
                                <div key={p.id} onClick={() => handleLoadProfile(p)} className="group bg-white p-4 rounded-xl border border-gray-100 hover:border-sky-300 hover:shadow-md cursor-pointer transition relative">
                                    <div className="flex items-center">
                                        <img src={p.avatarUrl} className="w-12 h-12 rounded-full object-cover mr-4 border border-gray-200" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-gray-800 truncate">{p.name}</div>
                                            <div className="text-xs text-gray-500 line-clamp-1">{p.userPersona || "설정 없음"}</div>
                                        </div>
                                    </div>
                                    <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition flex items-center space-x-2 bg-white pl-2">
                                        <span className="text-xs text-sky-500 font-bold">불러오기</span>
                                        <button onClick={(e) => handleDelete(p.id!, e)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition" title="삭제">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}