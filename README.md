# 🚀 Suite de Scripts GKR Auto Pièces

Suite d'outils Tampermonkey pour automatiser l'importation de paniers fournisseurs (**APCAT** & **TopAutoPieces**) vers **GKR**, ainsi que la vérification en temps réel des stocks et fiches produits sur **Norsiide**.

---

## 📦 Les Scripts Inclus

| Fichier | Version | Description |
| :--- | :---: | :--- |
| [`apcat_gkr_linker.user.js`](./apcat_gkr_linker.user.js) | **4.0** | Export 1-clic des paniers APCAT & TopAutoPieces, conversion automatique **HTVAC**, isolation stricte du **Code** référence et formatage propre de la **Désignation** (`Marque - Nom`). |
| [`checker-piece.js`](./checker-piece.js) | **2.8** | Vérification automatique des codes de commande sur [`gkr.norsiide.be/products`](https://gkr.norsiide.be/products) avec badges en ligne et redirection directe sans ouvrir d'onglets en double. |

---

## 📌 Installation dans Google Chrome (Tampermonkey)

1. **Installer l'extension Tampermonkey** :
   - Rendez-vous sur le [Chrome Web Store - Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) et cliquez sur **Ajouter à Chrome**.

2. **Ajouter les scripts** :
   - Cliquez sur l'icône **Tampermonkey** dans votre navigateur > **Tableau de bord** (Dashboard).
   - Cliquez sur l'onglet **+ (Nouveau script)**.
   - Copiez-collez le contenu de [`apcat_gkr_linker.user.js`](./apcat_gkr_linker.user.js) et enregistrez (`Ctrl + S`).
   - Répétez l'opération pour [`checker-piece.js`](./checker-piece.js) dans un second script Tampermonkey et enregistrez (`Ctrl + S`).

---

## 🛠️ Guide d'Utilisation

### 1️⃣ Exportation depuis les fournisseurs

- **Sur APCAT (`apcat.eu` / `carparts-cat.com`)** :
  - Dans votre panier, cliquez sur le bouton vert **`🚀 Copier mon panier APCAT vers GKR`**.
- **Sur TopAutoPieces (`b2b.topautopieces.be` / `topautopieces.be`)** :
  - Dans votre panier, cliquez sur le bouton bleu **`🚀 Copier mon panier TopAuto vers GKR`**.

---

### 2️⃣ Importation dans GKR (`app.gkr.be`)

Sur la page de création de commande / Bon de livraison ([`app.gkr.be/new-dashboard/new-order`](https://app.gkr.be/new-dashboard/new-order)), deux boutons dédiés sont disponibles à côté de **Produit divers** :

- **`📥 Importer APCAT`** (Vert) : Insère instantanément toutes les pièces du panier APCAT.
- **`📥 Importer TopAuto`** (Bleu) : Insère instantanément toutes les pièces du panier TopAuto.

#### 🎯 Formatage automatique des colonnes :
- **`Code`** : Référence technique exacte et nettoyée (sans marque parasite, sans devise `EUR` et sans doublons). Ex: `LE26265.35`, `100 715 0002/S`, `VO-SB-7892`, `110441`.
- **`Désignation`** : Strictement formaté en **`Marque - Nom de la pièce`** (sans répétition de la marque ni paragraphe technique superflu). Ex: `AJUSA - Gasket, oil filter housing`, `LEMA - Bague d'étanchéité, vilebrequin`, `MEYLE - Repair Kit, stabiliser bush`.
- **`Prix`** : Prix unitaire converti en **HTVAC** (TVA belge 21% calculée automatiquement).
- **`Quantité`** : Quantité exacte commandée.

---

### 3️⃣ Vérification du stock sur Norsiide (`checker-piece.js`)

Sur votre page de commande GKR ([`app.gkr.be/new-dashboard/new-order`](https://app.gkr.be/new-dashboard/new-order)) :

1. Cliquez sur le bouton violet **`🔎 Checker sur Norsiide`**.
2. Le script scanne toutes les références de votre tableau et interroge [`gkr.norsiide.be/products`](https://gkr.norsiide.be/products).
3. Des badges d'état s'affichent directement sur chaque ligne :
   - 🟢 **`✅ En stock (Ouvrir ↗)`** : La pièce existe dans votre catalogue Norsiide.
   - 🔴 **`❌ Non trouvé (Chercher ↗)`** : La référence n'a pas été trouvée.
4. **Redirection intelligente sans doublons** :
   - Si votre onglet [`gkr.norsiide.be`](https://gkr.norsiide.be) est déjà ouvert dans le navigateur, un clic sur **`Ouvrir ↗`** recharge automatiquement la fiche dans cet onglet sans créer de nouvel onglet.
   - Vous conservez une navigation 100% fluide et libre sur Norsiide.

---

## 👨‍💻 Auteur
Développé pour l'optimisation des flux de commande **GKR Auto Pièces**.
