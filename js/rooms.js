// ──────────────────────────────────────────────
// Rooms — Salons collaboratifs
// ──────────────────────────────────────────────
let rooms = [];
let currentRoomId = null;
let currentUserId = null;

// ── Room Calendar State ──
const YEAR_START = 2026;
const YEAR_END = 2055;
let roomCalendarDate = new Date();
let roomEvents = [];
let selectedRoomDay = null;
let currentOpenRoom = null;
const roomMonthNames = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];

if (roomCalendarDate.getFullYear() < YEAR_START || roomCalendarDate.getFullYear() > YEAR_END) {
    roomCalendarDate = new Date(YEAR_START, 0, 1);
}

// ──────────────────────────────────────────────
// Alerte visuelle
// ──────────────────────────────────────────────
function showAlert(message) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert';
    alertDiv.textContent = message;
    alertContainer.appendChild(alertDiv);
    // Son de notification (sauf si un son specifique vient d'etre joue)
    if (typeof ChronosSounds !== 'undefined') {
        if (ChronosSounds._skipNextNotification) {
            ChronosSounds._skipNextNotification = false;
        } else {
            ChronosSounds.playNotification();
        }
    }
    setTimeout(() => alertDiv.remove(), 5000);
}

// ──────────────────────────────────────────────
// Hachage du mot de passe (SHA-256)
// ──────────────────────────────────────────────
async function hashPassword(password) {
    // crypto.subtle n'est disponible qu'en contexte securise (HTTPS/localhost)
    if (crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback: simple hash JS pour contextes non-securises
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
    }
    // Double pass pour plus de variation
    const salt = 'chronos_' + password.length;
    for (let i = 0; i < salt.length; i++) {
        hash = ((hash << 5) - hash + salt.charCodeAt(i)) | 0;
    }
    return 'fb' + Math.abs(hash).toString(16).padStart(8, '0');
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    for (let i = 0; i < 6; i++) {
        code += chars[array[i] % chars.length];
    }
    return code;
}

// ──────────────────────────────────────────────
// Chargement des rooms
// ──────────────────────────────────────────────
async function loadRooms() {
    if (!currentUserId) {
        rooms = [];
        renderRoomsList();
        return;
    }

    try {
        // Rooms creees par l'utilisateur
        const createdSnap = await db.collection('rooms')
            .where('creatorId', '==', currentUserId)
            .get();

        // Rooms ou l'utilisateur est participant
        const memberSnap = await db.collection('rooms')
            .where('memberIds', 'array-contains', currentUserId)
            .get();

        const roomMap = new Map();
        createdSnap.forEach(doc => roomMap.set(doc.id, { id: doc.id, ...doc.data() }));
        memberSnap.forEach(doc => roomMap.set(doc.id, { id: doc.id, ...doc.data() }));

        rooms = Array.from(roomMap.values());
        rooms.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

        console.log(`[Rooms] ${rooms.length} room(s) chargee(s)`);
        renderRoomsList();
    } catch (error) {
        console.error('[Rooms] Erreur chargement:', error);
        renderRoomsList();
    }
}

// ──────────────────────────────────────────────
// Rendu de la liste des rooms
// ──────────────────────────────────────────────
function renderRoomsList() {
    const container = document.getElementById('roomsList');
    if (!container) return;

    if (!currentUserId) {
        container.innerHTML = '<div class="rooms-empty">Connectez-vous pour voir vos salons</div>';
        return;
    }

    if (rooms.length === 0) {
        container.innerHTML = '<div class="rooms-empty">Aucun salon. Creez-en un !</div>';
        return;
    }

    container.innerHTML = '';

    rooms.forEach(room => {
        const card = document.createElement('div');
        card.className = 'room-card glass-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const isCreator = room.creatorId === currentUserId;
        const memberCount = (room.memberIds || []).length;

        card.innerHTML = `
            <div class="room-card-header">
                <span class="room-card-icon">${escapeHtml(room.icon || '👥')}</span>
                <h4 class="room-card-name">${escapeHtml(room.name)}</h4>
                <span class="room-badge lock">🔒</span>
                ${isCreator ? '<span class="room-badge creator">Admin</span>' : '<span class="room-badge member">Membre</span>'}
            </div>
            <div class="room-card-meta">
                <span>👤 ${memberCount} participant${memberCount > 1 ? 's' : ''}</span>
                ${room.createdAt ? `<span>📅 ${room.createdAt.toDate().toLocaleDateString('fr')}</span>` : ''}
            </div>
            <div class="room-card-actions">
                <button class="neon-button room-open-btn" type="button">Ouvrir</button>
                ${isCreator ? '<button class="delete-button room-delete-btn" type="button">Supprimer</button>' : ''}
            </div>
        `;

        card.querySelector('.room-open-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openRoomDetail(room);
        });

        const deleteBtn = card.querySelector('.room-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Supprimer le salon "${room.name}" ?`)) {
                    try {
                        await db.collection('rooms').doc(room.id).delete();
                        showAlert('Salon supprime !');
                        await loadRooms();
                    } catch (err) {
                        console.error('[Rooms] Suppression:', err);
                        showAlert('Erreur: ' + err.message);
                    }
                }
            });
        }

        container.appendChild(card);
    });
}

