const YEAR_START = 2026;
const YEAR_END = 2055;
let currentDate = new Date();
let events = [];
let currentUserId = null;
let listenersInitialized = false;
let selectedDayDate = null;
const monthNames = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];

if (currentDate.getFullYear() < YEAR_START || currentDate.getFullYear() > YEAR_END) {
    currentDate = new Date(YEAR_START, 0, 1);
}

// Rendre le calendrier immediatement (meme sans auth)
document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
    setupEventListeners();
});

// Surveiller l'authentification
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserId = user.uid;
        console.log('[Calendar] Utilisateur connecte:', user.email);
        loadEvents();
    } else {
        currentUserId = null;
        events = [];
        renderCalendar();
    }
});

// ──────────────────────────────────────────────
// Chargement des evenements
// ──────────────────────────────────────────────
async function loadEvents() {
    if (!currentUserId) return;

    const { startDate, endDate } = getCalendarGridBounds(currentDate);

    try {
        const snapshot = await db.collection('events')
            .where('userId', '==', currentUserId)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get();

        events = [];
        snapshot.forEach(doc => {
            events.push({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate()
            });
        });

        events.sort((a, b) => a.date - b.date);

        renderCalendar();
        renderTimeline();
        checkUpcomingEvents();
    } catch (error) {
        console.error('[Calendar] Erreur chargement:', error);
        // Afficher le calendrier quand meme (sans events)
        renderCalendar();
        renderTimeline();
    }
}

function getCalendarGridBounds(baseDate) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const firstWeekday = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;

    const startDate = new Date(year, month, 1 - firstWeekday);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 41);

    return { startDate, endDate };
}

function getEventsForDate(date) {
    return events.filter(ev => ev.date.toDateString() === date.toDateString());
}

// ──────────────────────────────────────────────
// Rendu du calendrier
// ──────────────────────────────────────────────
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    document.getElementById('currentMonthYear').textContent = `${monthNames[month]} ${year}`;

    const monthPicker = document.getElementById('monthPicker');
    if (monthPicker) {
        monthPicker.min = `${YEAR_START}-01`;
        monthPicker.max = `${YEAR_END}-12`;
        monthPicker.value = `${year}-${String(month + 1).padStart(2, '0')}`;
    }

    initializeYearRangePicker();
    const yearRangePicker = document.getElementById('yearRangePicker');
    if (yearRangePicker) {
        yearRangePicker.value = String(year);
    }

    const { startDate } = getCalendarGridBounds(currentDate);
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    for (let i = 0; i < 42; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);

        const isCurrentMonth = cellDate.getMonth() === month;
        const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
        const isToday = new Date().toDateString() === cellDate.toDateString();
        const isSelected = selectedDayDate && cellDate.toDateString() === selectedDayDate.toDateString();
        const dayEvents = getEventsForDate(cellDate);

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
        dayDiv.setAttribute('aria-label', `${cellDate.getDate()} ${monthNames[cellDate.getMonth()]} ${cellDate.getFullYear()} - ${dayEvents.length} evenement(s)`);

        // Clic = selectionner le jour et voir le panneau
        const dateCopy = new Date(cellDate);
        dayDiv.addEventListener('click', () => selectDay(dateCopy));
        dayDiv.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDay(dateCopy); }
        });

        // Numero du jour
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = cellDate.getDate();
        dayDiv.appendChild(dayNumber);

        // Evenements visibles (max 3)
        dayEvents.slice(0, 3).forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.className = `event-item ${event.type}`;
            eventDiv.textContent = event.title;
            eventDiv.title = `${event.title} - ${event.date.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}`;
            eventDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                editEvent(event);
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

    renderMonthCarousel();

    // Si un jour est selectionne, rafraichir le panneau
    if (selectedDayDate) {
        renderDayPanel(selectedDayDate);
    }
}

// ──────────────────────────────────────────────
// Selection d'un jour + panneau detail
// ──────────────────────────────────────────────
function selectDay(date) {
    selectedDayDate = date;

    // Mettre a jour la classe .selected sur la grille
    document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
    const grid = document.getElementById('calendarGrid');
    const { startDate } = getCalendarGridBounds(currentDate);
    const dayIndex = Math.round((date - startDate) / (1000 * 60 * 60 * 24));
    if (dayIndex >= 0 && dayIndex < 42 && grid.children[dayIndex]) {
        grid.children[dayIndex].classList.add('selected');
    }

    renderDayPanel(date);
    showDayPanel();
}

