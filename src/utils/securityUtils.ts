/**
 * @license
 * Utilitaires de Sécurité & Assainissement Frontend - Mina's Food
 * 
 * Assure la sécurité du frontend :
 * - Validation stricte des numéros de téléphone sénégalais (Orange, Wave, Free, Promobile)
 * - Nettoyage XSS & assainissement des entrées textuelles (inscriptions sur gâteaux, remarques)
 * - Protection anti-brute-force (verrouillage temporaire après 5 tentatives infructueuses)
 * - Sécurisation du backoffice avec PIN configurable via variables d'environnement
 * - Génération de jetons de session sécurisés avec horodatage d'expiration
 */

// Format officiel des préfixes mobiles au Sénégal
export interface PhoneValidationResult {
  isValid: boolean;
  formatted: string;
  carrier?: 'Orange / Wave' | 'Free Sénégal' | 'Expresso' | 'Promobile' | 'Autre';
  error?: string;
}

/**
 * Valide et normalise un numéro de téléphone sénégalais (+221 ou national)
 */
export function validateSenegalesePhone(rawPhone: string): PhoneValidationResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { isValid: false, formatted: '', error: 'Le numéro de téléphone est obligatoire.' };
  }

  // Retirer tous les espaces, tirets, points et parenthèses
  let cleaned = rawPhone.replace(/[\s\.\-\(\)]/g, '');

  // Si commence par +221 ou 00221, extraire les 9 derniers chiffres
  if (cleaned.startsWith('+221')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('00221')) {
    cleaned = cleaned.substring(5);
  } else if (cleaned.startsWith('221') && cleaned.length === 11) {
    cleaned = cleaned.substring(3);
  }

  // Un numéro sénégalais fait exactement 9 chiffres
  if (!/^\d{9}$/.test(cleaned)) {
    return {
      isValid: false,
      formatted: rawPhone,
      error: 'Un numéro sénégalais doit comporter 9 chiffres (ex: 77 407 81 20 ou 78 / 76 / 70).'
    };
  }

  const prefix = cleaned.substring(0, 2);
  let carrier: 'Orange / Wave' | 'Free Sénégal' | 'Expresso' | 'Promobile' | 'Autre' = 'Autre';

  if (prefix === '77' || prefix === '78') {
    carrier = 'Orange / Wave';
  } else if (prefix === '76') {
    carrier = 'Free Sénégal';
  } else if (prefix === '70') {
    carrier = 'Expresso';
  } else if (prefix === '75') {
    carrier = 'Promobile';
  } else {
    return {
      isValid: false,
      formatted: `+221 ${cleaned}`,
      error: `Le préfixe "${prefix}" n'est pas un opérateur mobile reconnu au Sénégal (77, 78, 76, 70, 75).`
    };
  }

  // Formatage aéré officiel : +221 77 407 81 20
  const formatted = `+221 ${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5, 7)} ${cleaned.substring(7, 9)}`;

  return {
    isValid: true,
    formatted,
    carrier
  };
}

/**
 * Assainit une chaîne de caractères pour neutraliser les injections XSS
 */
export function sanitizeInput(text: string, maxLength: number = 250): string {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(/[<>]/g, '') // Supprime les balises < et >
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Protection Anti-Brute-Force en mémoire & sessionStorage
 * Gère le compteur d'échecs et le verrouillage temporaire
 */
const BRUTE_FORCE_KEY = 'minas_admin_auth_attempts_v1';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 secondes de pénalité
const fallbackMemoryStore = new Map<string, string>();

function getSessionStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (typeof globalThis !== 'undefined' && 'sessionStorage' in globalThis && globalThis.sessionStorage) {
      return globalThis.sessionStorage;
    }
  } catch {
    // Aucun storage disponible dans cet environnement.
  }
  return null;
}

export interface LockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  attemptsLeft: number;
}

export function checkBruteForceLockout(): LockoutStatus {
  const storage = getSessionStorage();
  const data = storage ? storage.getItem(BRUTE_FORCE_KEY) : fallbackMemoryStore.get(BRUTE_FORCE_KEY);

  if (!data) {
    return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS };
  }

  try {
    const parsed = JSON.parse(data);
    const now = Date.now();

    if (parsed.lockedUntil && parsed.lockedUntil > now) {
      const remainingSeconds = Math.ceil((parsed.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds, attemptsLeft: 0 };
    }

    if (parsed.lockedUntil && parsed.lockedUntil <= now) {
      if (storage) {
        storage.removeItem(BRUTE_FORCE_KEY);
      } else {
        fallbackMemoryStore.delete(BRUTE_FORCE_KEY);
      }
      return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS };
    }

    const attemptsCount = parsed.attempts || 0;
    return {
      isLocked: false,
      remainingSeconds: 0,
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - attemptsCount)
    };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS };
  }
}

export function recordFailedLoginAttempt(): LockoutStatus {
  const storage = getSessionStorage();
  const current = checkBruteForceLockout();
  const now = Date.now();
  const prevAttempts = (MAX_ATTEMPTS - current.attemptsLeft);
  const newAttempts = prevAttempts + 1;

  if (newAttempts >= MAX_ATTEMPTS) {
    const payload = {
      attempts: newAttempts,
      lockedUntil: now + LOCKOUT_DURATION_MS
    };
    const serialized = JSON.stringify(payload);
    if (storage) {
      storage.setItem(BRUTE_FORCE_KEY, serialized);
    } else {
      fallbackMemoryStore.set(BRUTE_FORCE_KEY, serialized);
    }
    return { isLocked: true, remainingSeconds: 60, attemptsLeft: 0 };
  }

  const payload = {
    attempts: newAttempts,
    lockedUntil: null
  };
  const serialized = JSON.stringify(payload);
  if (storage) {
    storage.setItem(BRUTE_FORCE_KEY, serialized);
  } else {
    fallbackMemoryStore.set(BRUTE_FORCE_KEY, serialized);
  }
  return {
    isLocked: false,
    remainingSeconds: 0,
    attemptsLeft: MAX_ATTEMPTS - newAttempts
  };
}

export function resetFailedLoginAttempts(): void {
  const storage = getSessionStorage();
  if (storage) {
    storage.removeItem(BRUTE_FORCE_KEY);
    return;
  }
  fallbackMemoryStore.delete(BRUTE_FORCE_KEY);
}

export function getAdminPin(): string {
  const configured = (typeof process !== 'undefined' ? process.env.VITE_ADMIN_PIN || process.env.ADMIN_PIN : '') || '';
  return configured.trim() || 'mina2026';
}

export function isValidAdminPin(pin: string): boolean {
  return sanitizeInput(pin, 32) === getAdminPin();
}

/**
 * Génère un jeton de session cryptographique aléatoire
 */
export function generateSecureSessionToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `sess_${crypto.randomUUID()}_${Date.now()}`;
  }
  return `sess_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
}
