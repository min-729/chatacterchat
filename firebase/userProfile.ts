import { db } from '@/firebase/clientApp';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ⭐ 여기에 userId가 추가되어야 에러가 사라집니다!
export interface UserProfile {
    name: string;
    avatarUrl: string;
    userPersona: string;
    userId: string; // 이 줄이 핵심입니다!
}

const USER_DOC_ID = 'default_user_profile'; 
const userDocRef = doc(db, 'users', USER_DOC_ID);

export async function getUserProfile(): Promise<UserProfile> {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        // 기존 데이터에 userId가 없으면 기본값 'user'로 설정해서 반환
        return {
            ...data,
            userId: data.userId || 'user' 
        };
    } 

    return {
        name: '나 (User)',
        avatarUrl: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png',
        userPersona: '별다른 설정 없이 평범한 사용자입니다.',
        userId: 'user' // 기본 아이디
    };
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
    await setDoc(userDocRef, profile);
}