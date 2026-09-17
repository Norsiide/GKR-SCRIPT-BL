// ==UserScript==
// @name         recherche de piece de app.gkr.be à gkr.nsd-services.be
// @namespace    http://tampermonkey.net/
// @version      3.8
// @description  Lit les codes sur app.gkr.be, vérifie sur gkr.nsd-services.be/products avec détection temps réel infaillible de l'onglet ouvert (gestion anti-veille Chrome) et statut de connexion
// @author       norsiide
// @match        *://app.gkr.be/*
// @match        *://*.gkr.be/*
// @match        *://gkr.nsd-services.be/*
// @match        *://*.nsd-services.be/*
// @match        *://nsd-services.be/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @connect      gkr.nsd-services.be
// @connect      nsd-services.be
// @connect      app.gkr.be
// @connect      gkr.be
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const GKR_PRODUCTS_URL = 'https://gkr.nsd-services.be/products';
    const GKR_LOGIN_URL = 'https://gkr.nsd-services.be/login';
    const APP_GKR_LOGIN_URL = 'https://app.gkr.be/auth/supabase/sign-in';

    // =========================================================================
    //  0. GESTION DU SITE NORSIIDE (gkr.nsd-services.be)
    // =========================================================================
    if (window.location.host.includes('gkr.nsd-services.be')) {

        // Maintien en vie de l'état de l'onglet pour app.gkr.be
        function updateNorsiideTabState() {
            GM_setValue('norsiide_tab_opened', true);
            GM_setValue('norsiide_tab_active_ts', Date.now());
        }

        updateNorsiideTabState();
        setInterval(updateNorsiideTabState, 1000);

        window.addEventListener('focus', updateNorsiideTabState);
        window.addEventListener('click', updateNorsiideTabState);

        window.addEventListener('beforeunload', () => {
            GM_setValue('norsiide_tab_active_ts', Date.now() - 3600000);
        });

        // Exécuter l'ordre de redirection UNE SEULE FOIS
        const checkAndExecuteNavigation = () => {
            let target = GM_getValue('norsiide_navigate_target', null);
            if (target && target.url && !target.consumed && (Date.now() - target.timestamp < 6000)) {
                target.consumed = true;
                GM_setValue('norsiide_navigate_target', target);

                console.log('[Norsiide Connector] 🚀 Navigation unique vers :', target.url);
                if (window.location.href !== target.url) {
                    window.location.href = target.url;
                }
            }
        };

        if (typeof GM_addValueChangeListener === 'function') {
            GM_addValueChangeListener('norsiide_navigate_target', function (key, oldVal, newVal, remote) {
                if (newVal && newVal.url && !newVal.consumed) {
                    checkAndExecuteNavigation();
                }
            });
        }

        setInterval(checkAndExecuteNavigation, 500);

        return; // Fin pour Norsiide
    }

    // =========================================================================
    //  COTE GKR (app.gkr.be) : Synchronisation de Session & Signaux
    // =========================================================================

    function markAppGkrActive() {
        let path = window.location.pathname.toLowerCase();
        let href = window.location.href.toLowerCase();

        let isLoginPage = href.includes('/auth/supabase/sign-in') || path.includes('/auth') || path.includes('/sign-in') || path.includes('/login');

        GM_setValue('app_gkr_tab_opened', true);
        GM_setValue('app_gkr_active_ts', Date.now());

        GM_setValue('gkr_user_auth_status', {
            loggedIn: !isLoginPage,
            timestamp: Date.now(),
            lastUrl: window.location.href
        });
    }

    markAppGkrActive();
    setInterval(markAppGkrActive, 1000);

    window.addEventListener('focus', markAppGkrActive);
    window.addEventListener('click', markAppGkrActive);
    window.addEventListener('mousemove', markAppGkrActive);
    window.addEventListener('visibilitychange', () => {
        if (!document.hidden) markAppGkrActive();
    });

    // Détection immédiate de fermeture de l'onglet
    window.addEventListener('beforeunload', () => {
        GM_setValue('app_gkr_tab_opened', false);
        GM_setValue('app_gkr_active_ts', 0);
    });
    window.addEventListener('pagehide', () => {
        GM_setValue('app_gkr_tab_opened', false);
        GM_setValue('app_gkr_active_ts', 0);
    });

    const sleep = ms => new Promise(res => setTimeout(res, ms));

    function normalizeCode(code) {
        if (!code) return "";
        return String(code).replace(/[^a-z0-9]/gi, '').toLowerCase();
    }

    // Redirection vers l'onglet Norsiide
    function redirectToNorsiide(targetUrl, badgeElement) {
        const lastActiveTs = GM_getValue('norsiide_tab_active_ts', 0);
        const isNorsiideOpen = (Date.now() - lastActiveTs) < 300000;

        GM_setValue('norsiide_navigate_target', {
            url: targetUrl,
            timestamp: Date.now(),
            consumed: false
        });

        if (isNorsiideOpen) {
            console.log('[GKR Linker] Onglet ( gkr.nsd-services.be ) actif. Navigation unique envoyée.');
            if (badgeElement) {
                let originalHtml = badgeElement.innerHTML;
                badgeElement.innerHTML = '⚡ Chargé sur ( gkr.nsd-services.be ) !';
                badgeElement.style.backgroundColor = '#cce5ff';
                badgeElement.style.color = '#004085';
                setTimeout(() => {
                    badgeElement.innerHTML = originalHtml;
                    badgeElement.style.backgroundColor = '';
                    badgeElement.style.color = '';
                }, 2000);
            }
        } else {
            console.log('[GKR Linker] Aucun onglet ( gkr.nsd-services.be ) actif. Ouverture d\'une nouvelle page...');
            window.open(targetUrl, '_blank');
        }
    }

    // =========================================================================
    //  1. EXTRACTION DES CODES DU TABLEAU DE LA COMMANDE GKR
    // =========================================================================
    function getCodesFromOrderPage() {
        let items = [];
        let rows = document.querySelectorAll('tbody tr, table tr');

        rows.forEach((row, rowIndex) => {
            let inputs = Array.from(row.querySelectorAll('input'));
            if (inputs.length < 2) return;

            let table = row.closest('table');
            let headerThs = table ? Array.from(table.querySelectorAll('thead th, tr th')) : [];
            let headers = headerThs.map(th => th.textContent.trim().toLowerCase());

            let codeInput = null;
            let descInput = null;
            let oemInput = null;

            // Détection par colonnes TH <-> TD
            let cells = Array.from(row.querySelectorAll('td'));
            cells.forEach((td, colIdx) => {
                let headerText = headers[colIdx] || '';
                let input = td.querySelector('input');
                if (!input) return;

                if (headerText.includes('oem')) {
                    oemInput = input;
                } else if (headerText.includes('code') || headerText.includes('réf') || headerText.includes('ref') || headerText.includes('article') || headerText.includes('numéro') || headerText.includes('sku')) {
                    codeInput = input;
                } else if (headerText.includes('désignation') || headerText.includes('designation') || headerText.includes('description') || headerText.includes('nom')) {
                    descInput = input;
                }
            });

            // Détection par placeholders / attributs
            if (!codeInput || !oemInput) {
                inputs.forEach(inp => {
                    let ph = (inp.placeholder || '').toLowerCase();
                    let aria = (inp.getAttribute('aria-label') || '').toLowerCase();
                    let name = (inp.name || '').toLowerCase();
                    let label = ph + ' ' + aria + ' ' + name;
                    if (!oemInput && label.includes('oem')) {
                        oemInput = inp;
                    } else if (!codeInput && (label.includes('code') || label.includes('réf') || label.includes('ref'))) {
                        codeInput = inp;
                    } else if (!descInput && (label.includes('désignation') || label.includes('designation') || label.includes('description'))) {
                        descInput = inp;
                    }
                });
            }

            // Fallback: 1er champ texte = Code, 2ème = Désignation
            if (!codeInput) {
                let textInputs = inputs.filter(i => (i.type === 'text' || !i.type) && !i.classList.contains('mantine-NumberInput-input') && i.inputMode !== 'decimal' && i.inputMode !== 'numeric');
                if (textInputs.length >= 1) codeInput = textInputs[0];
                if (textInputs.length >= 2) descInput = textInputs[1];
            }

            if (codeInput) {
                let val = codeInput.value.trim();
                let oemVal = oemInput ? oemInput.value.trim() : '';

                // NOUVEAU : Récupération globale des OEM sur la page (peu importe où est le badge)
                if (!oemVal && val) {
                    let allModals = document.querySelectorAll('[onclick*="openViewModal"]');
                    for (let m of allModals) {
                        let onclickStr = m.getAttribute('onclick') || '';

                        // Vérifier si ce modal correspond à NOTRE référence (val)
                        let isMatch = false;
                        let refMatch = onclickStr.match(/"reference"\s*:\s*"([^"]+)"/);
                        if (!refMatch) refMatch = onclickStr.match(/&quot;reference&quot;\s*:\s*&quot;([^&]+)&quot;/);

                        if (refMatch && refMatch[1] && normalizeCode(refMatch[1]) === normalizeCode(val)) {
                            isMatch = true;
                        }

                        if (isMatch) {
                            let oemMatch = onclickStr.match(/"oem_reference"\s*:\s*"([^"]+)"/);
                            if (!oemMatch) oemMatch = onclickStr.match(/&quot;oem_reference&quot;\s*:\s*&quot;([^&]+)&quot;/);

                            if (oemMatch && oemMatch[1] && oemMatch[1] !== "null") {
                                oemVal = oemMatch[1].replace(/\\\//g, '/');
                                break;
                            } else {
                                let arrMatch = onclickStr.match(/"oem_references_array"\s*:\s*\[\s*"([^"]+)"/);
                                if (!arrMatch) arrMatch = onclickStr.match(/&quot;oem_references_array&quot;\s*:\s*\[\s*&quot;([^&]+)&quot;/);
                                if (arrMatch && arrMatch[1]) {
                                    oemVal = arrMatch[1].replace(/\\\//g, '/');
                                    break;
                                }
                            }
                        }
                    }
                }

                if (val && val !== 'Code' && val !== '0') {
                    items.push({
                        reference: val,
                        oemReference: oemVal,
                        description: descInput ? descInput.value.trim() : '',
                        rowElement: row,
                        inputElement: codeInput,
                        rowIndex: rowIndex
                    });
                }
            }
        });

        return items;
    }

    // =========================================================================
    //  2. REQUÊTE SUR https://gkr.nsd-services.be/products & DÉTECTION CONNEXION
    // =========================================================================
    function checkCodeOnGkrNorsiide(ref, originalRef = null) {
        return new Promise((resolve) => {
            const cleanRef = ref.trim();
            const searchUrl = `${GKR_PRODUCTS_URL}?search=${encodeURIComponent(cleanRef)}&query=${encodeURIComponent(cleanRef)}&q=${encodeURIComponent(cleanRef)}`;

            GM_xmlhttpRequest({
                method: "GET",
                url: searchUrl,
                withCredentials: true,
                onload: function (response) {
                    try {
                        let finalUrl = (response.finalUrl || '').toLowerCase();
                        let isAuthRequired = false;

                        if (finalUrl.includes('/login') || finalUrl.includes('/connexion') || response.status === 401 || response.status === 403) {
                            isAuthRequired = true;
                        }

                        if (isAuthRequired) {
                            resolve({
                                reference: cleanRef,
                                found: false,
                                authRequired: true,
                                productUrl: GKR_LOGIN_URL,
                                status: response.status
                            });
                            return;
                        }

                        let html = response.responseText;
                        let parser = new DOMParser();
                        let doc = parser.parseFromString(html, 'text/html');

                        let found = false;
                        let productUrl = null;
                        const normTarget = normalizeCode(cleanRef);
                        const normOriginal = originalRef ? normalizeCode(originalRef) : null;

                        // 1. Recherche dans les lignes ou cartes de gkr.nsd-services.be
                        let rows = Array.from(doc.querySelectorAll('table tbody tr, tr, .product-row, .item-row, .card, [class*="product"]'));
                        for (let row of rows) {
                            let normText = normalizeCode(row.textContent);
                            if (normText.includes(normTarget) || (normOriginal && normText.includes(normOriginal))) {
                                found = true;
                                let link = row.querySelector('a[href*="product"], a[href*="article"], a');
                                if (link) {
                                    let hrefAttr = link.getAttribute('href') || link.href;
                                    if (hrefAttr) {
                                        productUrl = hrefAttr.startsWith('http') ? hrefAttr : ('https://gkr.nsd-services.be' + (hrefAttr.startsWith('/') ? '' : '/') + hrefAttr);
                                    }
                                }
                                break;
                            }
                        }

                        // 2. Recherche globale si présent dans la page
                        if (!found && doc.body) {
                            let bodyText = normalizeCode(doc.body.textContent);
                            let hasNoResult = bodyText.includes('aucunrésultat') || bodyText.includes('aucunproduit') || bodyText.includes('notfound') || bodyText.includes('0produit');

                            if (!hasNoResult && (bodyText.includes(normTarget) || (normOriginal && bodyText.includes(normOriginal)))) {
                                found = true;
                                let allLinks = Array.from(doc.querySelectorAll('a[href*="product"]'));
                                for (let l of allLinks) {
                                    let lText = normalizeCode(l.textContent);
                                    if (lText.includes(normTarget) || (normOriginal && lText.includes(normOriginal))) {
                                        let hrefAttr = l.getAttribute('href') || l.href;
                                        productUrl = hrefAttr.startsWith('http') ? hrefAttr : ('https://gkr.nsd-services.be' + (hrefAttr.startsWith('/') ? '' : '/') + hrefAttr);
                                        break;
                                    }
                                }
                            }
                        }

                        if (!productUrl) {
                            productUrl = searchUrl;
                        }

                        resolve({
                            reference: cleanRef,
                            found: found,
                            authRequired: false,
                            productUrl: productUrl,
                            status: response.status
                        });
                    } catch (e) {
                        resolve({ reference: cleanRef, found: false, authRequired: false, productUrl: searchUrl, error: e.message });
                    }
                },
                onerror: function (err) {
                    resolve({ reference: cleanRef, found: false, authRequired: false, productUrl: searchUrl, error: "Erreur de connexion" });
                }
            });
        });
    }

    // =========================================================================
    //  3. INJECTION DU BADGE CLIQUABLE
    // =========================================================================
    function setRowStatusBadge(rowElement, inputElement, found, productUrl, ref, authRequired) {
        if (!rowElement) return;

        let existingBadge = rowElement.querySelector('.gkr-status-badge');
        if (existingBadge) existingBadge.remove();

        let targetUrl = productUrl || `${GKR_PRODUCTS_URL}?search=${encodeURIComponent(ref)}`;

        let badge = document.createElement('a');
        badge.className = 'gkr-status-badge';
        badge.href = targetUrl;
        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 8px;
            text-decoration: none;
            vertical-align: middle;
            white-space: nowrap;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
            transition: transform 0.15s, box-shadow 0.15s;
        `;
        badge.onmouseover = () => {
            badge.style.transform = 'translateY(-1px)';
            badge.style.boxShadow = '0 3px 6px rgba(0,0,0,0.18)';
        };
        badge.onmouseout = () => {
            badge.style.transform = 'translateY(0)';
            badge.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
        };

        // Au clic : redirection de l'onglet Norsiide
        badge.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            redirectToNorsiide(targetUrl, badge);
        });

        if (authRequired) {
            badge.style.backgroundColor = '#fff3cd';
            badge.style.color = '#856404';
            badge.style.border = '1px solid #ffeeba';
            badge.innerHTML = '🔒 Déconnecté de Norsiide (Se connecter ↗)';
            badge.title = `Votre session sur gkr.nsd-services.be a expiré. Cliquez pour vous connecter.`;
            rowElement.style.backgroundColor = 'rgba(255, 193, 7, 0.08)';
        } else if (found) {
            badge.style.backgroundColor = '#d4edda';
            badge.style.color = '#155724';
            badge.style.border = '1px solid #c3e6cb';
            badge.innerHTML = '✅ En stock (Ouvrir ↗)';
            badge.title = `Cliquer pour charger ${ref} sur votre onglet ( gkr.nsd-services.be )`;
            rowElement.style.backgroundColor = 'rgba(40, 167, 69, 0.05)';
        } else {
            badge.style.backgroundColor = '#f8d7da';
            badge.style.color = '#721c24';
            badge.style.border = '1px solid #f5c6cb';
            badge.innerHTML = '❌ Non trouvé (Chercher ↗)';
            badge.title = `Cliquer pour chercher ${ref} sur votre onglet ( gkr.nsd-services.be )`;
            rowElement.style.backgroundColor = 'rgba(220, 53, 69, 0.05)';
        }

        if (inputElement && inputElement.parentNode) {
            inputElement.parentNode.appendChild(badge);
        } else {
            rowElement.appendChild(badge);
        }
    }

    // =========================================================================
    //  4. BOUTON D'ACTION DANS L'EN-TÊTE DU TABLEAU
    // =========================================================================
    function injectHeaderButton() {
        let buttons = document.querySelectorAll('button');
        let diversBtn = Array.from(buttons).find(b => b.textContent.includes('Produit divers'));

        if (diversBtn && !document.getElementById('gkr-check-norsiide-btn')) {
            let checkBtn = document.createElement('button');
            checkBtn.id = 'gkr-check-norsiide-btn';
            checkBtn.type = 'button';
            checkBtn.textContent = '🔎 Checker sur ( gkr.nsd-services.be )';
            checkBtn.style.cssText = 'margin-left: 8px; padding: 10px 16px; background-color: #6f42c1; color: white; border: none; border-radius: 6px; cursor: pointer; font-family: Roboto, Helvetica, Arial, sans-serif; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); transition: background 0.3s;';
            checkBtn.onmouseover = () => checkBtn.style.backgroundColor = '#59359a';
            checkBtn.onmouseout = () => checkBtn.style.backgroundColor = '#6f42c1';

            checkBtn.addEventListener('click', async () => {
                await runFullCheck(checkBtn);
            });

            diversBtn.parentNode.appendChild(checkBtn);
        }
    }

    // =========================================================================
    //  5. EXÉCUTION DU SCAN SUR LES LIGNES
    // =========================================================================
    async function runFullCheck(btn) {
        let items = getCodesFromOrderPage();

        if (items.length === 0) {
            alert('⚠️ Aucun code trouvé dans le tableau. Ajoutez des articles ou importez votre panier d\'abord.');
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = `⏳ Vérification (0/${items.length})...`;
        }

        let foundCount = 0;
        let authIssueDetected = false;

        for (let i = 0; i < items.length; i++) {
            let it = items[i];
            if (btn) {
                btn.textContent = `⏳ Vérification (${i + 1}/${items.length})...`;
            }

            let checkRes = await checkCodeOnGkrNorsiide(it.reference);

            // Si pas trouvé et oem présent, on tente l'oem
            if (!checkRes.found && !checkRes.authRequired && it.oemReference) {
                let oemRes = await checkCodeOnGkrNorsiide(it.oemReference, it.reference);
                if (oemRes.found || oemRes.authRequired) {
                    checkRes = oemRes;
                }
            }

            if (checkRes.authRequired) {
                authIssueDetected = true;
            } else if (checkRes.found) {
                foundCount++;
            }

            let displayRef = checkRes.found && checkRes.reference !== it.reference ? it.oemReference : it.reference;
            if (!checkRes.found && it.oemReference) {
                displayRef = `${it.reference} (OEM: ${it.oemReference})`;
            }

            setRowStatusBadge(it.rowElement, it.inputElement, checkRes.found, checkRes.productUrl, displayRef, checkRes.authRequired);
            await sleep(200);
        }

        if (btn) {
            btn.disabled = false;
            if (authIssueDetected) {
                btn.textContent = `⚠️ Déconnecté de Norsiide`;
            } else {
                btn.textContent = `✅ Vérifié (${foundCount}/${items.length} trouvés)`;
            }
            setTimeout(() => {
                btn.textContent = '🔎 Checker sur ( gkr.nsd-services.be )';
            }, 5000);
        }
    }

    // --- Boucle d'injection dynamique ---
    setInterval(() => {
        let href = window.location.href;
        if (href.includes('gkr.be') || href.includes('new-order') || href.includes('new-dashboard')) {
            injectHeaderButton();
        }
    }, 1000);

})();