// ──────────────────────────────────────────────
// Detail d'une room
// ──────────────────────────────────────────────
async function openRoomDetail(room) {
    if (currentRoomId !== room.id) {
        roomCalendarDate = new Date();
        if (roomCalendarDate.getFullYear() < YEAR_START || roomCalendarDate.getFullYear() > YEAR_END) {
            roomCalendarDate = new Date(YEAR_START, 0, 1);
        }
        selectedRoomDay = null;
    }
    currentRoomId = room.id;
    currentOpenRoom = room;
    const panel = document.getElementById('roomDetailPanel');
    if (!panel) return;

    const isCreator = room.creatorId === currentUserId;
    const members = room.members || [];

    let membersHtml = '';
    members.forEach(m => {
        const isMe = m.uid === currentUserId;
        const color = getMemberColor(m.uid);
        membersHtml += `
            <div class="room-member">
                <span class="room-member-avatar" style="background-color: ${color};">${(m.name || m.email || '?')[0].toUpperCase()}</span>
                <div class="room-member-info">
                    <span class="room-member-name" style="font-weight: ${isMe ? 'bold' : 'normal'}; color: ${isMe ? 'var(--neon-cyan)' : 'inherit'}">
                        ${escapeHtml(m.name || m.email)} ${isMe ? '(Vous)' : ''}
                    </span>
                </div>
                ${isMe ? `<input type="color" class="room-member-color-picker" value="${color}" data-uid="${m.uid}" title="Changer ma couleur" style="margin-right: 10px; cursor: pointer; background: transparent; border: none; outline: none; width: 30px; height: 30px; padding: 0;">` : ''}
                ${isCreator && !isMe ? `<button class="room-kick-btn" data-uid="${m.uid}" title="Retirer">✕</button>` : ''}
            </div>
        `;
    });

    // Legende des couleurs membres
    let legendHtml = '';
    members.forEach(m => {
        const color = getMemberColor(m.uid);
        legendHtml += `<span class="room-legend-member"><span class="room-legend-dot" style="background:${color};"></span>${escapeHtml(m.name || m.email)}</span>`;
    });

    const roomCode = room.roomCode || '—';

    // Generer les options d'annees
    let yearOptionsHtml = '';
    for (let y = YEAR_START; y <= YEAR_END; y++) {
        yearOptionsHtml += `<option value="${y}">${y}</option>`;
    }

    panel.innerHTML = `
        <div class="room-detail-header">
            <button class="room-back-btn" type="button">◀ Retour</button>
            <h3 class="neon-text">${escapeHtml(room.icon || '👥')} ${escapeHtml(room.name)}</h3>
        </div>

        ${isCreator ? `
        <div class="room-detail-section room-code-section">
            <h4>🔑 Code d'acces</h4>
            <div class="room-code-display">
                <span class="room-code-value" id="roomCodeValue">${escapeHtml(roomCode)}</span>
                <button class="neon-button room-copy-btn" type="button" title="Copier le code">📋 Copier</button>
            </div>
            <p class="room-code-hint">Partagez ce code + le mot de passe pour inviter des participants</p>
        </div>
        ` : ''}

        <div class="room-detail-section">
            <h4>Participants (${members.length})</h4>
            <div class="room-members-list">
                ${membersHtml || '<div class="rooms-empty">Aucun participant</div>'}
            </div>
            ${isCreator ? `
            <div class="room-invite-form">
                <input type="email" id="inviteEmail" class="glass-input" placeholder="Email du participant...">
                <button id="inviteBtn" class="neon-button" type="button">Inviter</button>
            </div>
            ` : ''}
        </div>

        <!-- ═══ CALENDRIER COMPLET DU SALON ═══ -->
        <div class="room-detail-section room-calendar-section">
            <div class="room-full-calendar">
                <div class="room-cal-top-bar">
                    <div class="room-cal-controls">
                        <button class="nav-button room-cal-prev" type="button" aria-label="Mois precedent">◀</button>
                        <h2 class="room-cal-month-title" id="roomCalMonthTitle"></h2>
                        <button class="nav-button room-cal-next" type="button" aria-label="Mois suivant">▶</button>
                    </div>
                <div class="room-cal-actions">
                        <button id="openCustodyBtn" class="nav-button" type="button" title="Garde Alternée" style="border-color: var(--neon-cyan); color: var(--neon-cyan);">👶 Garde</button>
                        <button class="nav-button room-cal-today" type="button">Aujourd'hui</button>
                        <select id="roomYearPicker" class="glass-input year-picker">${yearOptionsHtml}</select>
                        <input type="month" id="roomMonthPicker" class="glass-input month-picker" min="${YEAR_START}-01" max="${YEAR_END}-12">
                    </div>
                </div>

                <div class="room-calendar-weekdays">
                    <div>Lun</div><div>Mar</div><div>Mer</div><div>Jeu</div><div>Ven</div><div>Sam</div><div>Dim</div>
                </div>
                <div class="room-calendar-grid" id="roomCalendarGrid"></div>

                <!-- Legende membres -->
                <div class="room-members-legend">${legendHtml}</div>

                <!-- Carrousel annuel -->
                <div class="room-carousel-wrapper">
                    <div class="room-carousel-header">
                        <h3 class="neon-text room-carousel-title">Carrousel annuel</h3>
                        <div class="room-carousel-controls">
                            <button class="nav-button room-carousel-prev-year" type="button">◀ Annee</button>
                            <span class="room-carousel-year-label" id="roomCarouselYearLabel"></span>
                            <button class="nav-button room-carousel-next-year" type="button">Annee ▶</button>
                        </div>
                    </div>
                    <div class="room-carousel-track" id="roomCarouselTrack"></div>
                </div>
            </div>
        </div>

        <!-- Panneau du jour (inline) -->
        <div class="room-day-panel" id="roomDayPanel" style="display:none;"></div>

        <!-- Timeline evenements a venir -->
        <div class="room-timeline-section">
            <div class="room-timeline-header">
                <h3>📋 Evenements a venir</h3>
                <span class="room-timeline-count" id="roomEventCount">0 evenement</span>
            </div>
            <div id="roomTimeline" class="room-timeline"></div>
        </div>
    `;

    // ── Listeners ──
    panel.querySelector('.room-back-btn')?.addEventListener('click', closeRoomDetail);

    panel.querySelector('.room-copy-btn')?.addEventListener('click', () => {
        const code = document.getElementById('roomCodeValue')?.textContent;
        if (code && navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => showAlert('Code copie !'));
        }
    });

    panel.querySelector('#inviteBtn')?.addEventListener('click', () => inviteParticipant(room));
    panel.querySelector('#inviteEmail')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); inviteParticipant(room); }
    });

    panel.querySelectorAll('.room-kick-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            if (confirm('Retirer ce participant ?')) {
                await removeParticipant(room, uid);
            }
        });
    });

    panel.querySelectorAll('.room-member-color-picker').forEach(input => {
        input.addEventListener('change', async (e) => {
            const newColor = e.target.value;
            await changeMemberColor(room, currentUserId, newColor);
        });
    });

    // Calendar navigation (avec clamping de la plage d'annees)
    panel.querySelector('.room-cal-prev')?.addEventListener('click', () => {
        roomCalendarDate.setMonth(roomCalendarDate.getMonth() - 1);
        if (roomCalendarDate.getFullYear() < YEAR_START) {
            roomCalendarDate = new Date(YEAR_START, 0, 1);
            showAlert(`Plage: ${YEAR_START} - ${YEAR_END}`);
        }
        loadRoomEvents(room.id);
    });
    panel.querySelector('.room-cal-next')?.addEventListener('click', () => {
        roomCalendarDate.setMonth(roomCalendarDate.getMonth() + 1);
        if (roomCalendarDate.getFullYear() > YEAR_END) {
            roomCalendarDate = new Date(YEAR_END, 11, 1);
            showAlert(`Plage: ${YEAR_START} - ${YEAR_END}`);
        }
        loadRoomEvents(room.id);
    });
    panel.querySelector('.room-cal-today')?.addEventListener('click', () => {
        const now = new Date();
        roomCalendarDate = new Date(Math.max(YEAR_START, Math.min(YEAR_END, now.getFullYear())), now.getMonth(), 1);
        selectedRoomDay = null;
        hideRoomDayPanel();
        loadRoomEvents(room.id);
    });

    document.getElementById('roomYearPicker')?.addEventListener('change', (e) => {
        const year = Number(e.target.value);
        if (!Number.isNaN(year)) {
            roomCalendarDate = new Date(year, roomCalendarDate.getMonth(), 1);
            hideRoomDayPanel();
            loadRoomEvents(room.id);
        }
    });

    document.getElementById('roomMonthPicker')?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val) return;
        const [y, m] = val.split('-').map(Number);
        const safeYear = Math.max(YEAR_START, Math.min(YEAR_END, y));
        roomCalendarDate = new Date(safeYear, m - 1, 1);
        hideRoomDayPanel();
        loadRoomEvents(room.id);
    });

    // Carousel year nav
    panel.querySelector('.room-carousel-prev-year')?.addEventListener('click', () => {
        if (roomCalendarDate.getFullYear() <= YEAR_START) { showAlert(`Plage: ${YEAR_START} - ${YEAR_END}`); return; }
        roomCalendarDate.setFullYear(roomCalendarDate.getFullYear() - 1);
        hideRoomDayPanel();
        loadRoomEvents(room.id);
    });
    panel.querySelector('.room-carousel-next-year')?.addEventListener('click', () => {
        if (roomCalendarDate.getFullYear() >= YEAR_END) { showAlert(`Plage: ${YEAR_START} - ${YEAR_END}`); return; }
        roomCalendarDate.setFullYear(roomCalendarDate.getFullYear() + 1);
        hideRoomDayPanel();
        loadRoomEvents(room.id);
    });

    // Afficher le panel
    document.getElementById('roomsList').style.display = 'none';
    document.querySelector('.rooms-header-actions')?.classList.add('hidden');
    panel.style.display = 'block';

    // Rendu initial immediat (grille vide + carrousel + timeline)
    renderRoomCalendar();
    renderRoomCarousel();
    renderRoomTimeline();

    // Charger les evenements du salon (re-render avec donnees)
    await loadRoomEvents(room.id);

    // Vérifier les événements à venir pour le Pop-up
    setTimeout(() => {
        checkUpcomingEventsPopUp(room.id);
    }, 500);
}

