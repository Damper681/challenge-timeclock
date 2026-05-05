// ============================================================
// REMPLACER CES VALEURS PAR VOTRE CONFIG FIREBASE
// ============================================================
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyDT8yszAlNCeOn8gLNvfF2-n-MMh_4TL_g",
  authDomain: "challenge-atelier.firebaseapp.com",
  projectId: "challenge-atelier",
  storageBucket: "challenge-atelier.firebasestorage.app",
  messagingSenderId: "1096646029782",
  appId: "1:1096646029782:web:edbadee6ed93392f1ff477"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const storage = getStorage(app)
