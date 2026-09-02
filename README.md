# 🚀 Suite de Scripts GKR Auto Pièces

Suite d'outils Tampermonkey pour automatiser l'importation de paniers fournisseurs (**APCAT** & **TopAutoPieces**) vers **GKR** (en création de commande comme en **édition de bon existant**), ainsi que la vérification en temps réel des stocks et fiches produits sur **Norsiide**.

---

## 📦 Les Scripts Inclus

| Fichier | Version | Description |
| :--- | :---: | :--- |
| [`copy-basket-apcat.js`](./copy-basket-apcat.js) | **4.2** | Export 1-clic depuis **APCAT** (`apcat.eu` / `carparts-cat.com`), conversion HT, gestion création + édition GKR, remplissage automatique de la colonne **Montant TVAC**. |
| [`copy-basket-autopieces.js`](./copy-basket-autopieces.js) | **4.2** | Export 1-clic depuis **TopAutoPieces** / **Toppiecesauto**, extraction prioritaire via `index_X` et `description_X` (max 55 car.), calcul HTVAC et injection TVAC dans GKR. |
| [`checker-piece.js`](./checker-piece.js) | **2.8** | Vérification automatique des codes de commande sur [`gkr.norsiide.be/products`](https://gkr.norsiide.be/products) avec badges en ligne et redirection directe sans doublon d'onglets. |

---

## 📌 Installation dans Google Chrome (Tampermonkey)

1. **Installer l'extension Tampermonkey** :
   - Rendez-vous sur le [Chrome Web Store - Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) et cliquez sur **Ajouter à Chrome**.

2. **Ajouter les scripts** :
   - Cliquez sur l'icône **Tampermonkey** dans votre navigateur > **Tableau de bord** (Dashboard).
   - Cliquez sur l'onglet **+ (Nouveau script)**.
   - Copiez-collez le contenu de [`copy-basket-apcat.js`](./copy-basket-apcat.js) et enregistrez (`Ctrl + S`).
   - Créez un deuxième script pour [`copy-basket-autopieces.js`](./copy-basket-autopieces.js) et enregistrez (`Ctrl + S`).
   - Créez un troisième script pour [`checker-piece.js`](./checker-piece.js) et enregistrez (`Ctrl + S`).

---

## 🛠️ Guide d'Utilisation

### 1️⃣ Exportation depuis les fournisseurs

- **Sur APCAT (`apcat.eu` / `carparts-cat.com`)** :
  - Dans votre panier, cliquez sur le bouton vert **`🚀 Copier mon panier APCAT vers GKR`**.
  - Une notification Toaster verte en haut à droite confirme la liste complète des pièces et les prix HT.
- **Sur TopAutoPieces (`b2b.topautopieces.be` / `topautopieces.be` / `toppiecesauto.be`)** :
  - Dans votre panier, cliquez sur le bouton bleu **`🚀 Copier mon panier TopAuto vers GKR`**.
  - Le script capture directement les identifiants officiels (`index_X` pour la référence, `description_X` pour la désignation).

---

### 2️⃣ Importation dans GKR (`app.gkr.be`)

Le système fonctionne à 100% sur **les deux modes** de GKR :
1. **Création d'une nouvelle commande** ([`app.gkr.be/new-dashboard/new-order`](https://app.gkr.be/new-dashboard/new-order))
2. **Édition d'un bon existant / non fiscal** (`app.gkr.be/new-dashboard/non-fiscal/details/<uuid>`)

Deux boutons dédiés sont injectés à côté de **Produit divers** :
- **`📥 Importer APCAT`** (Vert) : Insère instantanément toutes les pièces du panier APCAT.
- **`📥 Importer TopAuto`** (Bleu) : Insère instantanément toutes les pièces du panier TopAutoPieces.

#### 🎯 Précision des colonnes importées :
- **`Code`** : Référence technique complète et exacte, préservant 100% des caractères y compris les références composites complexes (ex: `PL-13/12V-PLA`, `W712/75`, `100 715 0002/S`, `VO-SB-7892`).
- **`Désignation`** : Formaté en **`Marque - Nom de la pièce`** (plafonné à 55 caractères max pour s'adapter parfaitement aux champs GKR, ex: `BOSAL - Joint d'étanchéité du système d'échappement`).
- **`Prix HTVA`** (Col 3) : Prix d'achat net hors TVA (avec point décimal exigé par GKR).
- **`Qté.`** (Col 4) : Quantité exacte commandée.
- **`Montant`** (Col 10 TVAC) : Calculé et injecté automatiquement ($\text{Prix HT} \times \text{Qté} \times 1.21$), ce qui permet à GKR de recalculer immédiatement le total de la commande en mode édition sans bloquer à 1 €.

#### 🔔 Notifications Toaster intégrées :
- Fini les popups `alert()` bloquantes : les deux scripts utilisent un système moderne de **notifications Toaster** (vert = succès, jaune = avertissement, rouge = erreur) avec disparition automatique et bouton de fermeture.

---

### 3️⃣ Vérification du stock sur Norsiide (`checker-piece.js`)

Sur votre page de commande GKR :
1. Cliquez sur le bouton violet **`🔎 Checker sur Norsiide`**.
2. Le script scanne toutes les références de votre tableau et interroge [`gkr.norsiide.be/products`](https://gkr.norsiide.be/products).
3. Des badges d'état s'affichent directement sur chaque ligne :
   - 🟢 **`✅ En stock (Ouvrir ↗)`** : La pièce existe dans votre catalogue Norsiide.
   - 🔴 **`❌ Non trouvé (Chercher ↗)`** : La référence n'a pas été trouvée.
4. **Redirection intelligente sans doublons** :
   - Si votre onglet [`gkr.norsiide.be`](https://gkr.norsiide.be) est déjà ouvert, un clic sur **`Ouvrir ↗`** recharge automatiquement la fiche dans cet onglet sans créer de doublon.

---

## 👨‍💻 Auteur
Développé pour l'optimisation des flux de commande **GKR Auto Pièces**.