function closeRoomDetail() {
    const panel = document.getElementById('roomDetailPanel');
    if (panel) panel.style.display = 'none';
    document.getElementById('roomsList').style.display = '';
    document.querySelector('.rooms-header-actions')?.classList.remove('hidden');
    currentRoomId = null;
    currentOpenRoom = null;
    roomEvents = [];
    selectedRoomDay = null;
}

// ──────────────────────────────────────────────
// Calendrier complet du salon
// ──────────────────────────────────────────────
async function loadRoomEvents(roomId) {
    if (!roomId) return;

    try {
        console.log('[Rooms] Chargement evenements pour roomId:', roomId);
        const snapshot = await db.collection('events')
            .where('roomId', '==', roomId)
            .get();

        console.log('[Rooms] Snapshot recu, docs:', snapshot.size);
        roomEvents = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.date) { console.warn('[Rooms] Event sans date:', doc.id); return; }

            // Gerer tous les formats de date possibles
            let eventDate;
            if (typeof data.date.toDate === 'function') {
                eventDate = data.date.toDate();
            } else if (data.date instanceof Date) {
                eventDate = data.date;
            } else if (typeof data.date === 'string') {
                eventDate = new Date(data.date);
            } else if (typeof data.date === 'number') {
                eventDate = new Date(data.date);
            } else {
                console.warn('[Rooms] Format de date inconnu pour event:', doc.id, data.date);
                return;
            }

            if (isNaN(eventDate.getTime())) {
                console.warn('[Rooms] Date invalide pour event:', doc.id, data.date);
                return;
            }

            roomEvents.push({
                id: doc.id,
                ...data,
                date: eventDate
            });
        });

        roomEvents.sort((a, b) => a.date - b.date);
        console.log(`[Rooms] ${roomEvents.length} evenement(s) du salon charge(s)`);
    } catch (error) {
        console.error('[Rooms] Erreur chargement evenements salon:', error);
        showAlert('Erreur chargement evenements: ' + error.message);
        roomEvents = [];
    }

    // Toujours rendre le calendrier, meme si le chargement echoue
    console.log('[Rooms] Rendu calendrier avec', roomEvents.length, 'evenement(s)');
    renderRoomCalendar();
    renderRoomCarousel();
    renderRoomTimeline();
    if (selectedRoomDay) {
        renderRoomDayPanel(selectedRoomDay);
    }
}

function getRoomCalendarGridBounds(baseDate) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const startDate = new Date(year, month, 1 - firstWeekday);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 41);
    return { startDate, endDate };
}

function getRoomEventsForDate(date) {
    return roomEvents.filter(ev => {
        if (ev.recurrence === 'yearly') {
            return ev.date.getMonth() === date.getMonth() && 
                   ev.date.getDate() === date.getDate() && 
                   date.getFullYear() >= ev.date.getFullYear();
        }
        return ev.date.toDateString() === date.toDateString();
    });
}

function getMemberColor(uid) {
    if (!currentOpenRoom) return '#00f6ff';
    const member = (currentOpenRoom.members || []).find(m => m.uid === uid);
    if (member && member.color) return member.color;

    const colors = ['#00f6ff', '#ff2dbf', '#5a7bff', '#b44aff', '#39ff14', '#ffd700', '#ff6b35', '#ff4757'];
    if (!uid) return colors[0];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    }
    return colors[Math.abs(hash) % colors.length];
}

function getEventIcon(type) {
    const icons = {
        ecole: '🏫',
        enfants: '👶',
        medecin: '🩺',
        veterinaire: '🐾',
        vacances: '🏖️',
        rdv: '📅',
        fete: '🎉',
        reunion: '💼',
        anniversaire: '🎂',
        other: '📝'
    };
    return icons[type] || '📅';
}

function getMemberName(uid) {
    if (!currentOpenRoom) return 'Inconnu';
    const member = (currentOpenRoom.members || []).find(m => m.uid === uid);
    const rawName = member ? (member.name || member.email) : 'Inconnu';
    return uid === currentUserId ? `${rawName} (Vous)` : rawName;
}

async function changeMemberColor(room, uid, color) {
    try {
        const updatedMembers = (room.members || []).map(m => {
            if (m.uid === uid) return { ...m, color: color };
            return m;
        });
        await db.collection('rooms').doc(room.id).update({
            members: updatedMembers,
            updatedAt: new Date()
        });
        showAlert('Couleur mise à jour !');
        
        currentOpenRoom.members = updatedMembers;
        const index = rooms.findIndex(r => r.id === room.id);
        if (index !== -1) rooms[index].members = updatedMembers;

        openRoomDetail(currentOpenRoom); // Refresh panel
    } catch (error) {
        console.error('[Rooms] Erreur changement couleur:', error);
        showAlert('Erreur: ' + error.message);
    }
}

