// ==UserScript==
// @name         GKR - Vérificateur de codes sur GKR Products
// @namespace    http://tampermonkey.net/
// @version      3.7
// @description  Lit les codes sur app.gkr.be, vérifie sur gkr.norsiide.be/products avec détection temps réel infaillible de l'onglet ouvert (gestion anti-veille Chrome) et statut de connexion
// @author       norsiide
// @match        *://app.gkr.be/*
// @match        *://*.gkr.be/*
// @match        *://gkr.norsiide.be/*
// @match        *://*.norsiide.be/*
// @match        *://norsiide.be/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @connect      gkr.norsiide.be
// @connect      norsiide.be
// @connect      app.gkr.be
// @connect      gkr.be
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const GKR_PRODUCTS_URL = 'https://gkr.norsiide.be/products';
    const GKR_LOGIN_URL = 'https://gkr.norsiide.be/login';
    const APP_GKR_LOGIN_URL = 'https://app.gkr.be/auth/supabase/sign-in';

    // =========================================================================
    //  0. GESTION DU SITE NORSIIDE (gkr.norsiide.be)
    // =========================================================================
    if (window.location.host.includes('gkr.norsiide.be')) {

        // Vérification de l'onglet app.gkr.be (avec gestion anti-veille Chrome)
        function isAppGkrTabOpen() {
            let isOpened = GM_getValue('app_gkr_tab_opened', false);
            let lastActiveTs = GM_getValue('app_gkr_active_ts', 0);
            // L'onglet est ouvert si le flag est actif et que le dernier signal date de moins de 5 minutes
            return isOpened && (Date.now() - lastActiveTs < 300000);
        }

        // Vérification du compte connecté
        function isAppGkrLoggedIn() {
            let auth = GM_getValue('gkr_user_auth_status', null);
            if (auth && auth.loggedIn && (Date.now() - auth.timestamp < 3600000 * 12)) {
                return true;
            }
            return false;
        }

        // Mise à jour de l'affichage du badge de statut
        function updateAppGkrAuthBadge() {
            GM_setValue('norsiide_tab_opened', true);
            GM_setValue('norsiide_tab_active_ts', Date.now());

            let badge = document.getElementById('norsiide-gkr-sync-badge');
            if (!badge) {
                badge = document.createElement('a');
                badge.id = 'norsiide-gkr-sync-badge';
                badge.target = '_blank';
                badge.style.cssText = 'position: fixed; bottom: 54px; right: 10px; z-index: 99999; padding: 10px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; box-shadow: rgba(0, 0, 0, 0.25) 0px 2px 8px; font-family: sans-serif; text-decoration: none; cursor: pointer; opacity: 0.95; transition: transform 0.2s, background 0.3s;';
                badge.onmouseover = () => badge.style.transform = 'scale(1.03)';
                badge.onmouseout = () => badge.style.transform = 'scale(1)';
                document.body.appendChild(badge);
            }

            let tabOpen = isAppGkrTabOpen();
            let loggedIn = isAppGkrLoggedIn();

            if (loggedIn && tabOpen) {
                // 🟢 CAS 1 : Compte connecté ET Onglet ouvert
                badge.innerHTML = '🟢 Connecté à APP.GKR.BE (Onglet actif)';
                badge.style.background = 'rgb(40, 167, 69)';
                badge.style.color = 'white';
                badge.href = 'https://app.gkr.be/new-dashboard/new-order';
                badge.title = 'Votre compte est connecté et l\'onglet app.gkr.be est ouvert.';
            } else if (loggedIn && !tabOpen) {
                // 🟡 CAS 2 : Compte connecté MAIS Onglet fermé
                badge.innerHTML = '🟡 APP.GKR.BE (Onglet fermé - Ouvrir ↗)';
                badge.style.background = 'rgb(253, 126, 20)';
                badge.style.color = 'white';
                badge.href = 'https://app.gkr.be/new-dashboard/new-order';
                badge.title = 'Votre compte est connecté mais l\'onglet app.gkr.be est fermé. Cliquez pour l\'ouvrir.';
            } else {
                // 🔴 CAS 3 : Compte déconnecté
                badge.innerHTML = '🔴 Compte déconnecté (Se connecter ↗)';
                badge.style.background = 'rgb(220, 53, 69)';
                badge.style.color = 'white';
                badge.href = APP_GKR_LOGIN_URL;
                badge.title = 'Votre compte app.gkr.be est déconnecté. Cliquez pour vous identifier.';
            }
        }

        updateAppGkrAuthBadge();
        setInterval(updateAppGkrAuthBadge, 1000);

        // Écouteur en temps réel des changements d'état
        if (typeof GM_addValueChangeListener === 'function') {
            GM_addValueChangeListener('app_gkr_tab_opened', updateAppGkrAuthBadge);
            GM_addValueChangeListener('app_gkr_active_ts', updateAppGkrAuthBadge);
            GM_addValueChangeListener('gkr_user_auth_status', updateAppGkrAuthBadge);
        }

        window.addEventListener('focus', updateAppGkrAuthBadge);
        window.addEventListener('click', updateAppGkrAuthBadge);

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
            console.log('[GKR Linker] Onglet ( gkr.norsiide.be ) actif. Navigation unique envoyée.');
            if (badgeElement) {
                let originalHtml = badgeElement.innerHTML;
                badgeElement.innerHTML = '⚡ Chargé sur ( gkr.norsiide.be ) !';
                badgeElement.style.backgroundColor = '#cce5ff';
                badgeElement.style.color = '#004085';
                setTimeout(() => {
                    badgeElement.innerHTML = originalHtml;
                    badgeElement.style.backgroundColor = '';
                    badgeElement.style.color = '';
                }, 2000);
            }
        } else {
            console.log('[GKR Linker] Aucun onglet ( gkr.norsiide.be ) actif. Ouverture d\'une nouvelle page...');
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

            // Détection par colonnes TH <-> TD
            let cells = Array.from(row.querySelectorAll('td'));
            cells.forEach((td, colIdx) => {
                let headerText = headers[colIdx] || '';
                let input = td.querySelector('input');
                if (!input) return;

                if (headerText.includes('code') || headerText.includes('réf') || headerText.includes('ref') || headerText.includes('article') || headerText.includes('numéro') || headerText.includes('sku')) {
                    codeInput = input;
                } else if (headerText.includes('désignation') || headerText.includes('designation') || headerText.includes('description') || headerText.includes('nom')) {
                    descInput = input;
                }
            });

            // Détection par placeholders / attributs
            if (!codeInput) {
                inputs.forEach(inp => {
                    let ph = (inp.placeholder || '').toLowerCase();
                    let aria = (inp.getAttribute('aria-label') || '').toLowerCase();
                    let name = (inp.name || '').toLowerCase();
                    let label = ph + ' ' + aria + ' ' + name;
                    if (!codeInput && (label.includes('code') || label.includes('réf') || label.includes('ref'))) {
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
                if (val && val !== 'Code' && val !== '0') {
                    items.push({
                        reference: val,
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
    //  2. REQUÊTE SUR https://gkr.norsiide.be/products & DÉTECTION CONNEXION
    // =========================================================================
    function checkCodeOnGkrNorsiide(ref) {
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

                        // 1. Recherche dans les lignes ou cartes de gkr.norsiide.be
                        let rows = Array.from(doc.querySelectorAll('table tbody tr, tr, .product-row, .item-row, .card, [class*="product"]'));
                        for (let row of rows) {
                            let normText = normalizeCode(row.textContent);
                            if (normText.includes(normTarget)) {
                                found = true;
                                let link = row.querySelector('a[href*="product"], a[href*="article"], a');
                                if (link) {
                                    let hrefAttr = link.getAttribute('href') || link.href;
                                    if (hrefAttr) {
                                        productUrl = hrefAttr.startsWith('http') ? hrefAttr : ('https://gkr.norsiide.be' + (hrefAttr.startsWith('/') ? '' : '/') + hrefAttr);
                                    }
                                }
                                break;
                            }
                        }

                        // 2. Recherche globale si présent dans la page
                        if (!found && doc.body) {
                            let bodyText = normalizeCode(doc.body.textContent);
                            if (bodyText.includes(normTarget) && !bodyText.includes('aucunrésultat') && !bodyText.includes('aucunproduit') && !bodyText.includes('notfound') && !bodyText.includes('0produit')) {
                                found = true;
                                let allLinks = Array.from(doc.querySelectorAll('a[href*="product"]'));
                                for (let l of allLinks) {
                                    if (normalizeCode(l.textContent).includes(normTarget)) {
                                        let hrefAttr = l.getAttribute('href') || l.href;
                                        productUrl = hrefAttr.startsWith('http') ? hrefAttr : ('https://gkr.norsiide.be' + (hrefAttr.startsWith('/') ? '' : '/') + hrefAttr);
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
            badge.title = `Votre session sur gkr.norsiide.be a expiré. Cliquez pour vous connecter.`;
            rowElement.style.backgroundColor = 'rgba(255, 193, 7, 0.08)';
        } else if (found) {
            badge.style.backgroundColor = '#d4edda';
            badge.style.color = '#155724';
            badge.style.border = '1px solid #c3e6cb';
            badge.innerHTML = '✅ En stock (Ouvrir ↗)';
            badge.title = `Cliquer pour charger ${ref} sur votre onglet ( gkr.norsiide.be )`;
            rowElement.style.backgroundColor = 'rgba(40, 167, 69, 0.05)';
        } else {
            badge.style.backgroundColor = '#f8d7da';
            badge.style.color = '#721c24';
            badge.style.border = '1px solid #f5c6cb';
            badge.innerHTML = '❌ Non trouvé (Chercher ↗)';
            badge.title = `Cliquer pour chercher ${ref} sur votre onglet ( gkr.norsiide.be )`;
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
            checkBtn.textContent = '🔎 Checker sur ( gkr.norsiide.be )';
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

            if (checkRes.authRequired) {
                authIssueDetected = true;
            } else if (checkRes.found) {
                foundCount++;
            }

            setRowStatusBadge(it.rowElement, it.inputElement, checkRes.found, checkRes.productUrl, it.reference, checkRes.authRequired);
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
                btn.textContent = '🔎 Checker sur ( gkr.norsiide.be )';
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