function renderDayPanel(date) {
    const panel = document.getElementById('dayPanel');
    if (!panel) return;

    const dayEvents = getEventsForDate(date);
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
            html += `
                <div class="day-panel-event ${event.type}" data-event-id="${event.id}">
                    <div class="day-panel-event-time">${time}</div>
                    <div class="day-panel-event-info">
                        <div class="day-panel-event-title">${event.title}</div>
                        ${event.description ? `<div class="day-panel-event-desc">${event.description}</div>` : ''}
                    </div>
                    <div class="day-panel-event-actions">
                        <button class="day-panel-edit" data-event-id="${event.id}" title="Modifier">&#9998;</button>
                        <button class="day-panel-delete" data-event-id="${event.id}" title="Supprimer">&#128465;</button>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    panel.innerHTML = html;

    // Bouton ajouter
    panel.querySelector('.day-panel-add')?.addEventListener('click', () => openModal(date));

    // Bouton fermer
    panel.querySelector('.close-day-panel')?.addEventListener('click', hideDayPanel);

    // Boutons modifier
    panel.querySelectorAll('.day-panel-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.eventId;
            const ev = events.find(ev => ev.id === id);
            if (ev) editEvent(ev);
        });
    });

    // Boutons supprimer
    panel.querySelectorAll('.day-panel-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.eventId;
            if (confirm('Supprimer cet evenement ?')) {
                try {
                    await db.collection('events').doc(id).delete();
                    showAlert('Evenement supprime !');
                    await loadEvents();
                } catch (err) {
                    console.error('[Calendar] Erreur suppression:', err);
                    showAlert('Erreur lors de la suppression');
                }
            }
        });
    });
}

function showDayPanel() {
    const panel = document.getElementById('dayPanel');
    if (panel) {
        panel.classList.add('visible');
    }
}

function hideDayPanel() {
    const panel = document.getElementById('dayPanel');
    if (panel) {
        panel.classList.remove('visible');
        selectedDayDate = null;
        document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
    }
}

// ──────────────────────────────────────────────
// Carrousel annuel
// ──────────────────────────────────────────────
function renderMonthCarousel() {
    const track = document.getElementById('monthCarouselTrack');
    if (!track) return;

    const year = currentDate.getFullYear();
    const selectedMonth = currentDate.getMonth();
    const now = new Date();
    const yearLabel = document.getElementById('carouselYearLabel');

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
        monthName.textContent = monthNames[month];

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

            // Marquer les jours avec evenements
            const chipEvents = getEventsForDate(dayDate);
            if (chipEvents.length > 0) {
                dayChip.classList.add('has-events');
                dayChip.title = `${chipEvents.length} evenement(s)`;
            }

            dayChip.addEventListener('click', (e) => {
                e.stopPropagation();
                currentDate = new Date(year, month, 1);
                loadEvents();
                setTimeout(() => selectDay(dayDate), 100);
            });

            daysGrid.appendChild(dayChip);
        }

        card.appendChild(monthName);
        card.appendChild(daysGrid);

        card.addEventListener('click', () => {
            currentDate = new Date(year, month, 1);
            loadEvents();
        });

        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                currentDate = new Date(year, month, 1);
                loadEvents();
            }
        });

        track.appendChild(card);
    }

    // Auto-scroll vers le mois actif
    setTimeout(() => {
        const activeCard = track.querySelector('.month-card.active');
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, 200);
}

// ──────────────────────────────────────────────
// Navigation
// ──────────────────────────────────────────────
function goToToday() {
    const now = new Date();
    const safeYear = Math.max(YEAR_START, Math.min(YEAR_END, now.getFullYear()));
    currentDate = new Date(safeYear, now.getMonth(), 1);
    selectedDayDate = null;
    hideDayPanel();
    loadEvents();
}

function initializeYearRangePicker() {
    const yearRangePicker = document.getElementById('yearRangePicker');
    if (!yearRangePicker || yearRangePicker.options.length > 0) return;

    for (let year = YEAR_START; year <= YEAR_END; year++) {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        yearRangePicker.appendChild(option);
    }
}

// ──────────────────────────────────────────────
// Timeline (frise chronologique)
// ──────────────────────────────────────────────
async function renderTimeline() {
    const timeline = document.getElementById('timeline');
    const eventCount = document.getElementById('eventCount');
    if (!timeline || !eventCount) return;

    if (!currentUserId) {
        eventCount.textContent = '0 evenement';
        timeline.innerHTML = '<div style="text-align: center; opacity: 0.6;">Connectez-vous pour voir vos evenements</div>';
        return;
    }

    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);

    try {
        // Query simple sans orderBy pour eviter l'erreur d'index composite
        const snapshot = await db.collection('events')
            .where('userId', '==', currentUserId)
            .where('date', '>=', now)
            .where('date', '<=', futureDate)
            .get();

        const upcomingEvents = [];
        snapshot.forEach(doc => {
            upcomingEvents.push({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate()
            });
        });

        // Tri cote client
        upcomingEvents.sort((a, b) => a.date - b.date);

        eventCount.textContent = `${upcomingEvents.length} evenement${upcomingEvents.length > 1 ? 's' : ''}`;

        if (upcomingEvents.length === 0) {
            timeline.innerHTML = '<div style="text-align: center; opacity: 0.6;">Aucun evenement a venir</div>';
            return;
        }

        timeline.innerHTML = '';

        upcomingEvents.forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'timeline-item';
            eventDiv.onclick = () => editEvent(event);

            const eventDate = new Date(event.date);
            const daysDiff = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));

            eventDiv.innerHTML = `
                <div class="timeline-item-title">${event.title}</div>
                <div class="timeline-item-date">
                    ${eventDate.toLocaleDateString('fr')} a ${eventDate.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div class="timeline-item-type">
                    ${daysDiff === 0 ? '🔴 Aujourd\'hui' : daysDiff === 1 ? '🟠 Demain' : `📅 Dans ${daysDiff} jours`}
                </div>
            `;

            timeline.appendChild(eventDiv);
        });
    } catch (error) {
        console.error('[Calendar] Erreur timeline:', error);
        eventCount.textContent = '—';
        timeline.innerHTML = '<div style="text-align: center; opacity: 0.6;">Impossible de charger la timeline</div>';
    }
}

// ──────────────────────────────────────────────
// Alertes et notifications
// ──────────────────────────────────────────────
function checkUpcomingEvents() {
    const now = new Date();
    const upcomingEvents = events.filter(event => {
        const diffHours = (event.date - now) / (1000 * 60 * 60);
        return diffHours > 0 && diffHours <= 24 && !event.notified;
    });

    if (upcomingEvents.length > 0) {
        showAlert(`${upcomingEvents.length} evenement(s) dans les 24 heures !`);

        upcomingEvents.forEach(event => {
            db.collection('events').doc(event.id).update({ notified: true })
                .catch(err => console.warn('[Calendar] Notification update failed:', err.message));
        });
    }
}

function showAlert(message) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert';
    alertDiv.textContent = message;
    alertContainer.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
}

// ──────────────────────────────────────────────
// Modal
// ──────────────────────────────────────────────
function openModal(date) {
    if (!currentUserId) {
        showAlert('Connectez-vous pour creer un evenement');
        return;
    }

    const modal = document.getElementById('eventModal');
    document.getElementById('modalTitle').textContent = `Nouvel evenement — ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    document.getElementById('eventDate').value = date.toISOString();
    document.getElementById('eventId').value = '';
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventType').value = 'rdv';
    document.getElementById('eventTime').value = '12:00';
    document.getElementById('eventDescription').value = '';
    document.getElementById('deleteEventBtn').style.display = 'none';

    // Reset du bouton
    const submitBtn = modal.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enregistrer';

    modal.style.display = 'flex';
    document.getElementById('eventTitle').focus();
}

function editEvent(event) {
    if (!currentUserId) return;

    const modal = document.getElementById('eventModal');
    const eventDateObj = new Date(event.date);

    document.getElementById('modalTitle').textContent = `Modifier — ${eventDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    document.getElementById('eventDate').value = eventDateObj.toISOString();
    document.getElementById('eventId').value = event.id;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventType').value = event.type;
    document.getElementById('eventTime').value = eventDateObj.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('deleteEventBtn').style.display = 'block';

    const submitBtn = modal.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enregistrer';

    modal.style.display = 'flex';
    document.getElementById('eventTitle').focus();
}

function closeModal() {
    document.getElementById('eventModal').style.display = 'none';
}

// ──────────────────────────────────────────────
// CRUD evenements
// ──────────────────────────────────────────────
document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement...';

    const eventId = document.getElementById('eventId').value;
    const dateStr = document.getElementById('eventDate').value;
    const title = document.getElementById('eventTitle').value.trim();
    const type = document.getElementById('eventType').value;
    const time = document.getElementById('eventTime').value;
    const description = document.getElementById('eventDescription').value.trim();

    if (!title) {
        showAlert('Le titre est obligatoire');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enregistrer';
        return;
    }

    const [hours, minutes] = time.split(':');
    const eventDate = new Date(dateStr);
    eventDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

    const eventData = {
        userId: currentUserId,
        title: title,
        type: type,
        date: eventDate,
        description: description,
        notified: false,
        updatedAt: new Date()
    };

    try {
        if (eventId) {
            await db.collection('events').doc(eventId).update(eventData);
            showAlert('Evenement modifie !');
        } else {
            eventData.createdAt = new Date();
            await db.collection('events').add(eventData);
            showAlert('Evenement cree !');
        }

        closeModal();
        await loadEvents();
    } catch (error) {
        console.error('[Calendar] Erreur sauvegarde:', error);
        showAlert('Erreur: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enregistrer';
    }
});

document.getElementById('deleteEventBtn')?.addEventListener('click', async () => {
    const eventId = document.getElementById('eventId').value;

    if (confirm('Supprimer cet evenement ?')) {
        const btn = document.getElementById('deleteEventBtn');
        btn.disabled = true;
        btn.textContent = 'Suppression...';

        try {
            await db.collection('events').doc(eventId).delete();
            showAlert('Evenement supprime !');
            closeModal();
            await loadEvents();
        } catch (error) {
            console.error('[Calendar] Erreur suppression:', error);
            showAlert('Erreur: ' + error.message);
            btn.disabled = false;
            btn.textContent = 'Supprimer';
        }
    }
});

// ──────────────────────────────────────────────
// Event listeners
// ──────────────────────────────────────────────
function setupEventListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    // Navigation mois
    document.getElementById('prevMonth')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        hideDayPanel();
        loadEvents();
    });

    document.getElementById('nextMonth')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        hideDayPanel();
        loadEvents();
    });

    document.getElementById('todayBtn')?.addEventListener('click', goToToday);

    document.getElementById('prevYear')?.addEventListener('click', () => {
        if (currentDate.getFullYear() <= YEAR_START) {
            showAlert(`Plage: ${YEAR_START} - ${YEAR_END}`);
            return;
        }
        currentDate.setFullYear(currentDate.getFullYear() - 1);
        hideDayPanel();
        loadEvents();
    });

    document.getElementById('nextYear')?.addEventListener('click', () => {
        if (currentDate.getFullYear() >= YEAR_END) {
            showAlert(`Plage: ${YEAR_START} - ${YEAR_END}`);
            return;
        }
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        hideDayPanel();
        loadEvents();
    });

    document.getElementById('monthPicker')?.addEventListener('change', (e) => {
        const value = e.target.value;
        if (!value) return;
        const [year, month] = value.split('-').map(Number);
        const safeYear = Math.max(YEAR_START, Math.min(YEAR_END, year));
        currentDate = new Date(safeYear, month - 1, 1);
        hideDayPanel();
        loadEvents();
    });

    document.getElementById('yearRangePicker')?.addEventListener('change', (e) => {
        const year = Number(e.target.value);
        if (Number.isNaN(year)) return;
        currentDate = new Date(year, currentDate.getMonth(), 1);
        hideDayPanel();
        loadEvents();
    });

    // Fermeture modal
    document.querySelector('.close-modal')?.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('eventModal')) closeModal();
    });

    // Raccourcis clavier globaux
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('eventModal');
        const modalOpen = modal && modal.style.display === 'flex';

        if (e.key === 'Escape') {
            if (modalOpen) { closeModal(); return; }
            if (selectedDayDate) { hideDayPanel(); return; }
        }

        // Navigation clavier (seulement si modal ferme)
        if (modalOpen) return;

        if (e.key === 'ArrowLeft' && e.ctrlKey) {
            e.preventDefault();
            currentDate.setMonth(currentDate.getMonth() - 1);
            hideDayPanel();
            loadEvents();
        }
        if (e.key === 'ArrowRight' && e.ctrlKey) {
            e.preventDefault();
            currentDate.setMonth(currentDate.getMonth() + 1);
            hideDayPanel();
            loadEvents();
        }
    });
}

// Refresh periodique
setInterval(() => {
    if (currentUserId) {
        renderTimeline();
        checkUpcomingEvents();
    }
}, 60000);