function renderRoomCalendar() {
    const grid = document.getElementById('roomCalendarGrid');
    const titleEl = document.getElementById('roomCalMonthTitle');
    if (!grid || !titleEl) return;

    const year = roomCalendarDate.getFullYear();
    const month = roomCalendarDate.getMonth();
    titleEl.textContent = `${roomMonthNames[month]} ${year}`;

    // Sync pickers
    const monthPicker = document.getElementById('roomMonthPicker');
    if (monthPicker) monthPicker.value = `${year}-${String(month + 1).padStart(2, '0')}`;
    const yearPicker = document.getElementById('roomYearPicker');
    if (yearPicker) yearPicker.value = String(year);

    const { startDate } = getRoomCalendarGridBounds(roomCalendarDate);
    grid.innerHTML = '';

    for (let i = 0; i < 42; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);

        const isCurrentMonth = cellDate.getMonth() === month;
        const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
        const isToday = new Date().toDateString() === cellDate.toDateString();
        const isSelected = selectedRoomDay && cellDate.toDateString() === selectedRoomDay.toDateString();
        const dayEvents = getRoomEventsForDate(cellDate);

        // --- Logique Garde Alternée ---
        let custodyIndicatorHtml = '';
        if (currentOpenRoom && currentOpenRoom.custodyConfig && currentOpenRoom.custodyConfig.enabled) {
            const config = currentOpenRoom.custodyConfig;
            const configDateStr = config.startDate; // YYYY-MM-DD
            const configParts = configDateStr.split('-');
            const configDate = new Date(configParts[0], configParts[1] - 1, configParts[2]);
            
            // Calculer difference en jours (ignorer l'heure)
            const cellDateUTC = Date.UTC(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
            const configDateUTC = Date.UTC(configDate.getFullYear(), configDate.getMonth(), configDate.getDate());
            
            let parentUid = null;
            if (cellDateUTC >= configDateUTC) {
                const diffDays = Math.floor((cellDateUTC - configDateUTC) / (1000 * 60 * 60 * 24));
                const cycleWeek = Math.floor(diffDays / 7);
                parentUid = (cycleWeek % 2 === 0) ? config.parentA : config.parentB;
            } else {
                // Pour les dates antérieures au début de la règle : on recule !
                const diffDays = Math.floor((configDateUTC - cellDateUTC) / (1000 * 60 * 60 * 24));
                // Si on recule de 1 à 7 jours -> semaine précédente = alternance
                const cycleWeekBefore = Math.floor((diffDays - 1) / 7);
                parentUid = (cycleWeekBefore % 2 === 0) ? config.parentB : config.parentA;
            }
            if (parentUid) {
                const parentColor = getMemberColor(parentUid);
                custodyIndicatorHtml = `<div class="custody-indicator" style="background-color: ${parentColor};" title="Garde: ${getMemberName(parentUid)}">👶</div>`;
            }
        }

        const dayDiv = document.createElement('div');
        dayDiv.className = [
            'calendar-day',
            isToday ? 'today' : '',
            isCurrentMonth ? '' : 'other-month',
            isWeekend ? 'weekend' : '',
            isSelected ? 'selected' : '',
            dayEvents.length > 0 ? 'has-events' : ''
        ].filter(Boolean).join(' ');

        dayDiv.style.animationDelay = `${i * 15}ms`;
        dayDiv.setAttribute('tabindex', '0');
        dayDiv.setAttribute('role', 'button');
        dayDiv.setAttribute('aria-label', `${cellDate.getDate()} ${roomMonthNames[cellDate.getMonth()]} ${cellDate.getFullYear()} - ${dayEvents.length} evenement(s)`);

        const dateCopy = new Date(cellDate);
        dayDiv.addEventListener('click', () => selectRoomDay(dateCopy));
        dayDiv.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRoomDay(dateCopy); }
        });

        // Numero du jour
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = cellDate.getDate();
        dayDiv.appendChild(dayNumber);
        
        // Ajouter Indicateur visuel Garde Alternée
        if (custodyIndicatorHtml) {
            dayDiv.insertAdjacentHTML('beforeend', custodyIndicatorHtml);
        }

        // Evenements visibles (max 3) avec couleur membre
        dayEvents.slice(0, 3).forEach(event => {
            const eventColor = getMemberColor(event.userId);
            const eventDiv = document.createElement('div');
            eventDiv.className = `event-item ${event.type}`;
            eventDiv.style.backgroundColor = eventColor;
            eventDiv.textContent = `${getEventIcon(event.type)} ${event.title}`;
            eventDiv.title = `${getEventIcon(event.type)} ${event.title} — ${getMemberName(event.userId)} — ${event.date.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}`;
            eventDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                if (event.userId === currentUserId) {
                    editRoomEvent(event);
                } else {
                    selectRoomDay(dateCopy);
                }
            });
            dayDiv.appendChild(eventDiv);
        });

        if (dayEvents.length > 3) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'event-more';
            moreDiv.textContent = `+${dayEvents.length - 3} autres`;
            dayDiv.appendChild(moreDiv);
        }

        grid.appendChild(dayDiv);
    }
}

// ──────────────────────────────────────────────
// Selection du jour + panneau detail
// ──────────────────────────────────────────────
function selectRoomDay(date) {
    selectedRoomDay = date;

    // Mettre a jour .selected
    document.querySelectorAll('#roomCalendarGrid .calendar-day.selected').forEach(el => el.classList.remove('selected'));
    const grid = document.getElementById('roomCalendarGrid');
    const { startDate } = getRoomCalendarGridBounds(roomCalendarDate);
    const dayIndex = Math.round((date - startDate) / (1000 * 60 * 60 * 24));
    if (dayIndex >= 0 && dayIndex < 42 && grid.children[dayIndex]) {
        grid.children[dayIndex].classList.add('selected');
    }

    renderRoomDayPanel(date);
    showRoomDayPanel();
}

function renderRoomDayPanel(date) {
    const panel = document.getElementById('roomDayPanel');
    if (!panel) return;

    const dayEvents = getRoomEventsForDate(date);
    const formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let html = `
        <div class="day-panel-header">
            <h3 class="day-panel-date">${formattedDate}</h3>
            <button class="close-day-panel" aria-label="Fermer">&times;</button>
        </div>
        <button class="neon-button day-panel-add" type="button">+ Ajouter un evenement</button>
    `;

    if (dayEvents.length === 0) {
        html += `<div class="day-panel-empty">Aucun evenement ce jour</div>`;
    } else {
        html += `<div class="day-panel-events">`;
        dayEvents.forEach(event => {
            const time = event.date.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });
            const memberName = getMemberName(event.userId);
            const memberColor = getMemberColor(event.userId);
            const isOwner = event.userId === currentUserId;
            html += `
                <div class="day-panel-event ${event.type}" data-event-id="${event.id}">
                    <div class="room-event-member-bar" style="background:${memberColor};"></div>
                    <div class="day-panel-event-body">
                        <div class="day-panel-event-time">${time}</div>
                        <div class="day-panel-event-info">
                            <div class="day-panel-event-title">${getEventIcon(event.type)} ${escapeHtml(event.title)}</div>
                            <div class="day-panel-event-author" style="color:${memberColor};">${escapeHtml(memberName)}</div>
                            ${event.description ? `<div class="day-panel-event-desc">${escapeHtml(event.description)}</div>` : ''}
                        </div>
                        ${isOwner ? `
                        <div class="day-panel-event-actions">
                            <button class="day-panel-edit" data-event-id="${event.id}" title="Modifier">✏️</button>
                            <button class="day-panel-delete" data-event-id="${event.id}" title="Supprimer">🗑️</button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    panel.innerHTML = html;

    // Bouton ajouter
    panel.querySelector('.day-panel-add')?.addEventListener('click', () => openRoomEventModal(date));

    // Fermer
    panel.querySelector('.close-day-panel')?.addEventListener('click', hideRoomDayPanel);

    // Modifier
    panel.querySelectorAll('.day-panel-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const ev = roomEvents.find(e => e.id === btn.dataset.eventId);
            if (ev) editRoomEvent(ev);
        });
    });

    // Supprimer
    panel.querySelectorAll('.day-panel-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const eventId = btn.dataset.eventId;
            console.log('[Rooms] Suppression day-panel, eventId:', eventId);
            if (!eventId) { showAlert('Erreur: aucun evenement selectionne'); return; }
            if (confirm('Supprimer cet evenement du salon ?')) {
                try {
                    await db.collection('events').doc(eventId).delete();
                    showAlert('Evenement supprime !');
                    await loadRoomEvents(currentRoomId);
                } catch (err) {
                    console.error('[Rooms] Erreur suppression:', err);
                    showAlert('Erreur suppression: ' + err.message);
                }
            }
        });
    });
}

