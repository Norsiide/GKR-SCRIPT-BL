// ==UserScript==
// @name         APCAT to Norsiide Products Importer
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  Importation automatique 1-clic depuis la fiche article APCAT vers le modal Nouveau Produit (#modalProduct) de GKR Norsiide avec ciblage direct par IDs exacts (#product_name, #product_reference, #product_brand_search, #product_sale_price, #product_oem_reference, #product_barcode, #product_type_select, etc.)
// @author       Norsiide
// @match        https://apcat.eu/*
// @match        https://*.carparts-cat.com/*
// @match        https://gkr.norsiide.be/*
// @match        https://*.norsiide.be/*
// @match        https://norsiide.be/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const NORSIIDE_PRODUCTS_URL = 'https://gkr.norsiide.be/products';
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // =========================================================================
    //  DICTIONNAIRE DE MARQUES AUTOMOBILES & PNEUMATIQUES
    // =========================================================================
    const KNOWN_BRANDS = [
        'BOSCH', 'VALEO', 'MANN-FILTER', 'MANN', 'FEBI BILSTEIN', 'FEBI', 'BILSTEIN',
        'BREMBO', 'TRW', 'ATE', 'CORTECO', 'ELRING', 'SKF', 'FAG', 'INA',
        'RIDEX', 'STARK', 'SACHS', 'MONROE', 'LUK', 'CONTITECH', 'GATES', 'DAYCO',
        'HENGST FILTER', 'HENGST', 'MAHLE', 'PURFLUX', 'DELPHI', 'DENSO', 'NGK', 'BERU', 'TEXTAR',
        'FERODO', 'ZIMMERMANN', 'KYB', 'KAYABA', 'LEMFORDER', 'LEMFÖRDER', 'SWAG',
        'MEYLE', 'LEMA', 'MOOG', 'DT', 'AJUSA', 'BOSAL', 'WALKER', 'HELLA', 'PIERBURG',
        'FACET', 'METZGER', 'SASIC', 'QUINTON HAZELL', 'VAICO', 'VEMO', 'SNR', 'NTN',
        'BLUE PRINT', 'HERTH+BUSS', 'JAPKO', 'ASHIKA', 'JAPANPARTS', 'TOPRAN', 'OPTIMAL',
        'KOLBENSCHMIDT', 'FILTRON', 'MAXGEAR', 'PSA', 'CITROEN', 'CITROËN', 'PEUGEOT', 'RENAULT',
        'CONTINENTAL', 'MICHELIN', 'GOODYEAR', 'BRIDGESTONE', 'PIRELLI', 'DUNLOP',
        'HANKOOK', 'NOKIAN', 'KUMHO', 'FALKEN', 'TOYO', 'YOKOHAMA', 'NEXEN', 'VREDESTEIN',
        'UNIROYAL', 'FIRESTONE', 'BARUM', 'KLEBER', 'BFGOODRICH', 'SEMPERIT', 'MAXXIS'
    ];

    // Détection stricte des mentions logistiques/dépôt/hub à BANNIR des références et noms
    function isLogisticsString(str) {
        if (!str) return false;
        let s = String(str).toUpperCase();
        return (
            s.includes('HUB') ||
            s.includes('--->') ||
            s.includes('-->') ||
            /\b\d{1,2}H\b/.test(s) || // 24h, 48h, 72h
            s.includes('LIVRAISON') ||
            s.includes('EXPÉDITION') ||
            s.includes('EXPEDITION') ||
            s.includes('DÉPÔT') ||
            s.includes('DEPOT') ||
            s.includes('EN STOCK') ||
            s.includes('DISPONIBILITÉ') ||
            s.includes('DISPONIBILITE') ||
            /\bAPCAT\s*R\d+/i.test(s) ||
            /\bR\d+\.\d+\b/i.test(s)
        );
    }

    // =========================================================================
    //  NOTIFICATIONS TOASTER MODERNES
    // =========================================================================
    function showToast(message, type = 'info', duration = 5000) {
        let container = document.getElementById('norsiide-import-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'norsiide-import-toast-container';
            container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999999; display: flex; flex-direction: column; gap: 10px; max-width: 440px; pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.style.cssText = 'pointer-events: auto; display: flex; align-items: flex-start; gap: 12px; padding: 14px 18px; border-radius: 10px; color: #ffffff; font-size: 13.5px; line-height: 1.45; box-shadow: 0 8px 24px rgba(0,0,0,0.25); opacity: 0; transform: translateX(40px) scale(0.95); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); backdrop-filter: blur(8px); word-break: break-word; white-space: pre-line;';

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
            bg = 'linear-gradient(135deg, #0d6efd, #0b5ed7)';
            icon = '📥';
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

    // =========================================================================
    //  FONCTIONS D'EXTRACTION & NORMALISATION
    // =========================================================================

    function cleanReferenceCode(ref) {
        if (!ref) return "";
        let clean = String(ref).replace(/[\u00a0\u202F\r\n\t]+/g, ' ').trim();
        clean = clean.replace(/^(?:art(?:icle)?\.?|r[ée]f(?:[ée]rence)?\.?|code|n[o°]?\.?|num[ée]ro\s+d['’]article)\s*:?\s*/i, '');
        clean = clean.replace(/\s+(?:EUR|€|\$)\s*$/i, '');
        clean = clean.replace(/^["'«»`]+|["'«»`]+$/g, '').trim();
        clean = clean.replace(/\s{2,}/g, ' ').trim();
        if (isLogisticsString(clean)) return "";
        return clean;
    }

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

    // Suppression stricte et absolue de la marque dans le nom du produit
    function stripBrandFromText(text, brand = '') {
        if (!text) return '';
        let clean = String(text).replace(/[\u00a0\u202F]/g, ' ').trim();

        // 1. Si une marque spécifique est connue
        if (brand) {
            let escaped = brand.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            clean = clean.replace(new RegExp('^\\s*' + escaped + '\\s*[-–:;,/|]*\\s*', 'i'), '');
            clean = clean.replace(new RegExp('\\s*[-–:;,/|]*\\s*' + escaped + '\\s*$', 'i'), '');
            clean = clean.replace(new RegExp('\\b' + escaped + '\\b', 'gi'), '');
        }

        // 2. Vérification contre toutes les marques du dictionnaire
        for (let b of KNOWN_BRANDS) {
            let escaped = b.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            clean = clean.replace(new RegExp('^\\s*' + escaped + '\\s*[-–:;,/|]*\\s*', 'i'), '');
            clean = clean.replace(new RegExp('\\s*[-–:;,/|]*\\s*' + escaped + '\\s*$', 'i'), '');
            clean = clean.replace(new RegExp('\\b' + escaped + '\\b', 'gi'), '');
        }

        // 3. Nettoyer les délimiteurs restants
        clean = clean.replace(/\s+/g, ' ').replace(/^[-–:;,./|\s]+|[-–:;,./|\s]+$/g, '').trim();
        return clean;
    }

    function setNativeValue(input, value) {
        if (!input || value === undefined || value === null) return false;
        try {
            input.focus();

            let stringVal = String(value);
            if (typeof value === 'number') {
                stringVal = Number.isInteger(value) ? String(value) : value.toFixed(2);
            }

            try {
                if (typeof input.select === 'function') input.select();
            } catch (e) {}

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

            input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: stringVal }));
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            input.dispatchEvent(new FocusEvent('blur', { bubbles: true, composed: true }));
            return true;
        } catch (e) {
            console.error('[Norsiide setNativeValue error]', e);
            try {
                input.value = String(value);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            } catch (err) {}
        }
        return false;
    }

    // =========================================================================
    //  PARTIE 1 : CÔTÉ APCAT (apcat.eu / *.carparts-cat.com)
    // =========================================================================
    const isApcat = window.location.host.includes('apcat.eu') || window.location.host.includes('carparts-cat.com');

    if (isApcat) {
        console.log('[APCAT -> Norsiide] 🚀 Script v4.5 actif sur APCAT');

        // Extraction depuis la vue principale d'un article (#ad_pkw_1)
        function extractFromArticleView() {
            const articlePanel = document.getElementById('ad_pkw_1') || document.querySelector('.ad_pkw_main');
            if (!articlePanel) return null;

            console.log('[APCAT Linker] 🔍 Extraction depuis #ad_pkw_1...');

            let brand = "";
            let reference = "";
            let description = "";
            let price = 0;
            let oemList = [];
            let ean = "";
            let imageUrl = "";
            let kriterienText = [];

            // 1. Titre (#ad_pkw_6 span : "BOSCH - 1457429193 - Filtre à huile - FILTRE À HUILE")
            const titleSpan = articlePanel.querySelector('#ad_pkw_6 span') || articlePanel.querySelector('.tbl_title span');
            if (titleSpan && titleSpan.textContent) {
                const parts = titleSpan.textContent.split(' - ').map(s => s.trim()).filter(Boolean);
                if (parts.length >= 3) {
                    brand = parts[0];
                    reference = cleanReferenceCode(parts[1]);
                    description = parts[2];
                } else if (parts.length === 2) {
                    brand = parts[0];
                    reference = cleanReferenceCode(parts[1]);
                } else if (parts.length === 1) {
                    description = parts[0];
                }
            }

            // Retirer systématiquement la marque de la description
            description = stripBrandFromText(description, brand);

            // 2. Table générale (#ad_tbl_main_allg_info)
            const allgTable = articlePanel.querySelector('#ad_tbl_main_allg_info');
            if (allgTable) {
                const refFabEl = allgTable.querySelector('.Art_Nummer_in_Vergleich_pnl span');
                if (refFabEl && !reference) {
                    reference = cleanReferenceCode(refFabEl.textContent);
                }
                const refGrossisteEl = allgTable.querySelector('.colorClass_HaendlerArtNr span');
                if (refGrossisteEl && !reference) {
                    reference = cleanReferenceCode(refGrossisteEl.textContent);
                }
                const eanEl = allgTable.querySelector('.ad_ean_pnl span');
                if (eanEl && eanEl.textContent) {
                    let m = eanEl.textContent.match(/\b\d{13}\b/);
                    if (m) ean = m[0];
                }
            }

            // 3. Table des prix (#ad_tbl_wawi_info, spans pricefiltercat, et champs cachés)
            const wawiTable = articlePanel.querySelector('#ad_tbl_wawi_info') || document.getElementById('ad_tbl_wawi_info');
            if (wawiTable) {
                const rows = Array.from(wawiTable.querySelectorAll('tr'));
                for (let r of rows) {
                    let tds = r.querySelectorAll('td');
                    if (tds.length >= 2) {
                        let label = (tds[0].textContent || '').trim().toLowerCase();
                        let val = (tds[1].textContent || '').trim();
                        if (label.includes('achat net')) {
                            let m = val.match(/([0-9]+(?:[,\.][0-9]{1,2})?)/);
                            if (m) {
                                price = cleanPriceNumber(m[1]);
                                if (price > 0) break;
                            }
                        }
                    }
                    let text = (r.textContent || '').trim();
                    if (/achat\s*net/i.test(text)) {
                        let m = text.match(/achat\s*net.*?([0-9]+(?:[,\.][0-9]{1,2})?)/i);
                        if (m) {
                            price = cleanPriceNumber(m[1]);
                            if (price > 0) break;
                        }
                    }
                }
            }

            // Fallback 1 : Attribut officiel Carparts-Cat pour prix d'achat net (pricefiltercat="5")
            if (price <= 0) {
                let catSpans = Array.from((articlePanel || document).querySelectorAll('span[pricefiltercat="5"]'));
                for (let sp of catSpans) {
                    let text = (sp.textContent || '').trim();
                    if (text && !/achat/i.test(text)) {
                        let m = text.match(/([0-9]+(?:[,\.][0-9]{1,2})?)/);
                        if (m) {
                            let p = cleanPriceNumber(m[1]);
                            if (p > 0) {
                                price = p;
                                break;
                            }
                        }
                    }
                }
            }

            // Fallback 2 : Champs ERP cachés (ad_wsvc_erp_*_hf1)
            if (price <= 0) {
                let erpInputs = Array.from((articlePanel || document).querySelectorAll('input[id*="hf1"], input[type="hidden"]'));
                for (let inp of erpInputs) {
                    let val = inp.value || '';
                    if (val.includes('Achat net#')) {
                        let m = val.match(/Achat\s*net#([0-9]+(?:[,\.][0-9]{1,2})?)/i);
                        if (m) {
                            let p = cleanPriceNumber(m[1]);
                            if (p > 0) {
                                price = p;
                                break;
                            }
                        }
                    }
                }
            }

            // Fallback 3 : Regex sur le HTML brut du panneau
            if (price <= 0 && articlePanel) {
                let m = articlePanel.innerHTML.match(/Achat\s*net.*?([0-9]+[,\.][0-9]{2})\s*(?:EUR|€)?/i);
                if (m) {
                    price = cleanPriceNumber(m[1]);
                }
            }

            // 4. Numéros OE (#ad_tbl_oenr)
            const oeLinks = articlePanel.querySelectorAll('#ad_tbl_oenr a.ad_reference_nr span, #ad_tbl_oenr a.ad_reference_nr');
            oeLinks.forEach(el => {
                let code = cleanReferenceCode(el.textContent);
                if (code && !oemList.includes(code)) {
                    oemList.push(code);
                }
            });

            // 5. Caractéristiques techniques (#ad_pnl_artikel_kriterien)
            const kritRows = articlePanel.querySelectorAll('#ad_pnl_artikel_kriterien tr.ad_artlist_row');
            kritRows.forEach(row => {
                let keyEl = row.querySelector('.krit_key span, .krit_key');
                let valEl = row.querySelector('.ad_td_val_alt span, .ad_td_val span, td:last-child span');
                if (keyEl && valEl) {
                    let k = keyEl.textContent.replace(/\u00a0/g, ' ').trim();
                    let v = valEl.textContent.replace(/\u00a0/g, ' ').trim();
                    if (k && v) kriterienText.push(`${k}: ${v}`);
                }
            });

            // 6. Image (#ad_img_main_picture)
            const mainImg = articlePanel.querySelector('#ad_img_main_picture');
            if (mainImg) {
                let src = mainImg.getAttribute('src') || '';
                if (src && !src.includes('transparent_1x1')) {
                    imageUrl = src.startsWith('http') ? src : window.location.origin + '/' + src.replace(/^\/+/, '');
                }
            }

            if (!reference) {
                console.warn('[APCAT Linker] Aucune référence trouvée dans la vue article.');
                return null;
            }

            return {
                reference: reference,
                brand: brand,
                description: description || 'Pièce détachée',
                price: price,
                oem: oemList.join('\n'),
                ean: ean,
                image_url: imageUrl,
                remarks: kriterienText.length > 0 ? `Caractéristiques :\n` + kriterienText.slice(0, 10).join('\n') : '',
                supplier: 'APCAT',
                timestamp: Date.now()
            };
        }

        // Extraction alternative (.alternativ_tr)
        function extractFromAlternativeRow(tr) {
            if (!tr) return null;
            let reference = "";
            let brand = "";
            let description = "";
            let price = 0;

            const nrCell = tr.querySelector('.article_nr_cell');
            if (nrCell) {
                let links = Array.from(nrCell.querySelectorAll('a'));
                let refFab = links.find(a => (a.getAttribute('title') || '').toLowerCase().includes('n° article'));
                let refGrossiste = links.find(a => (a.getAttribute('title') || '').toLowerCase().includes('grossiste'));
                if (refFab && refFab.textContent) {
                    reference = cleanReferenceCode(refFab.textContent);
                } else if (refGrossiste && refGrossiste.textContent) {
                    reference = cleanReferenceCode(refGrossiste.textContent);
                } else {
                    let firstNobr = nrCell.querySelector('nobr');
                    if (firstNobr) reference = cleanReferenceCode(firstNobr.textContent);
                }
            }

            const descrCell = tr.querySelector('.article_descr_cell');
            if (descrCell) {
                let htmlParts = descrCell.innerHTML.split(/<hr\s*\/?>|<br\s*\/?>/i).map(s => {
                    let d = document.createElement('div');
                    d.innerHTML = s;
                    return d.textContent.trim();
                }).filter(Boolean);

                if (htmlParts.length >= 2) {
                    brand = htmlParts[0];
                    description = htmlParts[1];
                } else if (htmlParts.length === 1) {
                    description = htmlParts[0];
                }
            }

            if (!brand) {
                for (let b of KNOWN_BRANDS) {
                    let regex = new RegExp('\\b' + b.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
                    if (regex.test(tr.textContent)) {
                        brand = b;
                        break;
                    }
                }
            }

            const priceCell = tr.querySelector('.article_price_cell');
            if (priceCell) {
                let m = priceCell.textContent.match(/Achat\s*net\s*:?\s*([0-9]+(?:[,\.][0-9]{1,2})?)/i);
                if (m) price = cleanPriceNumber(m[1]);
            }
            if (price <= 0) {
                const hiddenErp = tr.querySelector('input[id*="hf1"]');
                if (hiddenErp && hiddenErp.value) {
                    let m = hiddenErp.value.match(/Achat\s*net#([0-9]+(?:[,\.][0-9]{1,2})?)/i);
                    if (m) price = cleanPriceNumber(m[1]);
                }
            }

            description = stripBrandFromText(description, brand);
            if (!reference) return null;

            return {
                reference: reference,
                brand: brand,
                description: description || 'Pièce détachée',
                price: price,
                oem: '',
                ean: '',
                image_url: '',
                remarks: '',
                supplier: 'APCAT',
                timestamp: Date.now()
            };
        }

        // Envoi du produit vers Norsiide
        function sendProductToNorsiide(data) {
            if (!data || !data.reference) {
                showToast('Impossible d\'extraire les données de cet article.', 'error');
                return;
            }

            const payload = {
                id: 'import_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                reference: data.reference,
                brand: data.brand || '',
                description: data.description || '',
                price: data.price || 0,
                oem: data.oem || '',
                ean: data.ean || '',
                image_url: data.image_url || '',
                remarks: data.remarks || '',
                supplier: 'APCAT',
                quantity: 1,
                timestamp: Date.now(),
                consumed: false
            };

            GM_setValue('norsiide_import_payload', payload);
            console.log('[APCAT -> Norsiide] 📤 Données envoyées :', payload);

            let cleanDesc = (data.description || '').trim();
            if (data.brand) {
                const escapedBrand = data.brand.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                cleanDesc = cleanDesc.replace(new RegExp('^' + escapedBrand + '\\s*[-–:]?\\s*', 'i'), '');
                cleanDesc = cleanDesc.replace(new RegExp('\\b' + escapedBrand + '\\b', 'gi'), ' ');
                cleanDesc = cleanDesc.replace(/\s+/g, ' ').replace(/^[-–:;,.\s]+|[-–:;,.\s]+$/g, '').trim();
            }
            if (!cleanDesc) cleanDesc = data.description || data.reference;

            const priceStr = data.price > 0 ? `${data.price.toFixed(2)} € HT` : '0.00 € HT';

            showToast(
                `🚀 Article envoyé vers Norsiide !\n\n• Code (SKU) : ${data.reference}\n• Désignation : ${cleanDesc}\n• Marque : ${data.brand || 'Non spécifiée'}\n• Prix d'achat : ${priceStr}\n\n👉 Redirection vers gkr.norsiide.be/products...`,
                'success',
                6000
            );

            const lastActiveTs = GM_getValue('norsiide_tab_active_ts', 0);
            const isNorsiideOpen = (Date.now() - lastActiveTs) < 300000;

            if (isNorsiideOpen) {
                console.log('[APCAT -> Norsiide] ⚡ Onglet Norsiide déjà actif, signal envoyé.');
                GM_setValue('norsiide_navigate_target', {
                    url: NORSIIDE_PRODUCTS_URL,
                    timestamp: Date.now(),
                    consumed: false
                });
            } else {
                console.log('[APCAT -> Norsiide] 🌐 Ouverture du catalogue Norsiide...');
                window.open(NORSIIDE_PRODUCTS_URL, '_blank');
            }
        }

        // Injection des boutons sur APCAT
        function injectApcatButtons() {
            // Retirer le bouton de pnl_toolbar si présent
            const oldToolbarBtn = document.getElementById('tb_btn_norsiide_main_import');
            if (oldToolbarBtn) oldToolbarBtn.remove();

            // 1. Bouton dans le titre en haut à droite (#ad_pkw_7 .title_right_pnl)
            const titleRightPnl = document.querySelector('#ad_pkw_7 .title_right_pnl') || document.querySelector('#ad_pkw_3 .title_right_pnl');
            if (titleRightPnl && !document.getElementById('title_btn_norsiide_import')) {
                const titleBtn = document.createElement('button');
                titleBtn.id = 'title_btn_norsiide_import';
                titleBtn.type = 'button';
                titleBtn.title = 'Importer cet article dans le catalogue Norsiide';
                titleBtn.style.cssText = `
                    margin-right: 12px;
                    padding: 5px 12px;
                    background: linear-gradient(135deg, #0d6efd, #0b5ed7);
                    color: #ffffff;
                    border: none;
                    border-radius: 6px;
                    font-size: 12.5px;
                    font-weight: bold;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    vertical-align: middle;
                    box-shadow: 0 2px 5px rgba(13, 110, 253, 0.35);
                    transition: all 0.2s ease-in-out;
                `;
                titleBtn.innerHTML = `📥 Importer sur Norsiide`;
                titleBtn.onmouseover = () => {
                    titleBtn.style.background = 'linear-gradient(135deg, #0b5ed7, #0a58ca)';
                    titleBtn.style.transform = 'translateY(-1px)';
                };
                titleBtn.onmouseout = () => {
                    titleBtn.style.background = 'linear-gradient(135deg, #0d6efd, #0b5ed7)';
                    titleBtn.style.transform = 'translateY(0)';
                };
                titleBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const data = extractFromArticleView();
                    if (data) sendProductToNorsiide(data);
                };
                titleRightPnl.insertBefore(titleBtn, titleRightPnl.firstChild);
            }

            // 2. Boutons sur chaque ligne alternative (#alternativ_table .alternativ_tr)
            const altRows = document.querySelectorAll('#alternativ_table tr.alternativ_tr, ._alternativ_Tbl tr.alternativ_tr');
            altRows.forEach(row => {
                if (row.querySelector('.norsiide-alt-import-btn')) return;

                const nrCell = row.querySelector('.article_nr_cell') || row.querySelector('td:nth-child(6)');
                if (nrCell) {
                    const btn = document.createElement('button');
                    btn.className = 'norsiide-alt-import-btn';
                    btn.type = 'button';
                    btn.title = 'Importer cet article alternatif sur Norsiide';
                    btn.style.cssText = `
                        display: block;
                        margin-top: 4px;
                        padding: 3px 8px;
                        background: linear-gradient(135deg, #0d6efd, #0b5ed7);
                        color: #ffffff;
                        border: none;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: bold;
                        cursor: pointer;
                        box-shadow: 0 2px 4px rgba(13, 110, 253, 0.3);
                        transition: 0.2s;
                    `;
                    btn.innerHTML = `📥 Importer sur Norsiide`;
                    btn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const data = extractFromAlternativeRow(row);
                        if (data) {
                            sendProductToNorsiide(data);
                        } else {
                            showToast('Impossible de lire les données de cette ligne alternative.', 'error');
                        }
                    };
                    nrCell.appendChild(btn);
                }
            });
        }

        injectApcatButtons();
        setInterval(injectApcatButtons, 1500);
        const observer = new MutationObserver(() => injectApcatButtons());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // =========================================================================
    //  PARTIE 2 : CÔTÉ NORSIIDE (https://gkr.norsiide.be/*)
    // =========================================================================
    const isNorsiide = window.location.host.includes('gkr.norsiide.be') || window.location.host.includes('norsiide.be');

    if (isNorsiide) {
        console.log('[APCAT -> Norsiide] 🚀 Script v4.5 actif sur GKR Norsiide');

        function pingNorsiideTab() {
            GM_setValue('norsiide_tab_opened', true);
            GM_setValue('norsiide_tab_active_ts', Date.now());
        }
        pingNorsiideTab();
        setInterval(pingNorsiideTab, 2000);
        window.addEventListener('focus', pingNorsiideTab);
        window.addEventListener('click', pingNorsiideTab);

        function checkNavigateTarget() {
            let target = GM_getValue('norsiide_navigate_target', null);
            if (target && target.url && !target.consumed && (Date.now() - target.timestamp < 10000)) {
                target.consumed = true;
                GM_setValue('norsiide_navigate_target', target);
                if (window.location.href !== target.url && !window.location.pathname.includes('/products')) {
                    console.log('[Norsiide] 🚀 Navigation reçue vers :', target.url);
                    window.location.href = target.url;
                }
            }
        }
        checkNavigateTarget();
        setInterval(checkNavigateTarget, 1000);

        // Détection exacte du modal "modalProduct"
        function getNouveauProduitModal() {
            const modal = document.getElementById('modalProduct');
            if (modal && (modal.classList.contains('active') || modal.style.display !== 'none')) {
                return modal;
            }

            let allModals = Array.from(document.querySelectorAll('.modal-overlay.active, .modal.active, [id*="modalProduct" i], [id*="productForm" i]'));
            if (allModals.length > 0) return allModals[0];

            return modal; // Retourne l'élément même s'il n'est pas encore actif
        }

        // Déclencheur pour ouvrir le modal s'il est fermé
        function openProductModalIfNeeded() {
            const modal = document.getElementById('modalProduct');
            if (!modal || !modal.classList.contains('active')) {
                if (typeof window.openModal === 'function') {
                    window.openModal('modalProduct');
                    return true;
                }
                let allButtons = Array.from(document.querySelectorAll('button, a.btn, a[role="button"], [class*="btn"]'));
                let addBtn = allButtons.find(b => {
                    let txt = (b.textContent || '').trim().toLowerCase();
                    let full = `${txt} ${(b.getAttribute('title') || '')}`;
                    return full.includes('nouveau produit') || full.includes('ajouter un produit') || (full.includes('produit') && full.includes('+'));
                });
                if (addBtn) {
                    addBtn.click();
                    return true;
                }
            }
            return false;
        }

        // =====================================================================
        // REMPLISSAGE PARFAIT DU FORMULAIRE #productForm (CIBLAGE PAR IDS EXACTS)
        // =====================================================================
        function fillProductForm(data) {
            if (!data || !data.reference) return 0;
            console.log('[Norsiide Injector] 🚀 Injection ciblée dans #productForm...', data);

            let filledCount = 0;

            // Nettoyage de la désignation pour retirer absolument la marque du Nom du Produit
            let cleanDesignation = stripBrandFromText(data.description, data.brand);
            if (!cleanDesignation) cleanDesignation = data.reference;

            const priceHT = typeof data.price === 'number' ? data.price : parseFloat(String(data.price).replace(',', '.')) || 0;

            // 1. NOM DU PRODUIT / DÉSIGNATION (#product_name) - STRICTEMENT SANS LA MARQUE
            const nameInput = document.getElementById('product_name');
            if (nameInput) {
                setNativeValue(nameInput, cleanDesignation);
                filledCount++;
            }

            // 2. RÉFÉRENCE INTERNE SKU (#product_reference)
            const refInput = document.getElementById('product_reference');
            if (refInput && data.reference) {
                if (setNativeValue(refInput, data.reference)) filledCount++;
            }

            // 3. MARQUE (#product_brand_search & #product_brand)
            const brandSearch = document.getElementById('product_brand_search');
            const brandHidden = document.getElementById('product_brand');
            if (brandSearch && data.brand) {
                setNativeValue(brandSearch, data.brand);
                filledCount++;

                // Ouvrir et filtrer le sélecteur personnalisé pour sélectionner l'ID réel
                if (typeof window.openCustomSelect === 'function') {
                    try { window.openCustomSelect('brand'); } catch (e) {}
                }
                if (typeof window.filterCustomSelect === 'function') {
                    try { window.filterCustomSelect('brand', data.brand); } catch (e) {}
                }

                // Essayer de cliquer sur l'option exacte dans le dropdown
                setTimeout(() => {
                    const dropdown = document.getElementById('product_brand_dropdown');
                    if (dropdown) {
                        const items = Array.from(dropdown.querySelectorAll('div, a, button, [onclick*="selectCustomOption"]'));
                        const exactMatch = items.find(el => el.textContent.trim().toUpperCase() === data.brand.toUpperCase());
                        if (exactMatch) {
                            exactMatch.click();
                        } else if (items.length > 0) {
                            items[0].click();
                        }
                    }
                }, 150);
            }

            // 4. RÉFÉRENCE(S) OEM (#product_oem_reference)
            const oemInput = document.getElementById('product_oem_reference');
            if (oemInput && data.oem) {
                if (setNativeValue(oemInput, data.oem)) filledCount++;
            }

            // 5. CODE-BARRES EAN (#product_barcode)
            const barcodeInput = document.getElementById('product_barcode');
            if (barcodeInput && data.ean) {
                if (setNativeValue(barcodeInput, data.ean)) filledCount++;
            }

            // 6. PRIX HT (€) (#product_sale_price)
            const priceInput = document.getElementById('product_sale_price');
            if (priceInput && priceHT > 0) {
                if (setNativeValue(priceInput, priceHT.toFixed(2))) {
                    filledCount++;
                    // Appel de la fonction native de calcul TTC
                    if (typeof window.calcProductTtc === 'function') {
                        try { window.calcProductTtc(); } catch (e) {}
                    }
                }
            }

            // 7. PRIX TVAC (€) (#product_sale_price_ttc)
            const priceTtcInput = document.getElementById('product_sale_price_ttc');
            if (priceTtcInput && priceHT > 0) {
                const ttc = (priceHT * 1.21).toFixed(2);
                if (!priceTtcInput.value || parseFloat(priceTtcInput.value) <= 0) {
                    setNativeValue(priceTtcInput, ttc);
                }
            }

            // 8. STOCK ACTUEL (#product_stock_quantity)
            const stockInput = document.getElementById('product_stock_quantity');
            if (stockInput) {
                if (setNativeValue(stockInput, '1')) filledCount++;
            }

            // 9. IMAGE DU PRODUIT (#product_image_path)
            const imageInput = document.getElementById('product_image_path');
            if (imageInput && data.image_url) {
                if (setNativeValue(imageInput, data.image_url)) filledCount++;
            }

            // 10. DESCRIPTION / REMARQUES (#product_description)
            const descInput = document.getElementById('product_description');
            if (descInput) {
                let note = `Fournisseur : APCAT`;
                if (data.remarks) note += `\n${data.remarks}`;
                if (!descInput.value) {
                    setNativeValue(descInput, note);
                }
            }

            console.log(`[Norsiide Injector] ✅ Injection terminée : ${filledCount} champs remplis avec succès.`);
            return filledCount;
        }

        // Widget d'assistance flottant
        function showFloatingImportHelper(data) {
            let existing = document.getElementById('norsiide-import-helper-box');
            if (existing) existing.remove();

            const box = document.createElement('div');
            box.id = 'norsiide-import-helper-box';
            box.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999999;
                background: #0f172a;
                color: #f8fafc;
                border: 2px solid #0d6efd;
                border-radius: 14px;
                padding: 16px 20px;
                box-shadow: 0 16px 36px rgba(0,0,0,0.6);
                max-width: 420px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                backdrop-filter: blur(12px);
                line-height: 1.4;
            `;

            let cleanDesc = (data.description || '').trim();
            if (data.brand) {
                const escapedBrand = data.brand.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                cleanDesc = cleanDesc.replace(new RegExp('^' + escapedBrand + '\\s*[-–:]?\\s*', 'i'), '');
                cleanDesc = cleanDesc.replace(new RegExp('\\b' + escapedBrand + '\\b', 'gi'), ' ');
                cleanDesc = cleanDesc.replace(/\s+/g, ' ').replace(/^[-–:;,.\s]+|[-–:;,.\s]+$/g, '').trim();
            }
            const descStr = cleanDesc || data.reference;
            const priceStr = data.price > 0 ? `${Number(data.price).toFixed(2)} € HT` : '0.00 € HT';

            box.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <strong style="color: #60a5fa; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        📥 Import APCAT en attente
                    </strong>
                    <button id="norsiide-helper-close" style="background: transparent; border: none; color: #94a3b8; font-size: 16px; cursor: pointer; padding: 0 4px;">✕</button>
                </div>
                <div style="background: #1e293b; padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 12px;">
                    <div style="margin-bottom: 4px;"><strong>Code (SKU) :</strong> <span style="color: #fbbf24; font-family: monospace; font-weight: bold; font-size: 14px;">${data.reference}</span></div>
                    <div style="margin-bottom: 4px;"><strong>Désignation :</strong> ${descStr}</div>
                    <div style="margin-bottom: 4px;"><strong>Marque :</strong> ${data.brand || 'Non spécifiée'}</div>
                    <div style="margin-bottom: 4px;"><strong>Prix d'achat :</strong> ${priceStr}</div>
                    ${data.ean ? `<div style="margin-bottom: 4px;"><strong>EAN :</strong> ${data.ean}</div>` : ''}
                    <div><strong>Fournisseur :</strong> APCAT</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; gap: 8px;">
                        <button id="norsiide-helper-fill-btn" style="flex: 2; padding: 10px 14px; background: #0d6efd; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 13px; cursor: pointer; transition: background 0.2s; box-shadow: 0 2px 6px rgba(13, 110, 253, 0.4);">
                            ⚡ Remplir le modal
                        </button>
                        <button id="norsiide-helper-cancel-btn" title="Annuler et supprimer cet import en attente" style="flex: 1; padding: 10px 10px; background: #ef4444; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 12.5px; cursor: pointer; transition: background 0.2s; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.35);">
                            ✕ Annuler
                        </button>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button id="norsiide-copy-code" style="flex: 1; padding: 6px 10px; background: #334155; color: #cbd5e1; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">📋 Code</button>
                        <button id="norsiide-copy-desc" style="flex: 1; padding: 6px 10px; background: #334155; color: #cbd5e1; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">📋 Nom</button>
                        <button id="norsiide-copy-brand" style="flex: 1; padding: 6px 10px; background: #334155; color: #cbd5e1; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">📋 Marque</button>
                        <button id="norsiide-copy-price" style="flex: 1; padding: 6px 10px; background: #334155; color: #cbd5e1; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">📋 Prix</button>
                    </div>
                </div>
            `;

            document.body.appendChild(box);

            // Bouton fermer (croix en haut à droite) : supprime l'import en attente
            box.querySelector('#norsiide-helper-close').onclick = () => {
                GM_setValue('norsiide_import_payload', null);
                lastProcessedPayloadId = null;
                box.remove();
            };

            // Bouton Annuler explicite : supprime l'import en attente
            box.querySelector('#norsiide-helper-cancel-btn').onclick = () => {
                GM_setValue('norsiide_import_payload', null);
                lastProcessedPayloadId = null;
                box.remove();
                showToast('Import APCAT annulé.', 'info', 2000);
            };

            box.querySelector('#norsiide-copy-code').onclick = () => {
                navigator.clipboard.writeText(data.reference);
                showToast(`Code copié : ${data.reference}`, 'success', 2000);
            };

            box.querySelector('#norsiide-copy-desc').onclick = () => {
                navigator.clipboard.writeText(descStr);
                showToast('Désignation copiée !', 'success', 2000);
            };

            box.querySelector('#norsiide-copy-brand').onclick = () => {
                navigator.clipboard.writeText(data.brand || '');
                showToast('Marque copiée !', 'success', 2000);
            };

            box.querySelector('#norsiide-copy-price').onclick = () => {
                let p = data.price > 0 ? Number(data.price).toFixed(2) : '0.00';
                navigator.clipboard.writeText(p);
                showToast(`Prix copié : ${p} €`, 'success', 2000);
            };

            box.querySelector('#norsiide-helper-fill-btn').onclick = async () => {
                openProductModalIfNeeded();
                await sleep(300);
                let count = fillProductForm(data);
                if (count > 0) {
                    showToast(`✅ ${count} champ(s) du modal rempli(s) avec succès !`, 'success');
                } else {
                    showToast('Ouvrez le modal "Nouveau Produit", puis réessayez.', 'warning', 4000);
                }
            };
        }

        // Nettoyage automatique du widget dès que le produit est enregistré/créé
        function setupProductCreationCleanup() {
            const form = document.getElementById('productForm');
            if (form && !form.dataset.importCleanupAttached) {
                form.dataset.importCleanupAttached = 'true';
                form.addEventListener('submit', () => {
                    console.log('[Norsiide Linker] 💾 Formulaire produit soumis ! Nettoyage de l\'import APCAT...');
                    GM_setValue('norsiide_import_payload', null);
                    lastProcessedPayloadId = null;
                    const box = document.getElementById('norsiide-import-helper-box');
                    if (box) box.remove();
                });
            }

            // Écouter le clic sur "Enregistrer le Produit"
            const submitBtn = document.querySelector('#productForm button[type="submit"], #productForm .btn-primary');
            if (submitBtn && !submitBtn.dataset.importCleanupAttached) {
                submitBtn.dataset.importCleanupAttached = 'true';
                submitBtn.addEventListener('click', () => {
                    setTimeout(() => {
                        GM_setValue('norsiide_import_payload', null);
                        lastProcessedPayloadId = null;
                        const box = document.getElementById('norsiide-import-helper-box');
                        if (box) box.remove();
                    }, 400);
                });
            }
        }

        let lastProcessedPayloadId = null;

        async function processImportPayload() {
            setupProductCreationCleanup();
            let payload = GM_getValue('norsiide_import_payload', null);
            if (!payload || !payload.reference) return;

            if (Date.now() - payload.timestamp > 300000) return;

            if (!window.location.pathname.includes('/products')) {
                console.log('[Norsiide Linker] 🔄 Navigation vers /products...');
                window.location.href = NORSIIDE_PRODUCTS_URL;
                return;
            }

            showFloatingImportHelper(payload);

            if (lastProcessedPayloadId === payload.id) {
                const nameInp = document.getElementById('product_name');
                if (nameInp) {
                    if (nameInp.value) {
                        let cleaned = stripBrandFromText(nameInp.value, payload.brand);
                        if (cleaned && cleaned !== nameInp.value) {
                            setNativeValue(nameInp, cleaned);
                        }
                    } else {
                        fillProductForm(payload);
                    }
                }
                const priceInp = document.getElementById('product_sale_price');
                if (priceInp && payload.price > 0 && (!priceInp.value || priceInp.value === '0.00' || priceInp.value === '0')) {
                    let p = typeof payload.price === 'number' ? payload.price : parseFloat(String(payload.price).replace(',', '.')) || 0;
                    if (p > 0) {
                        setNativeValue(priceInp, p.toFixed(2));
                        if (typeof window.calcProductTtc === 'function') {
                            try { window.calcProductTtc(); } catch (e) {}
                        }
                        const ttcInp = document.getElementById('product_sale_price_ttc');
                        if (ttcInp && (!ttcInp.value || parseFloat(ttcInp.value) <= 0)) {
                            ttcInp.value = (p * 1.21).toFixed(2);
                            ttcInp.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                }
                return;
            }

            lastProcessedPayloadId = payload.id;
            console.log('[Norsiide Linker] 📥 Traitement du produit :', payload);

            showToast(
                `📥 Données APCAT reçues : [${payload.reference}]\nOuverture et remplissage de la fiche produit...`,
                'info',
                4000
            );

            openProductModalIfNeeded();

            let attempts = 0;
            const fillInterval = setInterval(() => {
                attempts++;
                let filled = fillProductForm(payload);
                if (filled >= 3 || attempts >= 10) {
                    clearInterval(fillInterval);
                    if (filled > 0) {
                        showToast(`✅ Fiche produit remplie pour [${payload.reference}] !`, 'success');
                    }
                }
            }, 300);
        }

        processImportPayload();
        setInterval(processImportPayload, 1000);

        if (typeof GM_addValueChangeListener === 'function') {
            GM_addValueChangeListener('norsiide_import_payload', function (key, oldVal, newVal) {
                if (newVal && newVal.reference) {
                    processImportPayload();
                }
            });
        }

        const modalWatcher = new MutationObserver(() => {
            let payload = GM_getValue('norsiide_import_payload', null);
            if (!payload || !payload.reference || (Date.now() - payload.timestamp > 300000)) return;

            const nameInp = document.getElementById('product_name');
            if (nameInp) {
                if (nameInp.value) {
                    let cleaned = stripBrandFromText(nameInp.value, payload.brand);
                    if (cleaned && cleaned !== nameInp.value) {
                        setNativeValue(nameInp, cleaned);
                    }
                } else {
                    fillProductForm(payload);
                }
            }

            const priceInp = document.getElementById('product_sale_price');
            if (priceInp && payload.price > 0 && (!priceInp.value || priceInp.value === '0.00' || priceInp.value === '0')) {
                let p = typeof payload.price === 'number' ? payload.price : parseFloat(String(payload.price).replace(',', '.')) || 0;
                if (p > 0) {
                    setNativeValue(priceInp, p.toFixed(2));
                    if (typeof window.calcProductTtc === 'function') {
                        try { window.calcProductTtc(); } catch (e) {}
                    }
                    const ttcInp = document.getElementById('product_sale_price_ttc');
                    if (ttcInp && (!ttcInp.value || parseFloat(ttcInp.value) <= 0)) {
                        ttcInp.value = (p * 1.21).toFixed(2);
                        ttcInp.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }
        });
        modalWatcher.observe(document.body, { childList: true, subtree: true });
    }

})();
