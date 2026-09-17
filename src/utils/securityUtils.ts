/**
 * @license
 * Utilitaires de Sécurité & Assainissement Frontend - Mina's Food
 * 
 * Assure la sécurité du frontend :
 * - Validation stricte des numéros de téléphone sénégalais (Orange, Wave, Free, Promobile)
 * - Nettoyage XSS & assainissement des entrées textuelles (inscriptions sur gâteaux, remarques)
 *
 * L'authentification du backoffice et l'anti-bruteforce sont gérés côté serveur :
 * aucun code PIN n'est embarqué dans le bundle client.
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
 * Note de sécurité
 * -----------------
 * Le PIN administrateur n'est JAMAIS embarqué côté client. L'authentification
 * et le verrouillage anti-bruteforce sont entièrement gérés par l'API serveur
 * (/api/admin/login). Le client se contente de transmettre le PIN saisi.
 */
