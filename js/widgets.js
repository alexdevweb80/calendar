// ──────────────────────────────────────────────
// Generateur de citations — Motivation & Amour
// ──────────────────────────────────────────────
const QUOTES = {
    motivation: [
        { text: "Le succes n'est pas final, l'echec n'est pas fatal : c'est le courage de continuer qui compte.", author: "Winston Churchill" },
        { text: "La seule facon de faire du bon travail est d'aimer ce que vous faites.", author: "Steve Jobs" },
        { text: "Crois en toi et tout devient possible.", author: "Inconnu" },
        { text: "Le futur appartient a ceux qui croient en la beaute de leurs reves.", author: "Eleanor Roosevelt" },
        { text: "N'attendez pas le moment parfait, prenez le moment et rendez-le parfait.", author: "Inconnu" },
        { text: "Chaque accomplissement commence par la decision d'essayer.", author: "John F. Kennedy" },
        { text: "Le plus grand voyage commence par un premier pas.", author: "Lao Tseu" },
        { text: "La perseverance n'est pas une longue course, c'est plusieurs courtes courses l'une apres l'autre.", author: "Walter Elliot" },
        { text: "Les grandes choses ne sont jamais faites par une seule personne, elles sont faites par une equipe.", author: "Steve Jobs" },
        { text: "Il n'y a qu'une facon d'echouer, c'est d'abandonner avant d'avoir reussi.", author: "Georges Clemenceau" },
        { text: "La motivation vous fait commencer. L'habitude vous fait continuer.", author: "Jim Ryun" },
        { text: "Ne jugez pas chaque journee par la recolte que vous faites, mais par les graines que vous plantez.", author: "Robert Louis Stevenson" },
        { text: "Le succes c'est tomber sept fois et se relever huit.", author: "Proverbe japonais" },
        { text: "Ce n'est pas parce que les choses sont difficiles que nous n'osons pas, c'est parce que nous n'osons pas qu'elles sont difficiles.", author: "Seneque" },
        { text: "La vie est 10% ce qui vous arrive et 90% comment vous y reagissez.", author: "Charles R. Swindoll" },
        { text: "L'impossible n'est pas un fait, c'est une opinion.", author: "Muhammad Ali" },
        { text: "Soyez le changement que vous voulez voir dans le monde.", author: "Gandhi" },
        { text: "Il n'est jamais trop tard pour devenir ce que vous auriez pu etre.", author: "George Eliot" },
        { text: "Votre seule limite, c'est vous.", author: "Inconnu" },
        { text: "Les difficultés preparent les gens ordinaires a un destin extraordinaire.", author: "C.S. Lewis" },
        { text: "Qui veut deplacer une montagne commence par deplacer de petites pierres.", author: "Confucius" },
        { text: "Le talent gagne des matchs, mais le travail d'equipe gagne des championnats.", author: "Michael Jordan" },
        { text: "La discipline est le pont entre les objectifs et l'accomplissement.", author: "Jim Rohn" },
        { text: "Tout ce que l'esprit peut concevoir et croire, il peut le realiser.", author: "Napoleon Hill" },
        { text: "Un pessimiste voit la difficulte dans chaque opportunite, un optimiste voit l'opportunite dans chaque difficulte.", author: "Winston Churchill" }
    ],
    amour: [
        { text: "Aimer, ce n'est pas se regarder l'un l'autre, c'est regarder ensemble dans la meme direction.", author: "Antoine de Saint-Exupery" },
        { text: "Le plus beau voyage est celui qu'on n'a pas encore fait.", author: "Loick Peyron" },
        { text: "On ne voit bien qu'avec le coeur. L'essentiel est invisible pour les yeux.", author: "Le Petit Prince" },
        { text: "L'amour ne se predit pas, il se construit.", author: "Inconnu" },
        { text: "Le bonheur n'est reel que lorsqu'il est partage.", author: "Christopher McCandless" },
        { text: "La mesure de l'amour, c'est d'aimer sans mesure.", author: "Saint Augustin" },
        { text: "Etre profondement aime par quelqu'un vous donne de la force, tandis qu'aimer profondement quelqu'un vous donne du courage.", author: "Lao Tseu" },
        { text: "L'amour est la seule chose qui grandit quand on la partage.", author: "Antoine de Saint-Exupery" },
        { text: "Le coeur a ses raisons que la raison ne connait point.", author: "Blaise Pascal" },
        { text: "Aimer ce n'est pas seulement aimer bien, c'est surtout comprendre.", author: "Françoise Sagan" },
        { text: "Un seul etre vous manque, et tout est depeuple.", author: "Alphonse de Lamartine" },
        { text: "L'amour n'a pas d'age, il est toujours naissant.", author: "Blaise Pascal" },
        { text: "La plus belle chose au monde est de voir une personne sourire, et encore plus belle de savoir que c'est grace a vous.", author: "Inconnu" },
        { text: "L'amour, c'est etre stupide ensemble.", author: "Paul Valery" },
        { text: "Le veritable amour commence quand rien n'est attend en retour.", author: "Antoine de Saint-Exupery" },
        { text: "Aimer, c'est donner raison a l'etre aime qui a tort.", author: "Charles Peguy" },
        { text: "Il n'y a rien de plus precieux en ce monde que le sentiment d'exister pour quelqu'un.", author: "Victor Hugo" },
        { text: "L'amour est une fumee faite de la vapeur des soupirs.", author: "William Shakespeare" },
        { text: "Quand l'amour n'est pas folie, ce n'est pas l'amour.", author: "Pedro Calderon de la Barca" },
        { text: "Vivre sans aimer n'est pas proprement vivre.", author: "Moliere" },
        { text: "L'amour est un feu qui devore sans qu'on le sente.", author: "Corneille" },
        { text: "La vie sans amour est un arbre sans fleurs ni fruits.", author: "Khalil Gibran" },
        { text: "L'amour est le seul tresor qui ne se multiplie que lorsqu'il est divise.", author: "Inconnu" },
        { text: "Aime et fais ce que tu veux.", author: "Saint Augustin" },
        { text: "Dans le vrai amour, c'est l'ame qui enveloppe le corps.", author: "Friedrich Nietzsche" }
    ]
};

