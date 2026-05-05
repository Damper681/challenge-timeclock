# Challenge Timeclock

PWA de pointage des ordres de réparation pour Challenge Automobile.

## Setup

### 1. Firebase

1. Firebase Console → créer un projet (ou utiliser l'existant)
2. Firestore → créer la base en mode production
3. Project Settings → SDK setup → copier la config dans `src/firebase.js`

#### Règles Firestore (à coller dans la console)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /ors/{id} {
      allow read, write: if true;
    }
    match /pointages/{id} {
      allow read, write: if true;
    }
  }
}
```

### 2. Installation locale

```bash
npm install
npm run dev
```

### 3. Déploiement Netlify

```bash
npm run build
# Drag & drop le dossier dist/ sur Netlify
# ou connecter le repo GitHub
```

## Collections Firebase

### `ors` — OR du jour
| Champ | Type | Description |
|---|---|---|
| noFT | string | Numéro fiche de travail Ariane |
| client | string | Nom du client |
| vehicule | string | Marque + modèle |
| plaques | string | Immatriculation |
| travaux | string | Description (tronquée à 300 car.) |
| mécano | string | Mécanicien assigné (si rempli) |
| dateKey | string | YYYY-MM-DD |
| activeMechanics | array | IDs mécaniciens en cours sur cet OR |
| importedAt | string | ISO timestamp d'import |

### `pointages` — Enregistrements de temps
| Champ | Type | Description |
|---|---|---|
| mechanic | string | ID (jose / vivian / valentin) |
| mechanicName | string | Prénom affiché |
| orId | string | Référence OR Firebase |
| noFT | string | Numéro OR Ariane |
| client | string | Nom client |
| vehicule | string | Véhicule |
| dateKey | string | YYYY-MM-DD |
| start | timestamp | Début du pointage |
| end | timestamp \| null | Fin (null = en cours) |
| duration_min | number \| null | Durée calculée en minutes |
| note | string | Note libre du mécanicien |

## Flux quotidien

1. **Sara** ouvre l'app, choisit "Sara"
2. Elle uploade l'export Ariane du jour (.xlsx)
3. L'app parse et affiche les OR actifs → elle valide
4. Les OR apparaissent instantanément sur les téléphones des mécaniciens

## Utilisation mécanicien

1. Ouvre l'app sur le téléphone (installer comme PWA via Safari/Chrome)
2. Choisit son prénom
3. Tape sur l'OR qu'il attaque → chrono démarre
4. Tape sur un autre OR → le premier se stoppe automatiquement
5. Peut ajouter une note à la fin

## Installer comme PWA (iPhone)

Safari → partager → "Sur l'écran d'accueil"

## Installer comme PWA (Android)

Chrome → menu → "Ajouter à l'écran d'accueil"
