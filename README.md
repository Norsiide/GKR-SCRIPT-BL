# Script Tampermonkey : APCAT & TopAutoPieces vers GKR Auto Pièces

Ce script permet d'exporter les articles et commentaires depuis **APCAT** (`apcat.eu`) et **TopAutoPieces** (`b2b.topautopieces.be`) vers **GKR** (`app.gkr.be`).

---

## 📌 Installation dans Google Chrome

1. **Installer Tampermonkey** :
   - Ouvrez Google Chrome.
   - Installez l'extension [Tampermonkey sur le Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo).

2. **Ajouter le Script** :
   - Cliquez sur l'icône Tampermonkey dans votre navigateur -> **Tableau de bord** (Dashboard).
   - Allez dans l'onglet **+ (Nouveau script)**.
   - Copiez-collez l'intégralité du contenu du fichier [`apcat_gkr_linker.user.js`](./apcat_gkr_linker.user.js).
   - Cliquez sur **Fichier > Enregistrer** (ou `Ctrl + S`).

---

## 🚀 Utilisation

### 1. Export du panier
- **Sur APCAT (`apcat.eu`)** : Cliquez sur le bouton vert **`🚀 Exporter APCAT vers GKR`**.
- **Sur TopAutoPieces (`b2b.topautopieces.be`)** : Cliquez sur le bouton bleu **`🚀 Exporter TopAuto vers GKR`**.

### 2. Import dans GKR (`app.gkr.be`)
Sur la page de création d'une nouvelle commande / Bon de Livraison, vous avez désormais **deux boutons séparés** à côté de *Produit divers* :
- **`📥 Importer APCAT`** (Vert) : Récupère et insère le dernier panier exporté depuis APCAT.
- **`📥 Importer TopAuto`** (Bleu) : Récupère et insère le dernier panier exporté depuis TopAutoPieces.