function showRoomDayPanel() {
    const panel = document.getElementById('roomDayPanel');
    if (panel) { panel.style.display = 'block'; panel.classList.add('visible'); }
}

function hideRoomDayPanel() {
    const panel = document.getElementById('roomDayPanel');
    if (panel) { panel.classList.remove('visible'); panel.style.display = 'none'; }
    selectedRoomDay = null;
    document.querySelectorAll('#roomCalendarGrid .calendar-day.selected').forEach(el => el.classList.remove('selected'));
}

// ──────────────────────────────────────────────
// Carrousel annuel du salon
// ──────────────────────────────────────────────
function renderRoomCarousel() {
    const track = document.getElementById('roomCarouselTrack');
    const yearLabel = document.getElementById('roomCarouselYearLabel');
    if (!track) return;

    const year = roomCalendarDate.getFullYear();
    const selectedMonth = roomCalendarDate.getMonth();
    const now = new Date();
    if (yearLabel) yearLabel.textContent = `${year}`;

    track.innerHTML = '';

    for (let month = 0; month < 12; month++) {
        const card = document.createElement('article');
        card.className = `month-card ${month === selectedMonth ? 'active' : ''}`;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.style.animationDelay = `${month * 50}ms`;

        const monthName = document.createElement('div');
        monthName.className = 'month-card-title';
        monthName.textContent = roomMonthNames[month];

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysGrid = document.createElement('div');
        daysGrid.className = 'month-days-grid';

        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month, day);
            const dayChip = document.createElement('button');
            dayChip.type = 'button';
            dayChip.className = 'month-day-chip';
            dayChip.textContent = day;

            if (dayDate.getDay() === 0 || dayDate.getDay() === 6) dayChip.classList.add('weekend');
            if (dayDate.toDateString() === now.toDateString()) dayChip.classList.add('today');

            const chipEvents = getRoomEventsForDate(dayDate);
            if (chipEvents.length > 0) {
                dayChip.classList.add('has-events');
                dayChip.title = `${chipEvents.length} evenement(s)`;
            }

            dayChip.addEventListener('click', async (e) => {
                e.stopPropagation();
                roomCalendarDate = new Date(year, month, 1);
                await loadRoomEvents(currentRoomId);
                selectRoomDay(dayDate);
            });

            daysGrid.appendChild(dayChip);
        }

        card.appendChild(monthName);
        card.appendChild(daysGrid);

        card.addEventListener('click', () => {
            roomCalendarDate = new Date(year, month, 1);
            loadRoomEvents(currentRoomId);
        });

        track.appendChild(card);
    }

    // Auto-scroll
    setTimeout(() => {
        const activeCard = track.querySelector('.month-card.active');
        if (activeCard) activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 200);
}

// ──────────────────────────────────────────────
// Timeline du salon (evenements a venir)
// ──────────────────────────────────────────────
function renderRoomTimeline() {
    const timeline = document.getElementById('roomTimeline');
    const countEl = document.getElementById('roomEventCount');
    if (!timeline || !countEl) return;

    const now = new Date();
    // On met 'now' a 00:00:00 pour inclure les evts de la journee courante
    now.setHours(0, 0, 0, 0);

    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);

    const upcoming = [];
    roomEvents.forEach(e => {
        let occDate = new Date(e.date);
        
        if (e.recurrence === 'yearly') {
            occDate.setFullYear(now.getFullYear());
            if (occDate < now && occDate.toDateString() !== now.toDateString()) {
                occDate.setFullYear(now.getFullYear() + 1);
            }
        }
        
        if (occDate >= now && occDate <= futureDate) {
            upcoming.push({ ...e, displayDate: occDate });
        }
    });

    upcoming.sort((a, b) => a.displayDate - b.displayDate);

    countEl.textContent = `${upcoming.length} evenement${upcoming.length > 1 ? 's' : ''}`;

    if (upcoming.length === 0) {
        timeline.innerHTML = '<div style="text-align:center;opacity:0.6;">Aucun evenement a venir</div>';
        return;
    }

    timeline.innerHTML = '';
    upcoming.forEach(event => {
        const d = event.displayDate;
        const daysDiff = Math.floor((d - now) / (1000 * 60 * 60 * 24));
        const memberName = getMemberName(event.userId);
        const memberColor = getMemberColor(event.userId);
        const div = document.createElement('div');
        div.className = 'timeline-item';
        div.style.borderLeft = `3px solid ${memberColor}`;
        div.onclick = async () => {
            if (event.userId === currentUserId) editRoomEvent(event);
            else {
                roomCalendarDate = new Date(d.getFullYear(), d.getMonth(), 1);
                await loadRoomEvents(currentRoomId);
                selectRoomDay(new Date(d));
            }
        };
        div.innerHTML = `
            <div class="timeline-item-title">${getEventIcon(event.type)} ${escapeHtml(event.title)} ${event.recurrence === 'yearly' ? '🔄' : ''}</div>
            <div class="timeline-item-date">
                ${d.toLocaleDateString('fr')} a ${d.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="timeline-item-type">
                ${daysDiff === 0 ? '🔴 Aujourd\'hui' : daysDiff === 1 ? '🟠 Demain' : `📅 Dans ${daysDiff} jours`}
                <span style="color:${memberColor};margin-left:8px;">${escapeHtml(memberName)}</span>
            </div>
        `;
        timeline.appendChild(div);
    });
}

