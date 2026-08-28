// ==UserScript==
// @name         APCAT & TopAutoPieces to GKR Cart Linker
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Transfert automatique d'articles, références exactes (Code), désignations épurées "Marque - Nom de la pièce" (sans résidus descriptifs, côtés ou caractéristiques) et prix (HTVAC) vers GKR
// @author       Norsiide
// @match        https://apcat.eu/*
// @match        https://*.carparts-cat.com/*
// @match        https://b2b.topautopieces.be/*
// @match        https://*.topautopieces.be/*
// @match        https://toppiecesauto.be/*
// @match        https://*.toppiecesauto.be/*
// @match        https://app.gkr.be/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // Helper: Attente asynchrone
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // Helper: Normalisation de code/référence
    function normalizeCode(code) {
        if (!code) return "";
        return code.replace(/[^a-z0-9]/gi, '').toLowerCase();
    }

    // Liste des mots descriptifs et devises
    const DESCRIPTIVE_WORDS = [
        'filter', 'gasket', 'oil', 'base', 'brake', 'pad', 'disc', 'sensor', 'bearing', 'belt',
        'seal', 'joint', 'filtre', 'bague', 'étanchéité', 'etancheite', 'disque', 'plaquette',
        'biellette', 'rotule', 'bras', 'suspension', 'support', 'pompe', 'courroie', 'galet',
        'amortisseur', 'ressort', 'bougie', 'soupape', 'durite', 'embrayage', 'volant', 'moteur',
        'alternateur', 'démarreur', 'demarreur', 'radiateur', 'condenseur', 'ventilateur',
        'thermostat', 'vanne', 'injecteur', 'cardan', 'soufflet', 'silentbloc', 'butée', 'butee',
        'jeu', 'set', 'kit', 'pack', 'front', 'rear', 'avant', 'arriere', 'arrière', 'droit',
        'droite', 'gauche', 'supérieur', 'superieur', 'inférieur', 'inferieur',
        'eur', 'eu', 'oe', 'oem', 'oen', 'original', 'piece', 'pièce', 'article', 'ref', 'code'
    ];

    function isDescriptiveWord(str) {
        if (!str) return false;
        let s = str.toLowerCase();
        return DESCRIPTIVE_WORDS.some(w => s === w || s.includes(w));
    }

    // Helper: Nettoyage précis du nom de la pièce (suppression stricte des résidus descriptifs, côtés de montage, etc.)
    function cleanShortProductName(name, brand = '') {
        if (!name) return "";
        let clean = String(name).replace(/[\u00a0\u202F]/g, ' ').replace(/\s+/g, ' ').trim();

        // 1. Supprimer parenthèses, crochets et accolades
        clean = clean.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
        clean = clean.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
        clean = clean.replace(/\s*\{[^}]*\}\s*/g, ' ').trim();

        // 2. Supprimer la marque si présente dans le nom
        if (brand) {
            let escapedBrand = brand.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            clean = clean.replace(new RegExp('\\b' + escapedBrand + '\\b', 'gi'), ' ').trim();
        }

        // 3. Supprimer toute marque automobile connue résiduelle
        const KNOWN_BRANDS_REGEX = /\b(?:MEYLE|LEMA|MOOG|DT|AJUSA|FEBI|BILSTEIN|BOSCH|BREMBO|TRW|ATE|CORTECO|ELRING|SKF|FAG|INA|VALEO|RIDEX|STARK|SACHS|MONROE|LUK|CONTITECH|GATES|DAYCO|HENGST|MAHLE|MANN|PURFLUX|DELPHI|DENSO|NGK|BERU|TEXTAR|FERODO|ZIMMERMANN|KYB|KAYABA|LEMFORDER|LEMFÖRDER|SWAG|ORIGINAL|GERMANY|PREMIUM|PRO|MAX|PLUS)\b/gi;
        clean = clean.replace(KNOWN_BRANDS_REGEX, ' ').trim();

        // 4. Supprimer les répétitions consécutives de mots (ex: "bush bush" -> "bush")
        clean = clean.replace(/\b([A-Za-z0-9_-]+)(?:\s+\1\b)+/gi, '$1');

        // 5. Couper aux séparateurs majeurs de sections
        if (clean.includes(' | ')) clean = clean.split(' | ')[0].trim();
        if (clean.includes(' -- ')) clean = clean.split(' -- ')[0].trim();
        if (clean.includes(' // ')) clean = clean.split(' // ')[0].trim();
        if (clean.includes(';')) clean = clean.split(';')[0].trim();

        // 6. Couper avant les mentions de position / côtés d'assemblage (FR & EN)
        clean = clean.replace(/\s+(?:c[ôo]t[ée]\s+d['’]assemblage|essieu\s+avant|essieu\s+arri[èe]re|c[ôo]t[ée]\s+gauche|c[ôo]t[ée]\s+droit|front\s+axle|rear\s+axle|left\s+and\s+right|both\s+sides|des\s+deux\s+c[ôo]t[ée]s|c[ôo]t[ée]\s+volant|c[ôo]t[ée]\s+bo[iî]te|c[ôo]t[ée]\s+roue|c[ôo]t[ée]\s+pont).*$/i, '').trim();

        // 7. Couper avant les mentions de caractéristiques techniques / dimensions / spécifications
        clean = clean.replace(/\s*(?:Ø|diam[èe]tre|epaisseur|épaisseur|longueur|largeur|hauteur|poids|filetage|voltage|amp[èe]re|sens\s+de\s+rotation|mat[ée]riau)\s*:?.*$/i, '').trim();

        // 8. Couper avant les détails secondaires (ex: "with o-ring", "avec joint...", "avec vis...", "with screws...")
        clean = clean.replace(/\s+(?:with\s+o-ring|with\s+screws|with\s+gasket|with\s+seal|with\s+accessories|avec\s+joint|avec\s+vis|avec\s+bague|sans\s+bague|avec\s+accessoires|pour\s+v[ée]hicules).*$/i, '').trim();

        // 9. Si plus de 2 virgules, couper à partir de la 2ème virgule pour garder "Nom, sous-catégorie" (ex: "Gasket, oil filter housing")
        let commaParts = clean.split(',');
        if (commaParts.length > 2) {
            clean = commaParts.slice(0, 2).join(',').trim();
        }

        // 10. Couper les mots de positionnement isolés à la fin du nom (ex: "Biellette avant gauche" -> "Biellette")
        clean = clean.replace(/\s+(?:avant|arri[èe]re|gauche|droit|droite|sup[ée]rieur|inf[ée]rieur|int[ée]rieur|ext[ée]rieur|front|rear|left|right|upper|lower|inner|outer)$/i, '').trim();
        clean = clean.replace(/\s+(?:avant|arri[èe]re|gauche|droit|droite|sup[ée]rieur|inf[ée]rieur|int[ée]rieur|ext[ée]rieur|front|rear|left|right|upper|lower|inner|outer)$/i, '').trim();

        // 11. Nettoyer les ponctuations aux extrémités et espaces multiples
        clean = clean.replace(/\s+/g, ' ').replace(/^[-–:;,.\s]+|[-–:;,.\s]+$/g, '').trim();

        // 12. Limiter à 5 mots maximum pour éviter tout reste de description
        let words = clean.split(' ').filter(Boolean);
        if (words.length > 5) {
            clean = words.slice(0, 5).join(' ').replace(/[,;:\s]+$/, '').trim();
        }

        return clean.trim();
    }

    // Helper: Déduplication des séquences et phrases répétées (ex: "100 715 0002/S 100 715 0002/S" -> "100 715 0002/S", "110441 110441" -> "110441")
    function deduplicateRepeatedPhrase(str) {
        if (!str) return "";
        let s = str.trim();
        let words = s.split(' ').filter(Boolean);
        let n = words.length;

        // 1. Découpage en 2 moitiés identiques de mots
        if (n >= 2 && n % 2 === 0) {
            let half = n / 2;
            let firstHalf = words.slice(0, half).join(' ');
            let secondHalf = words.slice(half).join(' ');
            if (firstHalf.toLowerCase() === secondHalf.toLowerCase() || normalizeCode(firstHalf) === normalizeCode(secondHalf)) {
                return firstHalf;
            }
        }

        // 2. Découpage textuel direct
        let len = s.length;
        for (let i = 2; i <= Math.floor(len / 2); i++) {
            let candidate = s.slice(0, i).trim();
            let rest = s.slice(i).trim();
            if (candidate.toLowerCase() === rest.toLowerCase() || normalizeCode(candidate) === normalizeCode(rest)) {
                return candidate;
            }
        }

        return s;
    }

    // Helper: Nettoyage et isolation stricte de la référence pièce sans aucun doublon
    function cleanReferenceCode(ref) {
        if (!ref) return "";
        let clean = String(ref).replace(/[\u00a0\u202F]/g, ' ').replace(/\s+/g, ' ').trim();

        // 1. Retirer parenthèses et crochets (ex: "(100 715 0002/S)", "[110441 OE]")
        clean = clean.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
        clean = clean.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();

        // 2. Retirer préfixes
        clean = clean.replace(/^(?:art(?:icle)?\.?|r[ée]f(?:[ée]rence)?\.?|code|n[o°]?\.?)\s*:?\s*/i, '');

        // 3. Retirer devises / suffixes à la fin
        clean = clean.replace(/\s+(?:EUR|€|\$|EU|OE|OEM|OEN|ORIGINAL|PI[ÈE]CE|ARTICLE)$/i, '');
        clean = clean.replace(/^(?:OE|OEM|OEN)\s+/i, '');

        // 4. Nettoyage des ponctuations résiduelles
        clean = clean.replace(/^["'();:,\-_/.\s]+|["'();:,\-_/.\s]+$/g, '').trim();

        // 5. Première passe de déduplication de phrases
        clean = deduplicateRepeatedPhrase(clean);

        // 6. Analyser les mots de la référence
        let words = clean.split(' ').filter(Boolean);
        if (words.length >= 2) {
            let keepWords = [];
            let hasSeenDigit = false;

            for (let i = 0; i < words.length; i++) {
                let w = words[i];
                if (/\d/.test(w)) {
                    hasSeenDigit = true;
                    keepWords.push(w);
                } else {
                    if (!hasSeenDigit) {
                        // Préfixe court avant les chiffres (ex: "W", "C", "MF", "VO")
                        if (w.length <= 4 && !isDescriptiveWord(w)) {
                            keepWords.push(w);
                        }
                    } else {
                        // Suffixe technique après chiffres autorisé UNIQUEMENT si contient un symbole (/ - .) (ex: "/S", "/1", "-A")
                        if (/^[\/\-_.]+[A-Za-z0-9]*$/.test(w) || /^[A-Za-z0-9]+[\/\-_.]+[A-Za-z0-9]*$/.test(w)) {
                            keepWords.push(w);
                        } else {
                            // Mot de marque, devise ou descriptif -> STOP !
                            break;
                        }
                    }
                }
            }

            if (keepWords.length > 0) {
                clean = keepWords.join(' ');
            }
        }

        // 7. Deuxième passe de déduplication
        clean = deduplicateRepeatedPhrase(clean);

        return clean.trim();
    }

    // Helper: Découpage précis pour extraire la Référence (avec chiffres), la Marque et la Désignation
    function extractRefAndDescFromText(str) {
        if (!str) return { reference: '', designation: '', brand: '' };
        let words = str.replace(/\s+/g, ' ').trim().split(' ');

        let firstRefIndex = -1;
        for (let i = 0; i < words.length; i++) {
            let w = words[i];
            if (/\d/.test(w)) {
                if (i > 0 && /^[A-Za-z]{1,2}$/.test(words[i - 1]) && !isDescriptiveWord(words[i - 1])) {
                    firstRefIndex = i - 1;
                } else {
                    firstRefIndex = i;
                }
                break;
            }
        }

        if (firstRefIndex !== -1) {
            let descBefore = words.slice(0, firstRefIndex);
            let refWords = [];
            let descAfter = [];
            let inRef = true;

            for (let j = firstRefIndex; j < words.length; j++) {
                let w = words[j];
                if (inRef) {
                    if (/\d/.test(w)) {
                        refWords.push(w);
                    } else if (j === firstRefIndex && w.length <= 2) {
                        refWords.push(w);
                    } else if (/^[\/\-_.]+[A-Za-z0-9]*$/.test(w) || /^[A-Za-z0-9]+[\/\-_.]+[A-Za-z0-9]*$/.test(w)) {
                        refWords.push(w);
                    } else {
                        inRef = false;
                        descAfter.push(w);
                    }
                } else {
                    descAfter.push(w);
                }
            }

            let fullRef = cleanReferenceCode(refWords.join(' ').trim());
            let fullDesc = descBefore.concat(descAfter).join(' ').trim();

            return {
                reference: fullRef,
                designation: cleanShortProductName(fullDesc)
            };
        }

        return {
            reference: cleanReferenceCode(str.trim()),
            designation: cleanShortProductName(str.trim())
        };
    }

    // Helper: Conversion TVAC (TTC) vers HTVAC (Hors TVA - 21% Belgique)
    function toHtvac(priceTvac, vatRate = 0.21) {
        if (!priceTvac || priceTvac <= 0) return 0;
        return Math.round((priceTvac / (1 + vatRate)) * 100) / 100;
    }

    // Helper: Nettoyage et conversion de chaîne en nombre flottant
    function cleanPriceNumber(numStr) {
        if (!numStr) return 0;
        let s = String(numStr).replace(/[\s\u00a0\u202F]/g, '');
        if (s.includes('.') && s.includes(',')) {
            if (s.indexOf('.') < s.indexOf(',')) {
                // Format européen: 1.234,56
                s = s.replace(/\./g, '').replace(',', '.');
            } else {
                // Format US: 1,234.56
                s = s.replace(/,/g, '');
            }
        } else if (s.includes(',')) {
            s = s.replace(',', '.');
        }
        let val = parseFloat(s);
        return isNaN(val) ? 0 : val;
    }

    // Helper: Extraction intelligente d'un prix depuis un texte
    function parsePriceFromText(text) {
        if (!text) return 0;
        text = text.replace(/[\u00a0\u202F]/g, ' ').trim();

        // 1. Cherche un motif avec symbole euro/EUR après (ex: "12,50 €", "1 234,56 EUR")
        let euroMatch = text.match(/([0-9]{1,3}(?:[\s\.]\d{3})*(?:[,\.]\d{1,2})|[0-9]+(?:[,\.]\d{1,2})?)\s*(?:€|EUR)/i);
        if (euroMatch) {
            let p = cleanPriceNumber(euroMatch[1]);
            if (p > 0) return p;
        }

        // 2. Cherche un motif avec symbole euro/EUR avant (ex: "€ 12,50", "EUR 12.50")
        let prefixMatch = text.match(/(?:€|EUR)\s*([0-9]{1,3}(?:[\s\.]\d{3})*(?:[,\.]\d{1,2})|[0-9]+(?:[,\.]\d{1,2})?)/i);
        if (prefixMatch) {
            let p = cleanPriceNumber(prefixMatch[1]);
            if (p > 0) return p;
        }

        // 3. Cherche un nombre décimal à 2 chiffres après virgule/point (ex: "12,50" ou "12.50")
        let decMatch = text.match(/([0-9]{1,3}(?:[\s\.]\d{3})*[,\.]\d{2})/);
        if (decMatch) {
            let p = cleanPriceNumber(decMatch[1]);
            if (p > 0) return p;
        }

        // 4. Dernier recours: tout nombre valide
        let anyMatch = text.match(/([0-9]+(?:[,\.]\d+)?)/);
        if (anyMatch) {
            let p = cleanPriceNumber(anyMatch[1]);
            if (p > 0) return p;
        }

        return 0;
    }

    // Helper: Mise à jour valeur Input compatible React / Mantine
    function setInputValue(input, value) {
        if (!input || value === undefined || value === null) return;
        input.focus();

        const stringVal = String(value);

        const applyVal = (val) => {
            const tracker = input._valueTracker;
            if (tracker) {
                tracker.setValue(input.value + '_prev');
            }
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            if (setter) {
                setter.call(input, val);
            } else {
                input.value = val;
            }
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        };

        applyVal(stringVal);

        // Si le champ NumberInput n'a pas pris en compte la valeur avec point, tester avec virgule
        if (typeof value === 'number' && stringVal.includes('.') && (!input.value || input.value === '0')) {
            applyVal(stringVal.replace('.', ','));
        }

        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
        input.blur();
    }

    // Helper: Mise à jour valeur Textarea compatible React
    function setTextareaValue(textarea, value) {
        if (!textarea) return;
        textarea.focus();
        const tracker = textarea._valueTracker;
        if (tracker) {
            tracker.setValue(textarea.value + '_prev');
        }
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        if (setter) {
            setter.call(textarea, value);
        } else {
            textarea.value = value;
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        textarea.blur();
    }

    // ==========================================
    //  COTE APCAT (Extraction)
    // ==========================================
    function extractApcatCart() {
        let items = [];

        let qtyInputs = document.querySelectorAll('input[id$="_qcc"], input.numeric_textbox, input[name*="qcc"]');
        if (qtyInputs.length === 0) {
            qtyInputs = document.querySelectorAll('tr input[type="text"], tr input[type="number"], tr input.colorClass_InputBox');
        }

        qtyInputs.forEach(input => {
            let qty = parseInt(input.value) || 0;
            if (qty <= 0) return;

            let parent = input.parentElement;
            let link = null;
            while (parent && parent !== document.body && parent.id !== 'bsk_all_main_pnl') {
                link = parent.querySelector('a[href*="55="]') || parent.querySelector('a[title*="détails"]') || parent.querySelector('a[href*="default.aspx"]');
                if (link) break;
                parent = parent.parentElement;
            }

            let reference = "";
            let group = "";
            let description = "";

            if (link) {
                let spans = link.querySelectorAll('span');
                if (spans.length >= 3) {
                    group = spans[0].textContent.trim();
                    description = cleanShortProductName(spans[1].textContent.trim(), group);
                    reference = cleanReferenceCode(spans[2].textContent.trim());
                } else if (spans.length === 2) {
                    let s0 = spans[0].textContent.trim();
                    let s1 = spans[1].textContent.trim();
                    if (/\d/.test(s1) && !/\d/.test(s0)) {
                        group = s0;
                        reference = cleanReferenceCode(s1);
                    } else {
                        group = s0;
                        description = cleanShortProductName(s1, group);
                    }
                } else if (spans.length === 1) {
                    description = cleanShortProductName(spans[0].textContent.trim());
                }
            }

            // Si pas trouvé dans les spans, chercher à côté du bouton de copie officiel APCAT
            if (!reference && parent) {
                let copyBtn = parent.querySelector('input.al_imgcopy');
                if (copyBtn) {
                    let parentDiv = copyBtn.closest('div');
                    if (parentDiv && parentDiv.previousElementSibling) {
                        reference = cleanReferenceCode(parentDiv.previousElementSibling.textContent.trim());
                    }
                }
            }

            // Recherche dans les autres spans du parent sans filtrer aucun caractère
            if (!reference && parent) {
                let spans = parent.querySelectorAll('span');
                for (let s of spans) {
                    let txt = s.textContent.trim();
                    if (/\d/.test(txt) && !txt.includes('EUR') && !txt.includes('€') && !txt.includes('Quantité') && !txt.includes('Achat') && txt.length >= 2) {
                        reference = cleanReferenceCode(txt);
                        break;
                    }
                }
            }

            // Fallback : paramètre URL 55= uniquement si rien trouvé dans le texte affiché
            if (!reference && link) {
                let hrefAttr = link.getAttribute('href') || link.href || "";
                let match = hrefAttr.match(/[?&]55=([^&]+)/);
                if (match) {
                    reference = cleanReferenceCode(decodeURIComponent(match[1]).replace(/\+/g, ' ').trim());
                }
            }

            if (reference) {
                reference = cleanReferenceCode(reference);
            }

            // Nettoyage de la description pour ne jamais dupliquer la référence
            if (description && reference && (description.toLowerCase() === reference.toLowerCase() || /^(?:OE|OEM|OEN)$/i.test(description.trim()))) {
                description = "";
            }

            // APCAT affiche "Achat net" qui est déjà un prix HT
            let price = 0;
            let parentText = parent ? parent.textContent : "";
            let priceMatch = parentText.match(/Achat net\s*:?\s*([\d,.\s]+)(?:EUR)?/i) || parentText.match(/(\d+[\.,]\d{2})\s*EUR/i);
            if (priceMatch) {
                price = cleanPriceNumber(priceMatch[1]);
            } else {
                price = parsePriceFromText(parentText);
            }

            if (reference) {
                items.push({
                    reference: reference,
                    group: group,
                    description: cleanShortProductName(description, group) || group || 'Article',
                    quantity: qty,
                    price: price
                });
            }
        });

        let note = "";
        let noteTextarea = document.getElementById('basket_dispatch_memo_memobx_readme') || document.querySelector('textarea[id*="memo"]') || document.querySelector('textarea');
        if (noteTextarea) {
            note = noteTextarea.value.trim();
        }

        console.log('[APCAT Export] Articles extraits :', items);
        return { items: items, note: note };
    }

    function addApcatExportButton() {
        let panel = document.getElementById('bsk_all_main_pnl');
        if (!panel) return;
        if (document.getElementById('apcat-export-btn')) return;

        let btn = document.createElement('button');
        btn.id = 'apcat-export-btn';
        btn.textContent = '🚀 Copier mon panier APCAT vers GKR';
        btn.style.cssText = 'margin: 10px 0; padding: 12px 20px; background-color: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 15px; width: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: background 0.3s;';
        btn.onmouseover = () => btn.style.backgroundColor = '#218838';
        btn.onmouseout = () => btn.style.backgroundColor = '#28a745';

        btn.addEventListener('click', () => {
            let data = extractApcatCart();
            if (data.items.length === 0) {
                alert('Aucun article trouvé dans le panier APCAT.');
                return;
            }
            GM_setValue('apcat_cart_data', data);
            let details = data.items.map(it => `• ${it.reference} (Qté: ${it.quantity}, Prix HT: ${it.price.toFixed(2)} €)`).join('\n');
            alert(`✅ ${data.items.length} article(s) APCAT exporté(s) !\n\n${details}\n\nSur GKR, cliquez sur "Importer APCAT".`);
        });

        panel.insertBefore(btn, panel.firstChild);
    }

    // ==========================================
    //  COTE TOPAUTOPIECES (Extraction & Conversion HTVAC)
    // ==========================================
    function extractTopAutoPiecesPrice(row, quantityInput, index, quantity) {
        // 1. Chercher par IDs spécifiques connus
        const idCandidates = [
            `cart_price_${index}`,
            `price_${index}`,
            `product_price_${index}`,
            `item_price_${index}`,
            `unit_price_${index}`,
            `total_price_${index}`,
            `total_${index}`,
            `check_view_price_param_${index}`
        ];
        for (let id of idCandidates) {
            let el = document.getElementById(id);
            if (el) {
                let p = parsePriceFromText(el.getAttribute('data-price') || el.getAttribute('data-unit-price') || el.getAttribute('value') || el.textContent);
                if (p > 0) return p;
            }
        }

        if (!row && quantityInput) {
            row = quantityInput.closest('tr') || quantityInput.closest('.cart-item') || quantityInput.closest('.cart_row') || quantityInput.closest('tbody');
        }
        if (!row) return 0;

        // 2. Chercher dans les éléments ayant une classe liée au prix
        let priceEls = row.querySelectorAll('.price, .cart_price, .unit_price, .unit-price, .product-price, .item-price, .item_price, .price-unit, .p-price, [class*="price"], [class*="Price"]');
        for (let el of priceEls) {
            if (el.closest('del, s') || el.classList.contains('old-price') || el.classList.contains('price-old')) continue;
            let p = parsePriceFromText(el.getAttribute('data-price') || el.getAttribute('data-unit-price') || el.textContent);
            if (p > 0) return p;
        }

        // 3. Inspecter les cellules TD autour de la cellule quantité
        let quantityCell = quantityInput ? quantityInput.closest('td') : null;

        if (quantityCell && quantityCell.previousElementSibling) {
            let prevCell = quantityCell.previousElementSibling;
            let p = parsePriceFromText(prevCell.textContent);
            if (p > 0) return p;
        }

        if (quantityCell && quantityCell.nextElementSibling) {
            let nextCell = quantityCell.nextElementSibling;
            if (nextCell.querySelector('button.cart_quantity') || nextCell.classList.contains('cart_quantity')) {
                nextCell = nextCell.nextElementSibling;
            }
            if (nextCell) {
                let p = parsePriceFromText(nextCell.textContent);
                if (p > 0) return p;
            }
        }

        // 4. Parcourir toutes les cellules TD de la ligne contenant un symbole monétaire
        let cells = Array.from(row.querySelectorAll('td'));
        for (let cell of cells) {
            if (cell === quantityCell) continue;
            if (cell.textContent.includes('€') || cell.textContent.includes('EUR')) {
                let p = parsePriceFromText(cell.textContent);
                if (p > 0) return p;
            }
        }

        // 5. Recherche globale dans le texte de la ligne
        let rowPrice = parsePriceFromText(row.textContent);
        if (rowPrice > 0) return rowPrice;

        return 0;
    }

    function extractTopAutoPiecesCart() {
        let items = [];

        let qtyInputs = Array.from(document.querySelectorAll('input[id^="cart_quantity_"], input[name*="cart_quantity"], input.cart_quantity'));
        if (qtyInputs.length === 0) {
            for (let i = 0; i < 100; i++) {
                let input = document.getElementById(`cart_quantity_${i}`);
                if (input) qtyInputs.push(input);
            }
        }

        qtyInputs.forEach((quantityInput, idx) => {
            let indexMatch = quantityInput.id ? quantityInput.id.match(/\d+/) : null;
            let i = indexMatch ? parseInt(indexMatch[0]) : idx;

            let quantity = parseInt(quantityInput.value) || 0;
            if (quantity <= 0) return;

            let row = quantityInput.closest('tr') || quantityInput.closest('.cart-item') || quantityInput.closest('.cart_row');
            let productLink = document.getElementById(`check_view_price_param_${i}`) || (row ? row.querySelector('a[href*="piece"], a[href*="art"], a[href*="product"], a.product-name, a') : null);

            let rawPrice = extractTopAutoPiecesPrice(row, quantityInput, i, quantity);

            let priceHT = 0;
            let rowText = row ? row.textContent : "";
            let htMatch = rowText.match(/(?:HT|HTVA|HTVAC|Hors TVA)\s*:?\s*([0-9]{1,3}(?:[\s\.]\d{3})*[,\.]\d{2})/i) ||
                rowText.match(/([0-9]{1,3}(?:[\s\.]\d{3})*[,\.]\d{2})\s*€?\s*(?:HT|HTVA|HTVAC|Hors TVA)/i);

            if (htMatch) {
                priceHT = cleanPriceNumber(htMatch[1]);
            } else if (rawPrice > 0) {
                priceHT = toHtvac(rawPrice, 0.21);
            }

            let brand = '';
            let designation = '';
            let reference = '';
            let url = productLink ? (productLink.getAttribute('href') || productLink.href || '') : '';

            if (productLink) {
                let fullText = productLink.textContent.replace(/\s+/g, ' ').trim();
                let parsed = extractRefAndDescFromText(fullText);

                reference = cleanReferenceCode(parsed.reference);
                designation = parsed.designation;

                let spans = Array.from(productLink.querySelectorAll('span'));
                let leafSpans = spans.filter(span => span.querySelectorAll('span').length === 0);

                if (leafSpans.length >= 2) {
                    let firstSpan = leafSpans[0].textContent.trim();
                    if (!/\d/.test(firstSpan) && firstSpan.length <= 25 && !isDescriptiveWord(firstSpan)) {
                        brand = firstSpan;
                    }
                }

                // Si la marque n'est pas encore identifiée, chercher dans les mots du lien
                if (!brand) {
                    let rawWords = fullText.split(/\s+/);
                    for (let w of rawWords) {
                        let cleanW = w.replace(/[^A-Za-z0-9]/g, '');
                        if (cleanW.length >= 2 && !/\d/.test(cleanW) && !isDescriptiveWord(cleanW)) {
                            brand = cleanW.toUpperCase();
                            break;
                        }
                    }
                }
            }

            // Nettoyage de la désignation (nom de la pièce)
            if (designation && reference) {
                if (designation.toLowerCase() === reference.toLowerCase() || /^(?:OE|OEM|OEN)$/i.test(designation.trim())) {
                    designation = "";
                } else {
                    designation = designation.replace(new RegExp(reference.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), '').trim();
                    designation = designation.replace(/^[-–:\s]+|[-–:\s]+$/g, '').trim();
                }
            }

            // Si la référence n'a pas été trouvée, recherche dans la ligne (ex: Art. N°)
            if (!reference && row) {
                let artEl = row.querySelector('.art_number, .article-number, .art-num, .prod-num, .art_num, .item-number');
                if (artEl) {
                    let txt = artEl.textContent.trim().replace(/^(?:Art\.?\s*N[o°]?|R[ée]f\.?)\s*:?\s*/i, '');
                    if (txt) {
                        reference = cleanReferenceCode(txt.trim());
                    }
                }
                if (!reference) {
                    let refMatch = rowText.match(/(?:Art\.?\s*N[o°]?|Num[ée]ro\s+d['’]article|R[ée]f(?:[ée]rence)?|Code\s+article)\s*:?\s*([^\r\n\t]+)/i);
                    if (refMatch) {
                        reference = cleanReferenceCode(refMatch[1].trim());
                    }
                }
            }

            // Dernier recours : extraction depuis l'URL du produit
            if (!reference && url) {
                let urlParts = url.split(/[/?#]/).filter(Boolean);
                let slug = urlParts[urlParts.length - 1] || '';
                let slugParts = slug.replace(/\.html?$/i, '').split('-');
                let candidate = slugParts.find(part => /\d/.test(part) && part.length >= 3 && !/^\d{6,}$/.test(part));
                if (candidate) {
                    reference = cleanReferenceCode(candidate.toUpperCase());
                }
            }

            items.push({
                reference: reference || 'INCONNU',   // Référence exacte et unique (ex: 110441, 100 715 0002/S, LE26265.35)
                group: brand,                        // Marque de la pièce (ex: MEYLE, LEMA, MOOG, DT, AJUSA)
                description: cleanShortProductName(designation, brand) || 'Article', // Nom propre et épuré de la pièce
                quantity: quantity,
                price: priceHT,                      // Prix unitaire HT injecté dans GKR
                priceTvac: rawPrice                  // Prix TVAC d'origine pour information
            });
        });

        console.log('[TopAuto Export] Articles extraits (HTVAC) :', items);
        return { items: items, note: "" };
    }

    function addTopAutoPiecesExportButton() {
        if (document.getElementById('topautopieces-export-btn')) return;

        let cartContainer = document.querySelector('.main_cart') || document.querySelector('.card') || document.querySelector('.cart_table') || document.querySelector('table') || document.querySelector('#content');

        let btn = document.createElement('button');
        btn.id = 'topautopieces-export-btn';
        btn.textContent = '🚀 Copier mon panier TopAuto vers GKR';

        if (cartContainer) {
            btn.style.cssText = 'margin: 12px 0; padding: 12px 20px; background-color: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 15px; width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.15); transition: background 0.3s; display: block; z-index: 9999;';
            cartContainer.insertBefore(btn, cartContainer.firstChild);
        } else {
            btn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 99999; padding: 14px 22px; background-color: #007bff; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: background 0.3s;';
            document.body.appendChild(btn);
        }

        btn.onmouseover = () => btn.style.backgroundColor = '#0056b3';
        btn.onmouseout = () => btn.style.backgroundColor = '#007bff';

        btn.addEventListener('click', () => {
            let data = extractTopAutoPiecesCart();
            if (data.items.length === 0) {
                alert('Aucun article trouvé dans le panier TopAutoPieces.');
                return;
            }
            GM_setValue('topauto_cart_data', data);
            let details = data.items.map(it => `• ${it.reference} (Qté: ${it.quantity}, Prix HT: ${it.price.toFixed(2)} € [TVAC: ${it.priceTvac ? it.priceTvac.toFixed(2) + ' €' : '-'}])`).join('\n');
            alert(`✅ ${data.items.length} article(s) TopAutoPieces exporté(s) en HTVAC !\n\n${details}\n\nSur GKR, cliquez sur "Importer TopAuto".`);
        });
    }

    // ==========================================
    //  COTE GKR (Importation avec détection de colonnes)
    // ==========================================
    async function fillLatestDiversRow(item) {
        let rows = document.querySelectorAll('tbody tr, table tr');
        if (rows.length === 0) return;

        let candidateRows = Array.from(rows).filter(r => r.querySelectorAll('input').length >= 2);
        if (candidateRows.length === 0) return;
        let latestRow = candidateRows[candidateRows.length - 1];

        let table = latestRow.closest('table');
        let headerThs = table ? Array.from(table.querySelectorAll('thead th, tr th')) : [];
        let headers = headerThs.map(th => th.textContent.trim().toLowerCase());

        let codeInput = null;
        let descInput = null;
        let priceInput = null;
        let qtyInput = null;

        // 1. Détection par les colonnes du tableau (TH <-> TD)
        let cells = Array.from(latestRow.querySelectorAll('td'));
        cells.forEach((td, colIdx) => {
            let headerText = headers[colIdx] || '';
            let input = td.querySelector('input');
            if (!input) return;

            if (headerText.includes('code') || headerText.includes('réf') || headerText.includes('ref') || headerText.includes('article') || headerText.includes('numéro') || headerText.includes('sku')) {
                codeInput = input;
            } else if (headerText.includes('désignation') || headerText.includes('designation') || headerText.includes('description') || headerText.includes('nom') || headerText.includes('libellé') || headerText.includes('libelle')) {
                descInput = input;
            } else if (headerText.includes('prix') || headerText.includes('pu') || headerText.includes('achat') || headerText.includes('montant') || headerText.includes('ht') || headerText.includes('price') || headerText.includes('€')) {
                priceInput = input;
            } else if (headerText.includes('qte') || headerText.includes('qté') || headerText.includes('quantité') || headerText.includes('qty') || headerText.includes('nombre')) {
                qtyInput = input;
            }
        });

        // 2. Détection par placeholder, aria-label, name, title des inputs
        let allInputs = Array.from(latestRow.querySelectorAll('input'));
        allInputs.forEach(input => {
            let ph = (input.placeholder || '').toLowerCase();
            let aria = (input.getAttribute('aria-label') || '').toLowerCase();
            let name = (input.name || '').toLowerCase();
            let title = (input.title || '').toLowerCase();
            let label = ph + ' ' + aria + ' ' + name + ' ' + title;

            if (!codeInput && (label.includes('code') || label.includes('réf') || label.includes('ref') || label.includes('article') || label.includes('sku'))) {
                codeInput = input;
            } else if (!descInput && (label.includes('désignation') || label.includes('designation') || label.includes('description') || label.includes('nom') || label.includes('libellé') || label.includes('libelle'))) {
                descInput = input;
            } else if (!priceInput && (label.includes('prix') || label.includes('pu') || label.includes('achat') || label.includes('montant') || label.includes('ht') || label.includes('price') || label.includes('€'))) {
                priceInput = input;
            } else if (!qtyInput && (label.includes('qte') || label.includes('qté') || label.includes('quantité') || label.includes('qty') || label.includes('nombre'))) {
                qtyInput = input;
            }
        });

        // 3. Séparation par type (Text vs Number) si non encore trouvés
        let textInputs = allInputs.filter(i => (i.type === 'text' || !i.type) && i.inputMode !== 'decimal' && i.inputMode !== 'numeric' && !i.classList.contains('mantine-NumberInput-input'));
        let numberInputs = allInputs.filter(i => i.type === 'number' || i.inputMode === 'decimal' || i.inputMode === 'numeric' || i.classList.contains('mantine-NumberInput-input'));

        if (!codeInput && !descInput) {
            if (textInputs.length >= 2) {
                codeInput = textInputs[0];
                descInput = textInputs[1];
            } else if (textInputs.length === 1) {
                codeInput = textInputs[0];
            }
        } else if (!codeInput && descInput) {
            codeInput = textInputs.find(i => i !== descInput);
        } else if (codeInput && !descInput) {
            descInput = textInputs.find(i => i !== codeInput);
        }

        if (!priceInput || !qtyInput) {
            if (numberInputs.length >= 2) {
                if (!priceInput) priceInput = numberInputs[0];
                if (!qtyInput) qtyInput = numberInputs[1];
            } else if (numberInputs.length === 1) {
                if (!priceInput) priceInput = numberInputs[0];
            }
        }

        console.log('[GKR Linker] Code Input:', codeInput, 'Desc Input:', descInput);

        let finalRef = cleanReferenceCode(item.reference);

        // 1. Injection dans le champ Code (Référence pure de la pièce)
        if (codeInput) {
            console.log('[GKR Linker] => Insertion dans CODE (Réf pièce) :', finalRef);
            setInputValue(codeInput, finalRef);
        }

        // 2. Injection dans le champ Désignation strictement formaté en "Marque - Nom de la pièce"
        if (descInput) {
            let brand = (item.group || '').trim();
            let name = cleanShortProductName(item.description || '', brand);

            // Retirer la référence du nom de la pièce si présente
            if (finalRef) {
                name = name.replace(new RegExp(finalRef.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), '').trim();
            }

            // Retirer les devises et suffixes parasites
            name = name.replace(/\b(?:EUR|€|\$|EU|OE|OEM|OEN|ORIGINAL)\b/gi, '').trim();
            name = name.replace(/^[-–:;,.\s]+|[-–:;,.\s]+$/g, '').trim();

            // Supprimer la marque du nom pour qu'elle ne soit pas répétée
            if (brand) {
                let escapedBrand = brand.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                name = name.replace(new RegExp('\\b' + escapedBrand + '\\b', 'gi'), '').trim();
            }

            // Nettoyage final du nom
            name = cleanShortProductName(name, brand);

            // Format strict : Marque - Nom (ex: "MEYLE - Repair Kit, stabiliser bush", "AJUSA - Gasket, oil filter housing")
            let descText = "";
            if (brand && name) {
                descText = `${brand} - ${name}`;
            } else if (brand && !name) {
                descText = brand;
            } else if (!brand && name) {
                descText = name;
            } else {
                descText = 'Article';
            }

            console.log('[GKR Linker] => Insertion dans DÉSIGNATION (Marque - Nom) :', descText);
            setInputValue(descInput, descText);
        }

        // 3. Injection Prix et Quantité
        if (priceInput) {
            console.log('[GKR Linker] => Insertion dans PRIX HT :', item.price);
            setInputValue(priceInput, item.price);
        }
        if (qtyInput) {
            console.log('[GKR Linker] => Insertion dans QUANTITÉ :', item.quantity);
            setInputValue(qtyInput, item.quantity);
        }
    }

    async function importItem(item) {
        let buttons = document.querySelectorAll('button');
        let diversBtn = Array.from(buttons).find(b => b.textContent.includes('Produit divers'));
        if (diversBtn) {
            diversBtn.click();
            await sleep(400);
            await fillLatestDiversRow(item);
        }
    }

    async function importItems(data) {
        let commentArea = document.querySelector('textarea[placeholder="Commentaire"]');
        if (commentArea && data.note) {
            setTextareaValue(commentArea, data.note);
        }

        for (let item of data.items) {
            await importItem(item);
            await sleep(300);
        }
    }

    function addGkrImportButtons() {
        let buttons = document.querySelectorAll('button');
        let diversBtn = Array.from(buttons).find(b => b.textContent.includes('Produit divers'));
        if (!diversBtn) return;
        if (document.getElementById('gkr-import-apcat-btn')) return;

        // 1. Bouton Import APCAT (Vert)
        let btnApcat = document.createElement('button');
        btnApcat.id = 'gkr-import-apcat-btn';
        btnApcat.textContent = '📥 Importer APCAT';
        btnApcat.style.cssText = 'margin-left: 10px; padding: 10px 16px; background-color: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-family: Roboto, Helvetica, Arial, sans-serif; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); transition: background 0.3s;';
        btnApcat.onmouseover = () => btnApcat.style.backgroundColor = '#218838';
        btnApcat.onmouseout = () => btnApcat.style.backgroundColor = '#28a745';

        btnApcat.addEventListener('click', async () => {
            btnApcat.disabled = true;
            btnApcat.textContent = '⏳ Import APCAT...';
            try {
                let data = GM_getValue('apcat_cart_data');
                if (!data || !data.items || data.items.length === 0) {
                    alert('Aucune donnée APCAT enregistrée. Cliquez d\'abord sur "Copier mon panier APCAT vers GKR" dans APCAT.');
                    return;
                }
                await importItems(data);
                alert(`🎉 Panier APCAT (${data.items.length} articles) importé avec succès !`);
            } catch (e) {
                console.error(e);
                alert('Erreur lors de l\'import APCAT: ' + e.message);
            } finally {
                btnApcat.disabled = false;
                btnApcat.textContent = '📥 Importer APCAT';
            }
        });

        // 2. Bouton Import TopAutoPieces (Bleu)
        let btnTopAuto = document.createElement('button');
        btnTopAuto.id = 'gkr-import-topauto-btn';
        btnTopAuto.textContent = '📥 Importer TopAuto';
        btnTopAuto.style.cssText = 'margin-left: 8px; padding: 10px 16px; background-color: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-family: Roboto, Helvetica, Arial, sans-serif; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); transition: background 0.3s;';
        btnTopAuto.onmouseover = () => btnTopAuto.style.backgroundColor = '#0056b3';
        btnTopAuto.onmouseout = () => btnTopAuto.style.backgroundColor = '#007bff';

        btnTopAuto.addEventListener('click', async () => {
            btnTopAuto.disabled = true;
            btnTopAuto.textContent = '⏳ Import TopAuto...';
            try {
                let data = GM_getValue('topauto_cart_data');
                if (!data || !data.items || data.items.length === 0) {
                    alert('Aucune donnée TopAutoPieces enregistrée. Cliquez d\'abord sur "Copier mon panier TopAuto vers GKR" dans TopAutoPieces.');
                    return;
                }
                await importItems(data);
                alert(`🎉 Panier TopAutoPieces (${data.items.length} articles) importé avec succès !`);
            } catch (e) {
                console.error(e);
                alert('Erreur lors de l\'import TopAuto: ' + e.message);
            } finally {
                btnTopAuto.disabled = false;
                btnTopAuto.textContent = '📥 Importer TopAuto';
            }
        });

        diversBtn.parentNode.insertBefore(btnApcat, diversBtn.nextSibling);
        btnApcat.parentNode.insertBefore(btnTopAuto, btnApcat.nextSibling);
    }

    // --- Boucle d'injection dynamique ---
    setInterval(() => {
        let host = window.location.host;
        let href = window.location.href;
        if (host.includes('carparts-cat.com') || host.includes('apcat.eu')) {
            addApcatExportButton();
        } else if ((host.includes('topautopieces.be') || host.includes('toppiecesauto.be')) && (href.includes('/cart') || document.querySelector('.main_cart') || document.querySelector('input[id^="cart_quantity_"]'))) {
            addTopAutoPiecesExportButton();
        } else if (host.includes('gkr.be')) {
            addGkrImportButtons();
        }
    }, 1000);

})();
