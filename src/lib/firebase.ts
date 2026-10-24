import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseAuthSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const GOOGLE_MEET_SCOPES = [
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/meetings.space.settings',
] as const;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
GOOGLE_MEET_SCOPES.forEach((scope) => {
  googleAuthProvider.addScope(scope);
});
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory cache for Google Workspace OAuth access token (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedGoogleAccessToken: string | null = null;

export const getGoogleAccessToken = (): string | null => {
  return cachedGoogleAccessToken;
};

export const setGoogleAccessToken = (token: string | null): void => {
  cachedGoogleAccessToken = token;
};

export const initWorkspaceAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: FirebaseUser | null) => {
    if (user) {
      if (cachedGoogleAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedGoogleAccessToken);
      } else if (!isSigningIn) {
        cachedGoogleAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedGoogleAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleForMeet = async (): Promise<{
  user: FirebaseUser;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso OAuth de Google Meet.');
    }
    cachedGoogleAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedGoogleAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const firebaseSignOut = async (_authInstance = auth) => {
  cachedGoogleAccessToken = null;
  await firebaseAuthSignOut(auth);
};

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  type FirebaseUser,
};
