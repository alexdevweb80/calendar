// ──────────────────────────────────────────────
// Rooms — Salons collaboratifs
// ──────────────────────────────────────────────
let rooms = [];
let currentRoomId = null;

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
                <span class="room-card-icon">${room.icon || '👥'}</span>
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
    currentRoomId = room.id;
    const panel = document.getElementById('roomDetailPanel');
    if (!panel) return;

    const isCreator = room.creatorId === currentUserId;
    const members = room.members || [];

    let membersHtml = '';
    members.forEach(m => {
        membersHtml += `
            <div class="room-member">
                <span class="room-member-avatar">${(m.name || m.email || '?')[0].toUpperCase()}</span>
                <div class="room-member-info">
                    <span class="room-member-name">${escapeHtml(m.name || m.email)}</span>
                    <span class="room-member-email">${escapeHtml(m.email)}</span>
                </div>
                ${isCreator && m.uid !== currentUserId ? `<button class="room-kick-btn" data-uid="${m.uid}" title="Retirer">✕</button>` : ''}
            </div>
        `;
    });

    const roomCode = room.roomCode || '—';

    panel.innerHTML = `
        <div class="room-detail-header">
            <button class="room-back-btn" type="button">◀ Retour</button>
            <h3 class="neon-text">${room.icon || '👥'} ${escapeHtml(room.name)}</h3>
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
    `;

    // Listeners
    panel.querySelector('.room-back-btn')?.addEventListener('click', closeRoomDetail);

    // Copier le code
    panel.querySelector('.room-copy-btn')?.addEventListener('click', () => {
        const code = document.getElementById('roomCodeValue')?.textContent;
        if (code && navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => showAlert('Code copie !'));
        }
    });

    // Invite
    panel.querySelector('#inviteBtn')?.addEventListener('click', () => inviteParticipant(room));

    panel.querySelector('#inviteEmail')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); inviteParticipant(room); }
    });

    // Kick
    panel.querySelectorAll('.room-kick-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            if (confirm('Retirer ce participant ?')) {
                await removeParticipant(room, uid);
            }
        });
    });

    // Afficher le panel
    document.getElementById('roomsList').style.display = 'none';
    document.querySelector('.rooms-header-actions')?.classList.add('hidden');
    panel.style.display = 'block';
}

function closeRoomDetail() {
    const panel = document.getElementById('roomDetailPanel');
    if (panel) panel.style.display = 'none';
    document.getElementById('roomsList').style.display = '';
    document.querySelector('.rooms-header-actions')?.classList.remove('hidden');
    currentRoomId = null;
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

        showAlert(`Vous avez rejoint "${escapeHtml(roomData.name)}" !`);
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
// Onglets
// ──────────────────────────────────────────────
function switchTab(tabName) {
    // Boutons onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Contenu onglets
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // Charger les rooms au premier affichage
    if (tabName === 'rooms' && rooms.length === 0 && currentUserId) {
        loadRooms();
    }
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
    // Onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

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

    // Escape ferme le modal room
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('createRoomModal');
            if (modal && modal.style.display === 'flex') closeCreateRoomModal();
        }
    });
});

// Charger les rooms quand l'auth est prete
auth.onAuthStateChanged((user) => {
    if (user) {
        loadRooms();
    } else {
        rooms = [];
        renderRoomsList();
    }
});