let currentQuoteCategory = 'motivation';
let lastQuoteIndex = -1;

function getRandomQuote(category) {
    const pool = QUOTES[category];
    let index;
    do {
        index = Math.floor(Math.random() * pool.length);
    } while (index === lastQuoteIndex && pool.length > 1);
    lastQuoteIndex = index;
    return pool[index];
}

function displayQuote(category) {
    const quote = getRandomQuote(category);
    const textEl = document.getElementById('quoteText');
    const authorEl = document.getElementById('quoteAuthor');
    if (!textEl || !authorEl) return;

    // Animation de transition
    textEl.style.opacity = '0';
    authorEl.style.opacity = '0';

    setTimeout(() => {
        textEl.textContent = `"${quote.text}"`;
        authorEl.textContent = `— ${quote.author}`;
        textEl.style.opacity = '1';
        authorEl.style.opacity = '1';
    }, 300);
}

// Initialisation citations
document.addEventListener('DOMContentLoaded', () => {
    displayQuote(currentQuoteCategory);

    document.getElementById('newQuoteBtn')?.addEventListener('click', () => {
        displayQuote(currentQuoteCategory);
    });

    document.querySelectorAll('.quote-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.quote-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentQuoteCategory = btn.dataset.category;
            lastQuoteIndex = -1;
            displayQuote(currentQuoteCategory);
        });
    });

    // Rotation automatique toutes les 45 secondes
    setInterval(() => displayQuote(currentQuoteCategory), 45000);
});


