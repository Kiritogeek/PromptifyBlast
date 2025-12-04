# Guide des Tests - PromptifyBlast

## 📋 Configuration

Les tests sont configurés avec Jest et React Testing Library.

### Installation

```bash
npm install
```

### Exécution des tests

```bash
# Tous les tests
npm test

# Mode watch (développement)
npm run test:watch

# Avec couverture de code
npm run test:coverage
```

## 🧪 Tests Disponibles

### Tests Unitaires

1. **`__tests__/utils/cleanOptimizedResponse.test.ts`**
   - Teste le nettoyage des réponses optimisées
   - Vérifie la suppression des phrases d'introduction/conclusion
   - Vérifie la suppression des guillemets

2. **`__tests__/utils/getClientIP.test.ts`**
   - Teste la récupération de l'IP client
   - Vérifie la priorité des headers (x-forwarded-for > x-real-ip)
   - Vérifie le fallback vers 127.0.0.1

3. **`__tests__/utils/utils.test.ts`**
   - Teste `validateEmail()` - validation d'email
   - Teste `isUnlimited()` - vérification de statut illimité
   - Teste `isAdmin()` - vérification de statut admin

4. **`__tests__/lib/supabase.test.ts`**
   - Teste la configuration Supabase
   - Vérifie les variables d'environnement requises

## 📝 Structure des Tests

Les tests suivent la structure Jest standard :

```typescript
describe('FunctionName', () => {
  test('should do something', () => {
    expect(functionName(input)).toBe(expectedOutput)
  })
})
```

## 🎯 Couverture de Code

La couverture de code est configurée pour inclure :
- `app/**/*.{js,jsx,ts,tsx}`
- `components/**/*.{js,jsx,ts,tsx}`
- `lib/**/*.{js,jsx,ts,tsx}`

Exclut :
- Fichiers de définition TypeScript (`.d.ts`)
- `node_modules`
- `.next`
- `coverage`

## 🔧 Mocks

Les mocks suivants sont configurés dans `jest.setup.js` :
- Next.js router (`useRouter`, `usePathname`, `useSearchParams`)
- Variables d'environnement

## 📊 Objectifs de Couverture

- **Fonctions utilitaires** : 100%
- **API Routes** : 80%+
- **Composants React** : 70%+

## 🚀 Prochaines Étapes

1. Ajouter des tests d'intégration pour les API routes
2. Ajouter des tests E2E avec Playwright ou Cypress
3. Ajouter des tests de performance
4. Configurer CI/CD pour exécuter les tests automatiquement

