// Traduire les erreurs Firebase en francais
function traduireErreur(code) {
    const messages = {
        'auth/invalid-email': 'Adresse email invalide.',
        'auth/user-disabled': 'Ce compte a ete desactive.',
        'auth/user-not-found': 'Aucun compte avec cet email.',
        'auth/wrong-password': 'Mot de passe incorrect.',
        'auth/invalid-credential': 'Email ou mot de passe incorrect.',
        'auth/email-already-in-use': 'Cet email est deja utilise.',
        'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caracteres.',
        'auth/too-many-requests': 'Trop de tentatives. Reessayez plus tard.',
        'auth/network-request-failed': 'Erreur reseau. Verifiez votre connexion internet.',
        'auth/popup-closed-by-user': 'Connexion annulee.',
        'auth/operation-not-allowed': 'Connexion par email non activee dans Firebase. Activez Email/Password dans Firebase Console > Authentication > Sign-in method.'
    };
    return messages[code] || `Erreur: ${code}`;
}

function afficherErreur(div, message) {
    if (!div) return;
    div.textContent = message;
    div.style.display = 'block';
    setTimeout(() => { div.style.display = 'none'; }, 6000);
}

// Verifier si l'utilisateur est connecte
auth.onAuthStateChanged((user) => {
    const pagePath = window.location.pathname.toLowerCase();
    const page = pagePath.split('/').pop();
    const isAuthPage = page.includes('login') || page.includes('register');
    const isHome = page === '' || page.includes('index');
    
    console.log('[Auth] Etat:', user ? user.email : 'deconnecte', '| Page:', page);
    
    // Prevention boucle infinie sur "file://" 
    if (window.location.protocol === 'file:' && window.sessionStorage.getItem('file_protocol_warned') !== 'true') {
        console.warn("Attention: Firebase Auth ne partage pas la session entre les pages avec le protocole file:// sur les navigateurs modernes. Cela cause une boucle de redirection.");
        if (user && isAuthPage) {
            window.sessionStorage.setItem('file_protocol_warned', 'true');
            alert("Erreur Protocole file:// \nFirebase ne peut pas partager votre session entre login.html et dashboard.html en mode fichier local.\n\nVeuillez ouvrir ce projet avec un serveur web local (ex: VSCode Live Server, WAMP, XAMPP, npx serve).");
            return;
        }
    }

    if (user) {
        if (isAuthPage || isHome) {
            window.location.replace('dashboard.html');
        }
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = user.email.split('@')[0];
        }
    } else {
        if (!isAuthPage && !isHome) {
            window.location.replace('login.html');
        }
    }
});

// Gestion de la connexion
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('errorMessage');
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Connexion...';
        
        try {
            console.log('[Auth] Tentative de connexion:', email);
            await auth.signInWithEmailAndPassword(email, password);
            console.log('[Auth] Connexion reussie');
            // Son de connexion
            if (typeof ChronosSounds !== 'undefined') ChronosSounds.playLogin();
            
            // Prevention file://
            if (window.location.protocol === 'file:') {
                alert("Connecté ! Mais comme vous utilisez 'file://', la redirection vers dashboard.html va échouer (Local Storage isolé). Lancement d'un serveur local recommandé.");
            }
            setTimeout(() => { window.location.replace('dashboard.html'); }, 600);
        } catch (error) {
            console.error('[Auth] Echec connexion:', error.code, error.message);
            afficherErreur(errorDiv, traduireErreur(error.code));
            submitBtn.disabled = false;
            submitBtn.textContent = 'Se connecter';
        }
    });
}

// Gestion de l'inscription
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        
        if (password !== confirmPassword) {
            afficherErreur(errorDiv, 'Les mots de passe ne correspondent pas');
            return;
        }
        
        if (password.length < 6) {
            afficherErreur(errorDiv, 'Le mot de passe doit contenir au moins 6 caracteres');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creation...';
        
        try {
            console.log('[Auth] Tentative inscription:', email);
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            console.log('[Auth] Compte cree:', userCredential.user.uid);
            
            // Enregistrer le profil dans Firestore (non bloquant)
            db.collection('users').doc(userCredential.user.uid).set({
                username: username,
                email: email,
                createdAt: new Date()
            }).catch(err => console.warn('[Firestore] Profil non enregistre:', err.message));
            
            successDiv.textContent = 'Compte cree avec succes ! Redirection...';
            successDiv.style.display = 'block';
            
            // Prevention file://
            if (window.location.protocol === 'file:') {
                alert("Compte créé ! Mais comme vous utilisez 'file://', la redirection va échouer car votre navigateur isole la session. Veuillez lancer un Web Server local.");
            }
            setTimeout(() => {
                window.location.replace('dashboard.html');
            }, 1500);
        } catch (error) {
            console.error('[Auth] Echec inscription:', error.code, error.message);
            afficherErreur(errorDiv, traduireErreur(error.code));
            submitBtn.disabled = false;
            submitBtn.textContent = 'Creer mon compte';
        }
    });
}

// Gestion de la déconnexion
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
        window.location.href = 'login.html';
    });
}