// ──────────────────────────────────────────────
// Modal evenement de salon
// ──────────────────────────────────────────────
function openRoomEventModal(date) {
    if (!currentUserId) { showAlert('Connectez-vous pour creer un evenement'); return; }
    if (!currentRoomId) return;

    const modal = document.getElementById('roomEventModal');
    if (!modal) return;

    document.getElementById('roomEventModalTitle').textContent = `Nouvel evenement — ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    // Stocker la date en format local YYYY-MM-DD pour eviter le decalage UTC
    const localDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    document.getElementById('roomEventDate').value = localDateStr;
    document.getElementById('roomEventId').value = '';
    document.getElementById('roomEventRoomId').value = currentRoomId;
    document.getElementById('roomEventTitle').value = '';
    document.getElementById('roomEventType').value = 'rdv';
    document.getElementById('roomEventRecurrence').value = 'none';
    document.getElementById('roomEventTime').value = '12:00';
    document.getElementById('roomEventDescription').value = '';
    document.getElementById('deleteRoomEventBtn').style.display = 'none';

    const submitBtn = modal.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Enregistrer'; }

    modal.style.display = 'flex';
    document.getElementById('roomEventTitle').focus();
}

function editRoomEvent(event) {
    if (!currentUserId) return;

    const modal = document.getElementById('roomEventModal');
    if (!modal) return;

    const eventDate = new Date(event.date);
    document.getElementById('roomEventModalTitle').textContent = `Modifier — ${eventDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    // Stocker la date en format local YYYY-MM-DD pour eviter le decalage UTC
    const localDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
    document.getElementById('roomEventDate').value = localDateStr;
    document.getElementById('roomEventId').value = event.id;
    document.getElementById('roomEventRoomId').value = event.roomId;
    document.getElementById('roomEventTitle').value = event.title;
    document.getElementById('roomEventType').value = event.type;
    document.getElementById('roomEventRecurrence').value = event.recurrence || 'none';
    document.getElementById('roomEventTime').value = eventDate.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('roomEventDescription').value = event.description || '';
    document.getElementById('deleteRoomEventBtn').style.display = 'block';

    const submitBtn = modal.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Enregistrer'; }

    modal.style.display = 'flex';
    document.getElementById('roomEventTitle').focus();
}

function closeRoomEventModal() {
    const modal = document.getElementById('roomEventModal');
    if (modal) modal.style.display = 'none';
}

// ──────────────────────────────────────────────
// Invitation de participant
// ──────────────────────────────────────────────
async function inviteParticipant(room) {
    const emailInput = document.getElementById('inviteEmail');
    const email = emailInput?.value.trim().toLowerCase();

    if (!email) {
        showAlert('Entrez un email');
        return;
    }

    // Validation email basique
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAlert('Email invalide');
        return;
    }

    const inviteBtn = document.getElementById('inviteBtn');
    if (inviteBtn) { inviteBtn.disabled = true; inviteBtn.textContent = 'Invitation...'; }

    try {
        // Chercher l'utilisateur par email dans la collection users
        const userSnap = await db.collection('users')
            .where('email', '==', email)
            .get();

        let participantUid, participantName;

        if (!userSnap.empty) {
            const userData = userSnap.docs[0].data();
            participantUid = userSnap.docs[0].id;
            participantName = userData.username || userData.name || email;
        } else {
            // Utilisateur pas encore inscrit — on l'invite quand meme par email
            participantUid = 'pending_' + email.replace(/[^a-zA-Z0-9]/g, '_');
            participantName = email;
        }

        // Verifier si deja membre
        const existingMembers = room.members || [];
        if (existingMembers.some(m => m.email === email)) {
            showAlert('Ce participant est deja dans le salon');
            if (inviteBtn) { inviteBtn.disabled = false; inviteBtn.textContent = 'Inviter'; }
            return;
        }

        const newMember = { uid: participantUid, email: email, name: participantName };
        const updatedMembers = [...existingMembers, newMember];
        const updatedMemberIds = [...(room.memberIds || []), participantUid];

        await db.collection('rooms').doc(room.id).update({
            members: updatedMembers,
            memberIds: updatedMemberIds,
            updatedAt: new Date()
        });

        showAlert(`${participantName} invite(e) !`);
        emailInput.value = '';

        // Recharger les rooms et rouvrir le detail
        await loadRooms();
        const updatedRoom = rooms.find(r => r.id === room.id);
        if (updatedRoom) openRoomDetail(updatedRoom);

    } catch (error) {
        console.error('[Rooms] Erreur invitation:', error);
        showAlert('Erreur: ' + error.message);
    }

    if (inviteBtn) { inviteBtn.disabled = false; inviteBtn.textContent = 'Inviter'; }
}

// ──────────────────────────────────────────────
// Retirer un participant
// ──────────────────────────────────────────────
async function removeParticipant(room, uid) {
    try {
        const updatedMembers = (room.members || []).filter(m => m.uid !== uid);
        const updatedMemberIds = (room.memberIds || []).filter(id => id !== uid);

        await db.collection('rooms').doc(room.id).update({
            members: updatedMembers,
            memberIds: updatedMemberIds,
            updatedAt: new Date()
        });

        showAlert('Participant retire');
        await loadRooms();
        const updatedRoom = rooms.find(r => r.id === room.id);
        if (updatedRoom) openRoomDetail(updatedRoom);
    } catch (error) {
        console.error('[Rooms] Erreur retrait:', error);
        showAlert('Erreur: ' + error.message);
    }
}

// ──────────────────────────────────────────────
// Creation d'une room
// ──────────────────────────────────────────────
async function createRoom() {
    if (!currentUserId) {
        showAlert('Connectez-vous pour creer un salon');
        return;
    }

    const nameInput = document.getElementById('newRoomName');
    const iconSelect = document.getElementById('newRoomIcon');
    const name = nameInput?.value.trim();

    if (!name) {
        showAlert('Donnez un nom au salon');
        return;
    }

    const createBtn = document.getElementById('createRoomBtn');
    if (createBtn) { createBtn.disabled = true; createBtn.textContent = 'Creation...'; }

    const icon = iconSelect?.value || '👥';
    const passwordInput = document.getElementById('newRoomPassword');
    const password = passwordInput?.value.trim();

    if (!password || password.length < 4) {
        showAlert('Le mot de passe doit contenir au moins 4 caracteres');
        if (createBtn) { createBtn.disabled = false; createBtn.textContent = 'Creer le salon'; }
        return;
    }

    // Recuperer l'email de l'utilisateur courant
    const userEmail = auth.currentUser?.email || '';
    const userName = auth.currentUser?.displayName || userEmail;

    try {
        const roomCode = generateRoomCode();
        const hashedPassword = await hashPassword(password);

        await db.collection('rooms').add({
            name: name,
            icon: icon,
            roomCode: roomCode,
            passwordHash: hashedPassword,
            creatorId: currentUserId,
            members: [{ uid: currentUserId, email: userEmail, name: userName }],
            memberIds: [currentUserId],
            createdAt: new Date(),
            updatedAt: new Date()
        });

        showAlert(`Salon cree ! Code: ${roomCode}`);
        if (nameInput) nameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        closeCreateRoomModal();
        await loadRooms();
    } catch (error) {
        console.error('[Rooms] Erreur creation:', error);
        showAlert('Erreur: ' + error.message);
    }

    if (createBtn) { createBtn.disabled = false; createBtn.textContent = 'Creer le salon'; }
}

// ──────────────────────────────────────────────
// Modal creation room
// ──────────────────────────────────────────────
function openCreateRoomModal() {
    const modal = document.getElementById('createRoomModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('newRoomName')?.focus();
    }
}

function closeCreateRoomModal() {
    const modal = document.getElementById('createRoomModal');
    if (modal) modal.style.display = 'none';
}

// ──────────────────────────────────────────────
// Rejoindre un salon par code + mot de passe
// ──────────────────────────────────────────────
function openJoinRoomModal() {
    const modal = document.getElementById('joinRoomModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('joinRoomCode')?.focus();
    }
}

function closeJoinRoomModal() {
    const modal = document.getElementById('joinRoomModal');
    if (modal) modal.style.display = 'none';
}

