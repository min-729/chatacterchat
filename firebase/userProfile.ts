import { db } from '@/firebase/clientApp';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ⭐ userId를 삭제했습니다. 이제 에러 안 납니다.
export interface UserProfile {
    name: string;
    avatarUrl: string;
    userPersona: string;
}

const USER_DOC_ID = 'default_user_profile'; 
const userDocRef = doc(db, 'users', USER_DOC_ID);

export async function getUserProfile(): Promise<UserProfile> {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
    } 

    return {
        name: '나 (User)',
        avatarUrl: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png',
        userPersona: '별다른 설정 없이 평범한 사용자입니다.',
    };
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
    await setDoc(userDocRef, profile);
}