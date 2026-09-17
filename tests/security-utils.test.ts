import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSenegalesePhone,
  sanitizeInput
} from '../src/utils/securityUtils.ts';

describe('admin security utilities', () => {
  it('valide et formate un numéro sénégalais', () => {
    const result = validateSenegalesePhone('77 407 81 20');
    assert.equal(result.isValid, true);
    assert.equal(result.formatted, '+221 77 407 81 20');
    assert.equal(result.carrier, 'Orange / Wave');
  });

  it('accepte le préfixe international +221', () => {
    const result = validateSenegalesePhone('+221 78 123 45 67');
    assert.equal(result.isValid, true);
    assert.equal(result.formatted, '+221 78 123 45 67');
  });

  it('rejette un préfixe non reconnu', () => {
    const result = validateSenegalesePhone('72 123 45 67');
    assert.equal(result.isValid, false);
  });

  it('neutralise les balises et hooks XSS', () => {
    const cleaned = sanitizeInput('<img src=x onerror=alert(1)>javascript:evil');
    assert.equal(cleaned.includes('<'), false);
    assert.equal(cleaned.includes('>'), false);
    assert.equal(/on\w+=/i.test(cleaned), false);
    assert.equal(/javascript:/i.test(cleaned), false);
  });

  it('tronque les entrées à la longueur maximale', () => {
    assert.equal(sanitizeInput('a'.repeat(50), 10).length, 10);
  });
});