async function joinRoom() {
    if (!currentUserId) {
        showAlert('Connectez-vous pour rejoindre un salon');
        return;
    }

    const codeInput = document.getElementById('joinRoomCode');
    const passInput = document.getElementById('joinRoomPassword');
    const code = codeInput?.value.trim().toUpperCase();
    const password = passInput?.value.trim();

    if (!code) { showAlert('Entrez le code du salon'); return; }
    if (!password) { showAlert('Entrez le mot de passe'); return; }

    const joinBtn = document.getElementById('joinRoomBtn');
    if (joinBtn) { joinBtn.disabled = true; joinBtn.textContent = 'Verification...'; }

    try {
        const snap = await db.collection('rooms')
            .where('roomCode', '==', code)
            .get();

        if (snap.empty) {
            showAlert('Aucun salon trouve avec ce code');
            if (joinBtn) { joinBtn.disabled = false; joinBtn.textContent = 'Rejoindre'; }
            return;
        }

        const roomDoc = snap.docs[0];
        const roomData = roomDoc.data();

        // Verifier le mot de passe
        const hashedInput = await hashPassword(password);
        if (hashedInput !== roomData.passwordHash) {
            showAlert('Mot de passe incorrect');
            if (joinBtn) { joinBtn.disabled = false; joinBtn.textContent = 'Rejoindre'; }
            return;
        }

        // Verifier si deja membre
        if ((roomData.memberIds || []).includes(currentUserId)) {
            showAlert('Vous etes deja membre de ce salon');
            if (joinBtn) { joinBtn.disabled = false; joinBtn.textContent = 'Rejoindre'; }
            return;
        }

        // Ajouter l'utilisateur
        const userEmail = auth.currentUser?.email || '';
        const userName = auth.currentUser?.displayName || userEmail;
        const newMember = { uid: currentUserId, email: userEmail, name: userName };

        await db.collection('rooms').doc(roomDoc.id).update({
            members: firebase.firestore.FieldValue.arrayUnion(newMember),
            memberIds: firebase.firestore.FieldValue.arrayUnion(currentUserId),
            updatedAt: new Date()
        });

        showAlert(`Vous avez rejoint "${roomData.name}" !`);
        if (codeInput) codeInput.value = '';
        if (passInput) passInput.value = '';
        closeJoinRoomModal();
        await loadRooms();

    } catch (error) {
        console.error('[Rooms] Erreur rejoindre:', error);
        showAlert('Erreur: ' + error.message);
    }

    if (joinBtn) { joinBtn.disabled = false; joinBtn.textContent = 'Rejoindre'; }
}

// ──────────────────────────────────────────────
// Utilitaire anti-XSS
// ──────────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// ──────────────────────────────────────────────
// Initialisation
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Modal creation room
    document.getElementById('openCreateRoomBtn')?.addEventListener('click', openCreateRoomModal);
    document.getElementById('createRoomBtn')?.addEventListener('click', createRoom);
    document.querySelector('.close-room-modal')?.addEventListener('click', closeCreateRoomModal);

    document.getElementById('createRoomModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'createRoomModal') closeCreateRoomModal();
    });

    // Modal rejoindre room
    document.getElementById('openJoinRoomBtn')?.addEventListener('click', openJoinRoomModal);
    document.getElementById('joinRoomBtn')?.addEventListener('click', joinRoom);
    document.querySelector('.close-join-modal')?.addEventListener('click', closeJoinRoomModal);

    document.getElementById('joinRoomModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'joinRoomModal') closeJoinRoomModal();
    });

    document.getElementById('joinRoomPassword')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); joinRoom(); }
    });

    // Escape ferme les modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('createRoomModal');
            if (modal && modal.style.display === 'flex') closeCreateRoomModal();
            const joinModal = document.getElementById('joinRoomModal');
            if (joinModal && joinModal.style.display === 'flex') closeJoinRoomModal();
            const roomEventModal = document.getElementById('roomEventModal');
            if (roomEventModal && roomEventModal.style.display === 'flex') closeRoomEventModal();
        }
    });

    // Modal evenement salon
    document.querySelector('.close-room-event-modal')?.addEventListener('click', closeRoomEventModal);
    document.getElementById('roomEventModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'roomEventModal') closeRoomEventModal();
    });

    // CRUD evenement salon
    document.getElementById('roomEventForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enregistrement...';

        const eventId = document.getElementById('roomEventId').value;
        const roomId = document.getElementById('roomEventRoomId').value;
        const dateStr = document.getElementById('roomEventDate').value;
        const title = document.getElementById('roomEventTitle').value.trim();
        const type = document.getElementById('roomEventType').value;
        const recurrence = document.getElementById('roomEventRecurrence').value;
        const time = document.getElementById('roomEventTime').value;
        const description = document.getElementById('roomEventDescription').value.trim();

        if (!title) {
            showAlert('Le titre est obligatoire');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enregistrer';
            return;
        }

        const timeParts = (time || '00:00').split(':');
        const hours = parseInt(timeParts[0], 10) || 0;
        const minutes = parseInt(timeParts[1], 10) || 0;
        // dateStr est en format YYYY-MM-DD (local), parser manuellement pour eviter UTC
        const dateParts = dateStr.split('-').map(Number);
        const eventDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours, minutes, 0, 0);

        const eventData = {
            userId: currentUserId,
            roomId: roomId,
            title: title,
            type: type,
            recurrence: recurrence,
            date: eventDate,
            description: description,
            notified: false,
            updatedAt: new Date()
        };

        console.log('[Rooms] Sauvegarde evenement:', { roomId, dateStr, eventDate: eventDate.toString(), eventData });

        try {
            if (eventId) {
                await db.collection('events').doc(eventId).update(eventData);
                showAlert('Evenement modifie !');
            } else {
                eventData.createdAt = new Date();
                await db.collection('events').add(eventData);
                showAlert('Evenement ajoute au salon !');
            }

            // Son de validation (empêche le double son avec showAlert)
            if (typeof ChronosSounds !== 'undefined') {
                ChronosSounds._skipNextNotification = true;
                ChronosSounds.playValidation();
            }

            closeRoomEventModal();
            await loadRoomEvents(roomId);
        } catch (error) {
            console.error('[Rooms] Erreur sauvegarde evenement:', error);
            showAlert('Erreur: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enregistrer';
        }
    });

    document.getElementById('deleteRoomEventBtn')?.addEventListener('click', async () => {
        const eventId = document.getElementById('roomEventId').value;
        const roomId = document.getElementById('roomEventRoomId').value;

        console.log('[Rooms] Suppression demandee, eventId:', eventId, 'roomId:', roomId);

        if (!eventId) {
            showAlert('Erreur: aucun evenement selectionne');
            return;
        }

        if (confirm('Supprimer cet evenement du salon ?')) {
            const btn = document.getElementById('deleteRoomEventBtn');
            btn.disabled = true;
            btn.textContent = 'Suppression...';

            try {
                await db.collection('events').doc(eventId).delete();
                showAlert('Evenement supprime !');
                if (typeof ChronosSounds !== 'undefined') ChronosSounds.playNotification();
                closeRoomEventModal();
                await loadRoomEvents(roomId);
            } catch (error) {
                console.error('[Rooms] Erreur suppression:', error);
                showAlert('Erreur suppression: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Supprimer';
            }
        }
    });

    // Écouteurs pour le Modal Garde Alternée
    document.addEventListener('click', (e) => {
        // Event delegation pour openCustodyBtn car il est redessiné dynamiquement
        if (e.target.id === 'openCustodyBtn') {
            openCustodyModal();
        }
    });
    
    document.querySelector('.close-custody-modal')?.addEventListener('click', closeCustodyModal);
    document.getElementById('saveCustodyBtn')?.addEventListener('click', saveCustodyConfig);
    document.getElementById('disableCustodyBtn')?.addEventListener('click', disableCustodyConfig);
    
    document.getElementById('custodyModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'custodyModal') closeCustodyModal();
    });

    // Écouteurs Pop-up Événements
    document.querySelector('.close-alert-modal')?.addEventListener('click', () => {
        const modal = document.getElementById('eventAlertModal');
        if (modal) modal.style.display = 'none';
    });
    document.getElementById('closeEventAlertBtn')?.addEventListener('click', () => {
        const modal = document.getElementById('eventAlertModal');
        if (modal) modal.style.display = 'none';
    });
    document.getElementById('eventAlertModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'eventAlertModal') {
            e.target.style.display = 'none';
        }
    });

});

