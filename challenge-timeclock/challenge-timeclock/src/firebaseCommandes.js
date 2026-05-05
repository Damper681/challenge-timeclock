// Connexion secondaire — projet challenge-commandes (lecture seule)
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfigCommandes = {
  apiKey: "AIzaSyDNUu1-M-hBaeGJOsOGqj9i6lIdMFKl6NM",
  authDomain: "challenge-commandes.firebaseapp.com",
  projectId: "challenge-commandes",
  storageBucket: "challenge-commandes.firebasestorage.app",
  messagingSenderId: "623537043724",
  appId: "1:623537043724:web:a8daf574431edb31ac3129",
}

// Nom unique pour éviter le conflit avec l'app principale
const appCommandes = initializeApp(firebaseConfigCommandes, 'commandes')
export const dbCommandes = getFirestore(appCommandes)
