import { db } from '@/firebase/clientApp';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';

// 1. 프로필 데이터 구조
export interface UserProfile {
    id?: string; // 목록 관리용 ID
    name: string;
    avatarUrl: string;
    userPersona: string;
}

// 2. 현재 활성화된 프로필 위치 (기존 데이터 유지)
const ACTIVE_USER_DOC_ID = 'default_user_profile'; 
const activeUserDocRef = doc(db, 'users', ACTIVE_USER_DOC_ID);

// 3. 프로필 보관함 컬렉션 위치
const PROFILES_COLLECTION = collection(db, 'user_profiles_library');

// --- 함수들 ---

// (A) 현재 활성화된 프로필 가져오기
export async function getUserProfile(): Promise<UserProfile> {
    const docSnap = await getDoc(activeUserDocRef);
    if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
    } 
    return {
        name: '나 (User)',
        avatarUrl: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png',
        userPersona: '별다른 설정 없이 평범한 사용자입니다.',
    };
}

// ⭐ (B) 프로필 저장하기 (이 함수가 없어서 에러가 났었습니다!)
// 현재 활성화된 프로필을 덮어씁니다.
export async function saveUserProfile(profile: UserProfile): Promise<void> {
    // id는 저장할 필요 없으니 제외하고 저장
    const { id, ...data } = profile;
    await setDoc(activeUserDocRef, data);
}

// (C) setActiveProfile은 saveUserProfile과 똑같은 기능입니다. (별칭)
export const setActiveProfile = saveUserProfile;

// (D) 보관함에 있는 모든 프로필 목록 가져오기
export async function getAllSavedProfiles(): Promise<UserProfile[]> {
    const snapshot = await getDocs(PROFILES_COLLECTION);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
}

// (E) 보관함에 새 프로필 추가하기
export async function addToLibrary(profile: UserProfile): Promise<void> {
    const { id, ...data } = profile;
    await addDoc(PROFILES_COLLECTION, data);
}

// (F) 보관함에서 프로필 삭제하기
export async function deleteFromLibrary(id: string): Promise<void> {
    await deleteDoc(doc(db, 'user_profiles_library', id));
}