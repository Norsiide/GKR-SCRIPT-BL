// ==UserScript==
// @name         TopAutoPieces to GKR Cart Linker
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Transfert automatique d'articles, références exactes (Code), désignations épurées "Marque - Nom de la pièce" et prix (HTVAC) depuis TopAutoPieces vers GKR
// @author       Norsiide
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

    // Toaster notification moderne
    function showToast(message, type = 'info', duration = 4500) {
        let container = document.getElementById('gkr-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'gkr-toast-container';
            container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999999; display: flex; flex-direction: column; gap: 10px; max-width: 420px; pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.style.cssText = 'pointer-events: auto; display: flex; align-items: flex-start; gap: 12px; padding: 14px 18px; border-radius: 10px; color: #ffffff; font-size: 13.5px; line-height: 1.45; box-shadow: 0 8px 24px rgba(0,0,0,0.22); opacity: 0; transform: translateX(40px) scale(0.95); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); backdrop-filter: blur(8px); word-break: break-word; white-space: pre-line;';

        let bg = '#333333';
        let icon = 'ℹ️';
        if (type === 'success') {
            bg = 'linear-gradient(135deg, #1e7e34, #28a745)';
            icon = '✅';
        } else if (type === 'error') {
            bg = 'linear-gradient(135deg, #bd2130, #dc3545)';
            icon = '❌';
        } else if (type === 'warning') {
            bg = 'linear-gradient(135deg, #d39e00, #ffc107)';
            toast.style.color = '#212529';
            icon = '⚠️';
        } else {
            bg = 'linear-gradient(135deg, #0056b3, #007bff)';
            icon = 'ℹ️';
        }
        toast.style.background = bg;

        const iconSpan = document.createElement('span');
        iconSpan.style.cssText = 'font-size: 18px; line-height: 1; flex-shrink: 0;';
        iconSpan.textContent = icon;

        const msgSpan = document.createElement('div');
        msgSpan.style.cssText = 'flex-grow: 1; font-weight: 500;';
        msgSpan.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background: transparent; border: none; color: inherit; font-size: 14px; cursor: pointer; opacity: 0.7; padding: 0 0 0 8px; line-height: 1; transition: opacity 0.2s;';
        closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
        closeBtn.onmouseout = () => closeBtn.style.opacity = '0.7';

        const dismiss = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px) scale(0.9)';
            setTimeout(() => toast.remove(), 300);
        };

        closeBtn.onclick = dismiss;

        toast.appendChild(iconSpan);
        toast.appendChild(msgSpan);
        toast.appendChild(closeBtn);
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0) scale(1)';
        });

        if (duration > 0) {
            setTimeout(dismiss, duration);
        }
    }

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

    // Helper: Nettoyage précis du nom de la pièce
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

        // 4. Supprimer les répétitions consécutives de mots
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

        // 8. Couper avant les détails secondaires
        clean = clean.replace(/\s+(?:with\s+o-ring|with\s+screws|with\s+gasket|with\s+seal|with\s+accessories|avec\s+joint|avec\s+vis|avec\s+bague|sans\s+bague|avec\s+accessoires|pour\s+v[ée]hicules).*$/i, '').trim();

        // 9. Si plus de 2 virgules, couper à partir de la 2ème virgule
        let commaParts = clean.split(',');
        if (commaParts.length > 2) {
            clean = commaParts.slice(0, 2).join(',').trim();
        }

        // 10. Couper les mots de positionnement isolés à la fin du nom
        clean = clean.replace(/\s+(?:avant|arri[èe]re|gauche|droit|droite|sup[ée]rieur|inf[ée]rieur|int[ée]rieur|ext[ée]rieur|front|rear|left|right|upper|lower|inner|outer)$/i, '').trim();
        clean = clean.replace(/\s+(?:avant|arri[èe]re|gauche|droit|droite|sup[ée]rieur|inf[ée]rieur|int[ée]rieur|ext[ée]rieur|front|rear|left|right|upper|lower|inner|outer)$/i, '').trim();

        // 11. Nettoyer les ponctuations aux extrémités et espaces multiples
        clean = clean.replace(/\s+/g, ' ').replace(/^[-–:;,.\s]+|[-–:;,.\s]+$/g, '').trim();

        // 12. Limiter à 5 mots maximum
        let words = clean.split(' ').filter(Boolean);
        if (words.length > 5) {
            clean = words.slice(0, 5).join(' ').replace(/[,;:\s]+$/, '').trim();
        }

        return clean.trim();
    }

    // Helper: Déduplication des séquences et phrases répétées
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
        let clean = String(ref).replace(/[\u00a0\u202F]/g, ' ').trim();

        // 1. Recoller les tirets et slashs séparés par des espaces (ex: "PL - 13 / 12V - PLA" => "PL-13/12V-PLA")
        clean = clean.replace(/\s*([-\/])\s*/g, '$1');

        // 2. Retirer parenthèses et crochets SEULEMENT s'ils ne contiennent pas la référence elle-même
        if (!/\([A-Za-z0-9\/\-_.]+\)/.test(clean) || clean.includes(' ')) {
            clean = clean.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
            clean = clean.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
        }

        // 3. Retirer préfixes
        clean = clean.replace(/^(?:art(?:icle)?\.?|r[ée]f(?:[ée]rence)?\.?|code|n[o°]?\.?|num[ée]ro\s+d['’]article)\s*:?\s*/i, '');

        // 4. Retirer devises / suffixes à la fin
        clean = clean.replace(/\s+(?:EUR|€|\$|EU|OE|OEM|OEN|ORIGINAL|PI[ÈE]CE|ARTICLE)$/i, '');
        clean = clean.replace(/^(?:OE|OEM|OEN)\s+/i, '');

        // 5. Nettoyage des ponctuations résiduelles aux extrémités
        clean = clean.replace(/^["'();:,\-_/.\s]+|["'();:,\-_/.\s]+$/g, '').trim();

        // 6. Si le code contient une référence composite complète (ex: PL-13/12V-PLA, C30005/1), la garder ENTIÈRE
        let compMatch = clean.match(/\b([A-Za-z0-9]+(?:[-\/][A-Za-z0-9]+)+)\b/);
        if (compMatch && /\d/.test(compMatch[1]) && compMatch[1].length >= 3) {
            return compMatch[1].toUpperCase();
        }

        // 7. Déduplication de phrases
        clean = deduplicateRepeatedPhrase(clean);

        // 8. Analyser les mots de la référence
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
                        if (w.length <= 4 && !isDescriptiveWord(w)) {
                            keepWords.push(w);
                        }
                    } else {
                        if (/^[\/\-_.]+[A-Za-z0-9]*$/.test(w) || /^[A-Za-z0-9]+[\/\-_.]+[A-Za-z0-9]*$/.test(w)) {
                            keepWords.push(w);
                        } else {
                            break;
                        }
                    }
                }
            }

            if (keepWords.length > 0) {
                clean = keepWords.join(' ');
            }
        }

        // 9. Deuxième passe de déduplication
        clean = deduplicateRepeatedPhrase(clean);

        return clean.trim();
    }

    // Helper: Découpage précis pour extraire la Référence (avec chiffres), la Marque et la Désignation
    function extractRefAndDescFromText(str) {
        if (!str) return { reference: '', designation: '', brand: '' };

        // 1. Recoller les tirets et slashs avec espaces
        let s = str.replace(/[\u00a0\u202F]/g, ' ').replace(/\s*([-\/])\s*/g, '$1').replace(/\s+/g, ' ').trim();

        // 2. Détection prioritaire d'une référence composite complète (ex: "PL-13/12V-PLA", "W712/75", "10-1234-A")
        let compMatch = s.match(/\b([A-Za-z0-9]+(?:[-\/][A-Za-z0-9]+)+)\b/);
        if (compMatch && /\d/.test(compMatch[1]) && compMatch[1].length >= 4) {
            let fullRef = compMatch[1].toUpperCase();
            let fullDesc = s.replace(compMatch[0], '').trim();
            return {
                reference: fullRef,
                designation: cleanShortProductName(fullDesc)
            };
        }

        let words = s.split(' ');
        let firstRefIndex = -1;
        for (let i = 0; i < words.length; i++) {
            let w = words[i];
            if (/\d/.test(w)) {
                if (i > 0 && /^[A-Za-z]{1,4}$/.test(words[i - 1]) && !isDescriptiveWord(words[i - 1])) {
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
                    } else if (j === firstRefIndex && w.length <= 4) {
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
            reference: cleanReferenceCode(s.trim()),
            designation: cleanShortProductName(s.trim())
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
                s = s.replace(/\./g, '').replace(',', '.');
            } else {
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

        let euroMatch = text.match(/([0-9]{1,3}(?:[\s\.]\d{3})*(?:[,\.]\d{1,2})|[0-9]+(?:[,\.]\d{1,2})?)\s*(?:€|EUR)/i);
        if (euroMatch) {
            let p = cleanPriceNumber(euroMatch[1]);
            if (p > 0) return p;
        }

        let prefixMatch = text.match(/(?:€|EUR)\s*([0-9]{1,3}(?:[\s\.]\d{3})*(?:[,\.]\d{1,2})|[0-9]+(?:[,\.]\d{1,2})?)/i);
        if (prefixMatch) {
            let p = cleanPriceNumber(prefixMatch[1]);
            if (p > 0) return p;
        }

        let decMatch = text.match(/([0-9]{1,3}(?:[\s\.]\d{3})*[,\.]\d{2})/);
        if (decMatch) {
            let p = cleanPriceNumber(decMatch[1]);
            if (p > 0) return p;
        }

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
        try {
            input.focus();

            // Formatage avec POINT obligatoire pour GKR
            let stringVal = String(value);
            if (typeof value === 'number') {
                stringVal = Number.isInteger(value) ? String(value) : value.toFixed(2);
            } else if (stringVal.includes(',')) {
                stringVal = stringVal.replace(',', '.');
            }

            // 1. Sélectionner tout le texte
            try {
                if (typeof input.select === 'function') input.select();
            } catch (e) {}

            // 2. Mise à jour React Tracker + Prototype
            const tracker = input._valueTracker;
            if (tracker) {
                tracker.setValue(input.value + '_prev');
            }
            const proto = input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (setter) {
                setter.call(input, stringVal);
            } else {
                input.value = stringVal;
            }

            // 3. Événements React / Mantine
            input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: stringVal }));
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

            // 4. Clôture avec Enter et Blur pour forcer Mantine à recalculer
            input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
            input.dispatchEvent(new FocusEvent('blur', { bubbles: true, composed: true }));
            input.blur();
        } catch (e) {
            console.error('[setInputValue error]', e);
        }
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
    //  COTE TOPAUTOPIECES (Extraction & Conversion HTVAC)
    // ==========================================
    function extractTopAutoPiecesPrice(row, quantityInput, index, quantity) {
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

        let priceEls = row.querySelectorAll('.price, .cart_price, .unit_price, .unit-price, .product-price, .item-price, .item_price, .price-unit, .p-price, [class*="price"], [class*="Price"]');
        for (let el of priceEls) {
            if (el.closest('del, s') || el.classList.contains('old-price') || el.classList.contains('price-old')) continue;
            let p = parsePriceFromText(el.getAttribute('data-price') || el.getAttribute('data-unit-price') || el.textContent);
            if (p > 0) return p;
        }

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

        let cells = Array.from(row.querySelectorAll('td'));
        for (let cell of cells) {
            if (cell === quantityCell) continue;
            if (cell.textContent.includes('€') || cell.textContent.includes('EUR')) {
                let p = parsePriceFromText(cell.textContent);
                if (p > 0) return p;
            }
        }

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

            // 0. Priorité absolue : ID direct TopAutoPieces (ex: id="index_4" ou [id^="index_"])
            let indexEl = document.getElementById(`index_${i}`) || (row ? row.querySelector('[id^="index_"]') : null);
            if (indexEl) {
                let txt = (indexEl.textContent || indexEl.value || indexEl.getAttribute('data-article-number') || '').trim();
                txt = txt.replace(/^(?:Art\.?\s*N[o°]?|R[ée]f\.?|Num[ée]ro\s+d['’]article|Code\s+article)\s*:?\s*/i, '');
                let cleaned = cleanReferenceCode(txt);
                if (cleaned) {
                    reference = cleaned;
                    console.log(`[TopAuto Export] Référence trouvée via index_${i} =>`, reference);
                }
            }

            // 1. Chercher le numéro d'article officiel dans la ligne (TopAutoPieces / Autopieces)
            if (!reference && row) {
                let artEl = row.querySelector('.art_number, .article-number, .art-num, .prod-num, .art_num, .item-number, .nr, .product-nr, [class*="art_num"], [class*="art-num"], [class*="article_nr"], [class*="article-nr"]');
                if (artEl) {
                    let txt = artEl.textContent.trim().replace(/^(?:Art\.?\s*N[o°]?|R[ée]f\.?|Num[ée]ro\s+d['’]article|Code\s+article)\s*:?\s*/i, '');
                    let cleaned = cleanReferenceCode(txt);
                    if (cleaned) reference = cleaned;
                }

                if (!reference) {
                    let refMatch = rowText.match(/(?:Num[ée]ro\s+d['’]article|Art(?:icle)?\.?\s*N[o°]?|R[ée]f(?:[ée]rence)?|Code\s+article)\s*:?\s*([A-Za-z0-9\/\-_.\s]{3,35})/i);
                    if (refMatch) {
                        let cleaned = cleanReferenceCode(refMatch[1].trim());
                        if (cleaned) reference = cleaned;
                    }
                }
            }

            // 2. Extraire la désignation depuis description_X en priorité absolue (limité à 50-55 caractères)
            let descEl = document.getElementById(`description_${i}`) ||
                         (row ? row.querySelector('[id^="description_"]') : null) ||
                         document.getElementById(`tow_info_${i}`) ||
                         document.getElementById('tow_info') ||
                         (row ? row.querySelector('.tow_info, #tow_info, [class*="tow_info"], [id*="tow_info"], .two_info, #two_info, [class*="two_info"], [id*="two_info"]') : null);
            if (descEl) {
                let txt = (descEl.textContent || descEl.value || '').replace(/\s+/g, ' ').trim();
                if (txt) {
                    let cleaned = cleanShortProductName(txt, brand);
                    if (cleaned.length > 50) {
                        cleaned = cleaned.slice(0, 50).trim();
                    }
                    designation = cleaned;
                    console.log(`[TopAuto Export] Désignation trouvée via description_${i} =>`, designation);
                }
            }

            // 3. Extraire titre, désignation et marque depuis productLink
            if (productLink) {
                let fullText = productLink.textContent.replace(/\s+/g, ' ').trim();
                let parsed = extractRefAndDescFromText(fullText);

                // Si aucune référence officielle n'a été trouvée, utiliser celle du titre
                if (!reference) {
                    reference = cleanReferenceCode(parsed.reference);
                }
                if (!designation) {
                    let d = parsed.designation || '';
                    if (d.length > 50) d = d.slice(0, 50).trim();
                    designation = d;
                }

                let spans = Array.from(productLink.querySelectorAll('span'));
                let leafSpans = spans.filter(span => span.querySelectorAll('span').length === 0);

                if (leafSpans.length >= 2) {
                    let firstSpan = leafSpans[0].textContent.trim();
                    if (!/\d/.test(firstSpan) && firstSpan.length <= 25 && !isDescriptiveWord(firstSpan)) {
                        brand = firstSpan;
                    }
                }

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

            if (designation && reference) {
                if (designation.toLowerCase() === reference.toLowerCase() || /^(?:OE|OEM|OEN)$/i.test(designation.trim())) {
                    designation = "";
                } else {
                    designation = designation.replace(new RegExp(reference.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), '').trim();
                    designation = designation.replace(/^[-–:\s]+|[-–:\s]+$/g, '').trim();
                }
            }

            // 3. Fallback URL si toujours rien
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
                reference: reference || 'INCONNU',
                group: brand,
                description: cleanShortProductName(designation, brand) || 'Article',
                quantity: quantity,
                price: priceHT,
                priceTvac: rawPrice
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
                showToast('Aucun article trouvé dans le panier TopAutoPieces.', 'warning');
                return;
            }
            GM_setValue('topauto_cart_data', data);
            let details = data.items.map(it => `• [${it.reference}] ${it.group ? it.group + ' - ' : ''}${it.description} (Qté: ${it.quantity}, Prix HT: ${it.price.toFixed(2)} € [TVAC: ${it.priceTvac ? it.priceTvac.toFixed(2) + ' €' : '-'}])`).join('\n');
            showToast(`🚀 ${data.items.length} article(s) TopAutoPieces exporté(s) :\n\n${details}\n\n👉 Sur GKR, cliquez sur "Importer TopAuto".`, 'success', 7000);
        });
    }

    // ==========================================
    //  COTE GKR (Importation)
    // ==========================================
    function getGkrArticleRows() {
        return Array.from(document.querySelectorAll('tbody tr, tr')).filter(r => {
            let inps = r.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"])');
            return inps.length >= 2;
        });
    }

    async function fillLatestDiversRow(targetRow, item) {
        if (!targetRow) return;

        let inputs = Array.from(targetRow.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"])'));
        if (inputs.length === 0) return;

        let codeInput = null;
        let descInput = null;
        let priceInput = null;
        let qtyInput = null;
        let montantInput = null;

        // Détection par colonnes TH si présentes
        let table = targetRow.closest('table');
        let cells = Array.from(targetRow.querySelectorAll('td'));
        if (table && cells.length > 0) {
            let ths = Array.from(table.querySelectorAll('thead th, tr th'));
            ths.forEach(th => {
                let txt = (th.textContent || '').trim().toLowerCase();
                let idx = th.cellIndex !== undefined ? th.cellIndex : -1;
                if (idx < 0) return;
                let cell = cells.find(td => td.cellIndex === idx);
                let inp = cell ? cell.querySelector('input') : null;
                if (!inp) return;

                if (txt === 'code' || ((txt.includes('code') || txt.includes('réf') || txt.includes('ref')) && !txt.includes('désignation'))) {
                    codeInput = inp;
                } else if (txt.includes('désignation') || txt.includes('designation') || txt.includes('description') || txt.includes('nom') || txt.includes('article')) {
                    descInput = inp;
                } else if (txt.includes('qte') || txt.includes('qté') || txt.includes('quantité') || txt.includes('qty')) {
                    qtyInput = inp;
                } else if (txt.includes('prix htva') || txt.includes('prix ht') || txt.includes('achat')) {
                    priceInput = inp;
                } else if (txt.includes('montant') || txt.includes('total tvac') || txt.includes('tvac')) {
                    montantInput = inp;
                }
            });
        }

        // Fallback positionnel direct (ordre standard des colonnes GKR)
        // [0: Code, 1: Désignation, 2: Prix HTVA, 3: Qté, 4: Remise, 5: Montant]
        if (inputs.length >= 6) {
            if (!codeInput) codeInput = inputs[0];
            if (!descInput) descInput = inputs[1];
            if (!priceInput) priceInput = inputs[2];
            if (!qtyInput) qtyInput = inputs[3];
            if (!montantInput) montantInput = inputs[5];
        } else if (inputs.length >= 5) {
            if (!codeInput) codeInput = inputs[0];
            if (!descInput) descInput = inputs[1];
            if (!priceInput) priceInput = inputs[2];
            if (!qtyInput) qtyInput = inputs[3];
            if (!montantInput) montantInput = inputs[4];
        } else if (inputs.length >= 4) {
            if (!codeInput) codeInput = inputs[0];
            if (!descInput) descInput = inputs[1];
            if (!priceInput) priceInput = inputs[2];
            if (!qtyInput) qtyInput = inputs[3];
        }

        let finalRef = cleanReferenceCode(item.reference);
        let brand = (item.group || '').trim();
        let name = cleanShortProductName(item.description || '', brand);
        if (finalRef) {
            name = name.replace(new RegExp(finalRef.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), '').trim();
        }
        name = cleanShortProductName(name, brand);
        if (name.length > 50) {
            name = name.slice(0, 50).trim();
        }
        let descText = brand && name ? `${brand} - ${name}` : (brand || name || 'Article');
        if (descText.length > 55) {
            descText = descText.slice(0, 55).trim();
        }

        let qty = item.quantity || 1;
        let priceHT = typeof item.price === 'number' ? item.price : parseFloat(String(item.price).replace(',', '.')) || 0;
        let formattedPriceHT = priceHT.toFixed(2);
        let montantTVAC = (priceHT * qty * 1.21).toFixed(2);

        console.log('[GKR Linker TopAuto] Remplissage ligne =>', {
            code: finalRef,
            desc: descText,
            priceHT: formattedPriceHT,
            qty: qty,
            montantTVAC: montantTVAC,
            hasMontantInput: !!montantInput
        });

        // 1. Code
        if (codeInput && finalRef) {
            setInputValue(codeInput, finalRef);
            await sleep(80);
        }

        // 2. Désignation
        if (descInput) {
            let fullText = (codeInput && codeInput !== descInput) ? descText : (finalRef ? `${finalRef} - ${descText}` : descText);
            setInputValue(descInput, fullText);
            await sleep(80);
        }

        // 3. Prix HTVA d'achat (Col 3)
        if (priceInput && priceHT > 0) {
            setInputValue(priceInput, formattedPriceHT);
            await sleep(80);
        }

        // 4. Quantité (Col 4)
        if (qtyInput && qty) {
            setInputValue(qtyInput, qty);
            await sleep(80);
        }

        // 5. Montant TVAC (Col 10) - La colonne demandée par GKR en édition
        if (montantInput && priceHT > 0) {
            setInputValue(montantInput, montantTVAC);
            await sleep(80);
        }
    }

    async function importItem(item) {
        let buttons = document.querySelectorAll('button');
        let diversBtn = Array.from(buttons).find(b => b.textContent.includes('Produit divers'));
        if (!diversBtn) {
            console.warn('[GKR Linker TopAuto] Bouton "Produit divers" non trouvé !');
            return;
        }

        let beforeRows = getGkrArticleRows();
        let countBefore = beforeRows.length;

        diversBtn.click();

        let targetRow = null;
        for (let i = 0; i < 35; i++) {
            await sleep(100);
            let currentRows = getGkrArticleRows();
            if (currentRows.length > countBefore) {
                targetRow = currentRows[currentRows.length - 1];
                break;
            }
        }

        if (!targetRow) {
            let allRows = getGkrArticleRows();
            if (allRows.length > 0) {
                targetRow = allRows[allRows.length - 1];
            }
        }

        if (targetRow) {
            await sleep(250);
            await fillLatestDiversRow(targetRow, item);
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

    function addGkrImportButton() {
        let buttons = document.querySelectorAll('button');
        let diversBtn = Array.from(buttons).find(b => b.textContent.includes('Produit divers'));
        if (!diversBtn) return;
        if (document.getElementById('gkr-import-topauto-btn')) return;

        // Bouton Import TopAutoPieces (Bleu)
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
                    showToast('Aucune donnée TopAutoPieces enregistrée. Cliquez d\'abord sur "Copier mon panier TopAuto vers GKR" dans TopAutoPieces.', 'warning');
                    return;
                }
                await importItems(data);
                showToast(`🎉 Panier TopAutoPieces (${data.items.length} article(s)) importé avec succès !`, 'success', 5000);
            } catch (e) {
                console.error(e);
                showToast('Erreur lors de l\'import TopAuto: ' + e.message, 'error', 6000);
            } finally {
                btnTopAuto.disabled = false;
                btnTopAuto.textContent = '📥 Importer TopAuto';
            }
        });

        // Insérer après le bouton APCAT s'il existe, sinon après diversBtn
        let refNode = document.getElementById('gkr-import-apcat-btn') || diversBtn;
        refNode.parentNode.insertBefore(btnTopAuto, refNode.nextSibling);
    }

    // --- Boucle d'injection dynamique ---
    setInterval(() => {
        let host = window.location.host;
        let href = window.location.href;
        if ((host.includes('topautopieces.be') || host.includes('toppiecesauto.be')) && (href.includes('/cart') || document.querySelector('.main_cart') || document.querySelector('input[id^="cart_quantity_"]'))) {
            addTopAutoPiecesExportButton();
        } else if (host.includes('gkr.be')) {
            addGkrImportButton();
        }
    }, 1000);

})();