// ──────────────────────────────────────────────
// Pop-up d'alerte à l'ouverture du salon
// ──────────────────────────────────────────────
function checkUpcomingEventsPopUp(roomId) {
    if (!roomEvents || roomEvents.length === 0) return;

    const todayStr = new Date().toDateString();
    const sessionKey = 'notified_room_' + roomId;
    if (sessionStorage.getItem(sessionKey) === todayStr) {
        return; // Déjà notifié aujourd'hui pour cette session
    }

    const now = new Date();
    // En cours : depuis 2 heures avant maintenant
    const startWindow = new Date(now.getTime() - 2 * 60 * 60 * 1000); 
    const endWindow = new Date(now);
    endWindow.setDate(now.getDate() + 2); // Jusqu'à après-demain
    endWindow.setHours(23, 59, 59, 999);

    const upcoming = [];
    roomEvents.forEach(e => {
        let occDate = new Date(e.date);
        if (e.recurrence === 'yearly') {
            occDate.setFullYear(now.getFullYear());
            if (occDate < startWindow && occDate.toDateString() !== now.toDateString()) {
                occDate.setFullYear(now.getFullYear() + 1);
            }
        }
        if (occDate >= startWindow && occDate <= endWindow) {
            upcoming.push({ ...e, displayDate: occDate });
        }
    });

    if (upcoming.length === 0) return;

    upcoming.sort((a, b) => a.displayDate - b.displayDate);

    const listContainer = document.getElementById('eventAlertList');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    upcoming.forEach(event => {
        const d = event.displayDate;
        const dReset = new Date(d).setHours(0,0,0,0);
        const nowReset = new Date().setHours(0,0,0,0);
        const diffDays = Math.floor((dReset - nowReset) / (1000 * 60 * 60 * 24));
        const memberColor = getMemberColor(event.userId);
        
        let dayLabel = "Aujourd'hui";
        if (diffDays === 1) dayLabel = "Demain";
        else if (diffDays === 2) dayLabel = "Après-demain";
        else if (diffDays < 0) dayLabel = "En cours";

        listContainer.innerHTML += `
            <div style="background: rgba(255,255,255,0.05); border-left: 4px solid ${memberColor}; padding: 10px; border-radius: 8px;">
                <div style="font-weight: bold; color: #fff;">${getEventIcon(event.type)} ${escapeHtml(event.title)} ${event.recurrence === 'yearly' ? '🔄' : ''}</div>
                <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
                    <span style="color: var(--neon-cyan)">${dayLabel}</span> à ${d.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                    <span style="color: ${memberColor}; margin-left: 10px;">👤 ${escapeHtml(getMemberName(event.userId))}</span>
                </div>
            </div>
        `;
    });

    const modal = document.getElementById('eventAlertModal');
    if (modal) {
        modal.style.display = 'flex';
        sessionStorage.setItem(sessionKey, todayStr);
    }
}

// ──────────────────────────────────────────────
// Logique Garde Alternée Modal
// ──────────────────────────────────────────────
function openCustodyModal() {
    if (!currentOpenRoom) return;
    const modal = document.getElementById('custodyModal');
    if (!modal) return;

    // Remplir les selecteurs Parents
    const selectA = document.getElementById('custodyParentA');
    const selectB = document.getElementById('custodyParentB');
    selectA.innerHTML = '';
    selectB.innerHTML = '';

    (currentOpenRoom.members || []).forEach(m => {
        const optionA = document.createElement('option');
        optionA.value = m.uid;
        optionA.textContent = m.name || m.email;
        selectA.appendChild(optionA);

        const optionB = document.createElement('option');
        optionB.value = m.uid;
        optionB.textContent = m.name || m.email;
        selectB.appendChild(optionB);
    });

    const config = currentOpenRoom.custodyConfig;
    const disableBtn = document.getElementById('disableCustodyBtn');
    
    if (config && config.enabled) {
        selectA.value = config.parentA;
        selectB.value = config.parentB;
        document.getElementById('custodyStartDate').value = config.startDate;
        disableBtn.style.display = 'inline-block';
        document.getElementById('saveCustodyBtn').textContent = 'Mettre à jour';
    } else {
        document.getElementById('custodyStartDate').value = '';
        disableBtn.style.display = 'none';
        document.getElementById('saveCustodyBtn').textContent = 'Activer';
    }

    modal.style.display = 'flex';
}

function closeCustodyModal() {
    const modal = document.getElementById('custodyModal');
    if (modal) modal.style.display = 'none';
}

async function saveCustodyConfig() {
    if (!currentOpenRoom) return;
    
    const parentA = document.getElementById('custodyParentA').value;
    const parentB = document.getElementById('custodyParentB').value;
    const startDate = document.getElementById('custodyStartDate').value;

    if (!startDate) {
        showAlert('Veuillez sélectionner une date de début');
        return;
    }

    const config = {
        enabled: true,
        parentA: parentA,
        parentB: parentB,
        startDate: startDate,
        updatedAt: new Date()
    };

    try {
        document.getElementById('saveCustodyBtn').disabled = true;
        await db.collection('rooms').doc(currentRoomId).update({
            custodyConfig: config
        });
        currentOpenRoom.custodyConfig = config;
        showAlert('Garde alternée activée !');
        closeCustodyModal();
        renderRoomCalendar();
    } catch (err) {
        console.error('Erreur sauvegarde garde:', err);
        showAlert('Erreur: ' + err.message);
    } finally {
        document.getElementById('saveCustodyBtn').disabled = false;
    }
}

async function disableCustodyConfig() {
    if (!currentOpenRoom) return;
    if (confirm('Désactiver la garde alternée pour ce salon ?')) {
        try {
            await db.collection('rooms').doc(currentRoomId).update({
                'custodyConfig.enabled': false
            });
            if (currentOpenRoom.custodyConfig) {
                currentOpenRoom.custodyConfig.enabled = false;
            }
            showAlert('Garde alternée désactivée');
            closeCustodyModal();
            renderRoomCalendar();
        } catch (err) {
            console.error('Erreur disable garde:', err);
            showAlert('Erreur: ' + err.message);
        }
    }
}

// Charger les rooms quand l'auth est prete
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserId = user.uid;
        console.log('[Rooms] Utilisateur connecte:', user.email);
        loadRooms();
    } else {
        currentUserId = null;
        rooms = [];
        roomEvents = [];
        renderRoomsList();
    }
});
