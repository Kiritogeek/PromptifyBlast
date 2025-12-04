import { cleanOptimizedResponse } from '@/lib/utils'

describe('cleanOptimizedResponse', () => {
  test('should return empty string for null input', () => {
    expect(cleanOptimizedResponse(null)).toBe('');
  });

  test('should return empty string for empty string', () => {
    expect(cleanOptimizedResponse('')).toBe('');
  });

  test('should remove French intro phrases', () => {
    const input = 'Voici la version optimisée du prompt : Test prompt';
    expect(cleanOptimizedResponse(input)).toBe('Test prompt');
  });

  test('should remove English intro phrases', () => {
    const input = 'Here is the optimized prompt: Test prompt';
    expect(cleanOptimizedResponse(input)).toBe('Test prompt');
  });

  test('should remove outro phrases', () => {
    const input = 'Test prompt\nCette version optimisée du prompt ajoute de la structure.';
    expect(cleanOptimizedResponse(input)).toBe('Test prompt');
  });

  test('should remove quotes at start and end', () => {
    expect(cleanOptimizedResponse('"Test prompt"')).toBe('Test prompt');
    expect(cleanOptimizedResponse("'Test prompt'")).toBe('Test prompt');
    expect(cleanOptimizedResponse('`Test prompt`')).toBe('Test prompt');
  });

  test('should handle complex case with intro and outro', () => {
    const input = 'Voici la version optimisée du prompt : "Test prompt" Cette version optimisée du prompt ajoute de la structure.';
    expect(cleanOptimizedResponse(input)).toBe('Test prompt');
  });

  test('should preserve valid prompt content', () => {
    const input = 'Crée un benchmark de Toyota avec des caractéristiques uniques.';
    expect(cleanOptimizedResponse(input)).toBe('Crée un benchmark de Toyota avec des caractéristiques uniques.');
  });

  test('should trim whitespace', () => {
    expect(cleanOptimizedResponse('  Test prompt  ')).toBe('Test prompt');
  });
});

