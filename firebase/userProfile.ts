import { db } from '@/firebase/clientApp';
import { doc, getDoc, setDoc, DocumentData } from 'firebase/firestore';

// 유저 프로필 데이터 타입 정의 (userPersona 추가)
export interface UserProfile {
    name: string;
    avatarUrl: string;
    userPersona: string; // ⭐ 유저 배경 설정 추가
}

// 고정된 유저 ID
const USER_DOC_ID = 'default_user_profile'; 
const userDocRef = doc(db, 'users', USER_DOC_ID);

/**
 * 유저 프로필 정보를 Firestore에서 불러옵니다.
 */
export async function getUserProfile(): Promise<UserProfile> {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        // 저장된 데이터가 있다면 반환
        return docSnap.data() as UserProfile;
    } 

    // 데이터가 없으면 기본 프로필 반환
    return {
        name: '나 (User)',
        avatarUrl: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png',
        userPersona: '별다른 설정 없이 평범한 사용자입니다.', // ⭐ 기본값
    };
}

/**
 * 유저 프로필 정보를 Firestore에 저장(업데이트)합니다.
 */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
    await setDoc(userDocRef, profile);
}