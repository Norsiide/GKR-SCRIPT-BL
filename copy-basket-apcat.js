// ==UserScript==
// @name         APCAT to GKR Cart Linker
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Transfert automatique d'articles, références exactes (Code), désignations épurées "Marque - Nom de la pièce" et prix (HT) depuis APCAT vers GKR
// @author       Norsiide
// @match        https://apcat.eu/*
// @match        https://*.carparts-cat.com/*
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
            bg = 'linear-gradient(135deg, #117a8b, #17a2b8)';
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

        // 1. Découpage en 2 moitiés identiques de mots (ex: "VKMA 01113 VKMA 01113" -> "VKMA 01113")
        if (n >= 4 && n % 2 === 0) {
            let half = n / 2;
            let firstHalf = words.slice(0, half).join(' ');
            let secondHalf = words.slice(half).join(' ');
            if (firstHalf.toLowerCase() === secondHalf.toLowerCase() || normalizeCode(firstHalf) === normalizeCode(secondHalf)) {
                return firstHalf;
            }
        }

        // 2. Découpage textuel direct uniquement pour les longues chaînes dupliquées (>= 10 caractères)
        let len = s.length;
        if (len >= 10 && len % 2 === 0) {
            let half = len / 2;
            let candidate = s.slice(0, half).trim();
            let rest = s.slice(half).trim();
            if (candidate.toLowerCase() === rest.toLowerCase() || normalizeCode(candidate) === normalizeCode(rest)) {
                return candidate;
            }
        }

        return s;
    }

    // Helper: Nettoyage et préservation intégrale de la référence pièce (tous les caractères conservés)
    function cleanReferenceCode(ref) {
        if (!ref) return "";
        let clean = String(ref).replace(/[\u00a0\u202F\r\n\t]+/g, ' ').trim();

        // 1. Retirer uniquement les préfixes de type label (ex: "Réf: ", "Art: ", "Code: ")
        clean = clean.replace(/^(?:art(?:icle)?\.?|r[ée]f(?:[ée]rence)?\.?|code|n[o°]?\.?|num[ée]ro\s+d['’]article)\s*:?\s*/i, '');

        // 2. Retirer les mentions de devises résiduelles en toute fin (ex: "EUR", "€")
        clean = clean.replace(/\s+(?:EUR|€|\$)\s*$/i, '');

        // 3. Retirer les guillemets ou apostrophes entourant la référence
        clean = clean.replace(/^["'«»`]+|["'«»`]+$/g, '').trim();

        // 4. Normaliser les espaces multiples consécutifs en un seul espace
        clean = clean.replace(/\s{2,}/g, ' ');

        // 5. Déduplication si la référence est répétée deux fois à l'identique dans le DOM
        clean = deduplicateRepeatedPhrase(clean);

        return clean.trim();
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

    // Helper: Mise à jour valeur Input / Textarea compatible React / Mantine
    function setInputValue(input, value) {
        if (!input || value === undefined || value === null) return;
        try {
            input.focus();

            // Formatage avec POINT obligatoire pour GKR si valeur numérique
            let stringVal = String(value);
            if (typeof value === 'number') {
                stringVal = Number.isInteger(value) ? String(value) : value.toFixed(2);
            } else if (/^\s*-?\d+,\d+\s*$/.test(stringVal)) {
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
            if (!parent) parent = input.closest('tr') || input.parentElement;

            let reference = "";
            let group = "";
            let description = "";

            // 1. Chercher d'abord le bouton de copie officiel APCAT (al_imgcopy)
            let copyBtn = parent.querySelector('input.al_imgcopy, .al_imgcopy, [onclick*="copy" i]');
            if (copyBtn) {
                let onclickStr = copyBtn.getAttribute('onclick') || '';
                let m = onclickStr.match(/(?:copy[^(]*|clipboard[^(]*)\(\s*['"]([^'"]+)['"]/i) ||
                        onclickStr.match(/['"]([^'"]+)['"]/);
                if (m && !m[1].includes('http') && !m[1].includes('.aspx') && !m[1].includes('javascript:') && !m[1].includes('return ')) {
                    reference = cleanReferenceCode(m[1]);
                }
                if (!reference) {
                    let attrVal = copyBtn.getAttribute('data-code') || copyBtn.getAttribute('data-article') || copyBtn.getAttribute('data-ref') || copyBtn.getAttribute('value') || copyBtn.getAttribute('title');
                    if (attrVal && attrVal.length >= 2 && !attrVal.includes('.aspx') && !attrVal.toLowerCase().includes('copier')) {
                        reference = cleanReferenceCode(attrVal);
                    }
                }
                if (!reference) {
                    let prev = copyBtn.previousElementSibling || copyBtn.closest('div')?.previousElementSibling;
                    if (prev && prev.textContent.trim()) {
                        reference = cleanReferenceCode(prev.textContent.trim());
                    }
                }
            }

            // 2. Chercher dans les liens textuels de la ligne
            let allLinks = Array.from(parent.querySelectorAll('a'));
            let textLink = allLinks.find(a => a.querySelectorAll('span').length > 0 || (a.textContent.trim().length > 2 && !a.querySelector('img'))) || link;

            if (textLink) {
                let spans = textLink.querySelectorAll('span');
                if (spans.length >= 3) {
                    group = spans[0].textContent.trim();
                    description = cleanShortProductName(spans[1].textContent.trim(), group);
                    if (!reference) reference = cleanReferenceCode(spans[2].textContent.trim());
                } else if (spans.length === 2) {
                    let s0 = spans[0].textContent.trim();
                    let s1 = spans[1].textContent.trim();
                    if (/\d/.test(s1) && !/\d/.test(s0)) {
                        group = s0;
                        if (!reference) reference = cleanReferenceCode(s1);
                    } else {
                        group = s0;
                        description = cleanShortProductName(s1, group);
                    }
                } else if (spans.length === 1 && spans[0].textContent.trim().length > 1) {
                    let txt = spans[0].textContent.trim();
                    if (!reference && /\d/.test(txt) && txt.length <= 60) {
                        reference = cleanReferenceCode(txt);
                    } else if (!description) {
                        description = cleanShortProductName(txt);
                    }
                }
            }

            // 3. Recherche dans tous les spans du parent si informations manquantes
            let allSpans = Array.from(parent.querySelectorAll('span')).filter(s => {
                let t = s.textContent.trim();
                return t.length >= 2 && !t.includes('EUR') && !t.includes('€') && !t.includes('Achat') && !t.includes('Quantité') && !t.includes('Net') && !t.includes('Total') && !t.includes('Prix');
            });

            if (!reference) {
                for (let s of allSpans) {
                    let txt = s.textContent.trim();
                    if (/\d/.test(txt) && txt.length >= 2 && txt.length <= 60 && !txt.includes('\n') && !/\b\d{2}\/\d{2}\/\d{4}\b/.test(txt)) {
                        reference = cleanReferenceCode(txt);
                        break;
                    }
                }
            }

            // Fallback paramètre URL 55= uniquement si rien trouvé
            if (!reference && link) {
                let hrefAttr = link.getAttribute('href') || link.href || "";
                let match = hrefAttr.match(/[?&]55=([^&]+)/);
                if (match) {
                    reference = cleanReferenceCode(decodeURIComponent(match[1]).replace(/\+/g, ' ').trim());
                }
            }

            if (!group || !description) {
                let textSpans = allSpans.filter(s => cleanReferenceCode(s.textContent.trim()) !== reference);
                if (textSpans.length >= 2) {
                    if (!group) group = textSpans[0].textContent.trim();
                    if (!description) description = cleanShortProductName(textSpans[1].textContent.trim(), group);
                } else if (textSpans.length === 1) {
                    if (!description) description = cleanShortProductName(textSpans[0].textContent.trim(), group);
                }
            }

            if (reference) {
                reference = cleanReferenceCode(reference);
            } else {
                reference = 'ARTICLE';
            }

            if (description && reference && (description.toLowerCase() === reference.toLowerCase() || /^(?:OE|OEM|OEN)$/i.test(description.trim()))) {
                description = "";
            }

            // APCAT affiche "Achat net" qui est déjà un prix HT
            let price = 0;
            let parentText = parent ? parent.textContent : "";
            let priceMatch = parentText.match(/Achat net\s*:?\s*([\d,.\s]+)(?:EUR)?/i) ||
                parentText.match(/(\d+[\.,]\d{2})\s*(?:EUR|€)/i);
            if (priceMatch) {
                price = cleanPriceNumber(priceMatch[1]);
            } else {
                price = parsePriceFromText(parentText);
            }

            items.push({
                reference: reference,
                group: group,
                description: cleanShortProductName(description, group) || group || 'Article',
                quantity: qty,
                price: price
            });
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
                showToast('Aucun article trouvé dans le panier APCAT.', 'warning');
                return;
            }
            GM_setValue('apcat_cart_data', data);
            let details = data.items.map(it => `• [${it.reference}] ${it.group ? it.group + ' - ' : ''}${it.description} (Qté: ${it.quantity}, Prix HT: ${it.price.toFixed(2)} €)`).join('\n');
            let hasZero = data.items.some(it => it.price <= 0);
            let warn = hasZero ? '\n\n⚠️ Attention : Certains prix sont à 0.00 € (vérifiez qu\'ils sont affichés sur APCAT).' : '';
            showToast(`🚀 ${data.items.length} article(s) APCAT exporté(s) :\n\n${details}${warn}\n\n👉 Sur GKR, cliquez sur "Importer APCAT".`, 'success', 7000);
        });

        panel.insertBefore(btn, panel.firstChild);
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
        let descText = brand && name ? `${brand} - ${name}` : (brand || name || 'Article');

        let qty = item.quantity || 1;
        let priceHT = typeof item.price === 'number' ? item.price : parseFloat(String(item.price).replace(',', '.')) || 0;
        let formattedPriceHT = priceHT.toFixed(2);
        let montantTVAC = (priceHT * qty * 1.21).toFixed(2);

        console.log('[GKR Linker APCAT] Remplissage ligne =>', {
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

        // 5. Montant TVAC (Col 10) - Colonne finale du bon non-fiscal
        if (montantInput && priceHT > 0) {
            setInputValue(montantInput, montantTVAC);
            await sleep(80);
        }
    }

    async function importItem(item) {
        let buttons = document.querySelectorAll('button');
        let diversBtn = Array.from(buttons).find(b => b.textContent.includes('Produit divers'));
        if (!diversBtn) {
            console.warn('[GKR Linker] Bouton "Produit divers" non trouvé !');
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
        if (document.getElementById('gkr-import-apcat-btn')) return;

        // Bouton Import APCAT (Vert)
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
                    showToast('Aucune donnée APCAT enregistrée. Cliquez d\'abord sur "Copier mon panier APCAT vers GKR" dans APCAT.', 'warning');
                    return;
                }
                await importItems(data);
                showToast(`🎉 Panier APCAT (${data.items.length} articles) importé avec succès !`, 'success', 5000);
            } catch (e) {
                console.error(e);
                showToast('Erreur lors de l\'import APCAT: ' + e.message, 'error', 6000);
            } finally {
                btnApcat.disabled = false;
                btnApcat.textContent = '📥 Importer APCAT';
            }
        });

        diversBtn.parentNode.insertBefore(btnApcat, diversBtn.nextSibling);
    }

    // --- Boucle d'injection dynamique ---
    setInterval(() => {
        let host = window.location.host;
        if (host.includes('carparts-cat.com') || host.includes('apcat.eu')) {
            addApcatExportButton();
        } else if (host.includes('gkr.be')) {
            addGkrImportButton();
        }
    }, 1000);

})();