// ──────────────────────────────────────────────
// Meteo en direct — Open-Meteo (gratuit, sans cle API)
// ──────────────────────────────────────────────
const WEATHER_CODES = {
    0: { label: 'Ciel degage', icon: '☀️' },
    1: { label: 'Principalement degage', icon: '🌤️' },
    2: { label: 'Partiellement nuageux', icon: '⛅' },
    3: { label: 'Couvert', icon: '☁️' },
    45: { label: 'Brouillard', icon: '🌫️' },
    48: { label: 'Brouillard givrant', icon: '🌫️' },
    51: { label: 'Bruine legere', icon: '🌦️' },
    53: { label: 'Bruine moderee', icon: '🌦️' },
    55: { label: 'Bruine dense', icon: '🌧️' },
    61: { label: 'Pluie legere', icon: '🌧️' },
    63: { label: 'Pluie moderee', icon: '🌧️' },
    65: { label: 'Pluie forte', icon: '🌧️' },
    71: { label: 'Neige legere', icon: '🌨️' },
    73: { label: 'Neige moderee', icon: '🌨️' },
    75: { label: 'Neige forte', icon: '❄️' },
    80: { label: 'Averses legeres', icon: '🌦️' },
    81: { label: 'Averses moderees', icon: '🌧️' },
    82: { label: 'Averses violentes', icon: '⛈️' },
    95: { label: 'Orage', icon: '⛈️' },
    96: { label: 'Orage avec grele', icon: '⛈️' },
    99: { label: 'Orage violent', icon: '⛈️' }
};

async function getCoordinates(city) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
        throw new Error('Ville introuvable');
    }

    const result = data.results[0];
    return {
        lat: result.latitude,
        lon: result.longitude,
        name: result.name,
        country: result.country || ''
    };
}

async function getWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=3`;
    const response = await fetch(url);
    return await response.json();
}

function renderWeather(location, data) {
    const content = document.getElementById('weatherContent');
    if (!content) return;

    const current = data.current;
    const weatherInfo = WEATHER_CODES[current.weather_code] || { label: 'Inconnu', icon: '❓' };

    let forecastHTML = '';
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    for (let i = 1; i < Math.min(data.daily.time.length, 3); i++) {
        const date = new Date(data.daily.time[i]);
        const dayName = days[date.getDay()];
        const fcInfo = WEATHER_CODES[data.daily.weather_code[i]] || { icon: '❓' };
        forecastHTML += `
            <div class="weather-forecast-day">
                <span class="forecast-day-name">${dayName}</span>
                <span class="forecast-icon">${fcInfo.icon}</span>
                <span class="forecast-temps">${Math.round(data.daily.temperature_2m_min[i])}° / ${Math.round(data.daily.temperature_2m_max[i])}°</span>
            </div>
        `;
    }

    content.innerHTML = `
        <div class="weather-main">
            <div class="weather-icon">${weatherInfo.icon}</div>
            <div class="weather-temp">${Math.round(current.temperature_2m)}°C</div>
        </div>
        <div class="weather-details">
            <div class="weather-city">${location.name}${location.country ? ', ' + location.country : ''}</div>
            <div class="weather-desc">${weatherInfo.label}</div>
            <div class="weather-extra">
                <span>💧 ${current.relative_humidity_2m}%</span>
                <span>💨 ${Math.round(current.wind_speed_10m)} km/h</span>
            </div>
        </div>
        <div class="weather-forecast">
            ${forecastHTML}
        </div>
    `;
}

function showWeatherError(message) {
    const content = document.getElementById('weatherContent');
    if (content) {
        content.innerHTML = `<div class="weather-error">${message}</div>`;
    }
}

async function fetchWeather(cityName) {
    const content = document.getElementById('weatherContent');
    if (content) content.innerHTML = '<div class="weather-loading">Chargement...</div>';

    try {
        const location = await getCoordinates(cityName);
        const weather = await getWeather(location.lat, location.lon);
        renderWeather(location, weather);
    } catch (error) {
        console.error('[Weather] Erreur:', error);
        showWeatherError('Impossible de charger la meteo. Verifiez le nom de la ville.');
    }
}

// Initialisation meteo
document.addEventListener('DOMContentLoaded', () => {
    const cityInput = document.getElementById('weatherCity');
    const searchBtn = document.getElementById('weatherSearchBtn');

    // Charger la meteo par defaut
    fetchWeather(cityInput?.value || 'Paris');

    searchBtn?.addEventListener('click', () => {
        const city = cityInput?.value.trim();
        if (city) fetchWeather(city);
    });

    cityInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const city = cityInput.value.trim();
            if (city) fetchWeather(city);
        }
    });

    // Rafraichir toutes les 15 min
    setInterval(() => {
        const city = cityInput?.value.trim();
        if (city) fetchWeather(city);
    }, 900000);
});
