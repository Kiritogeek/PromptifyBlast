import { validateEmail, isUnlimited, isAdmin } from '@/lib/utils'

describe('validateEmail', () => {
  test('should return true for valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true)
    expect(validateEmail('user.name@domain.co.uk')).toBe(true)
    expect(validateEmail('test+tag@example.com')).toBe(true)
  })

  test('should return false for invalid emails', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail('invalid')).toBe(false)
    expect(validateEmail('@example.com')).toBe(false)
    expect(validateEmail('test@')).toBe(false)
    expect(validateEmail('test @example.com')).toBe(false)
  })

  test('should trim whitespace', () => {
    expect(validateEmail('  test@example.com  ')).toBe(true)
  })
})

describe('isUnlimited', () => {
  test('should return true for unlimited values', () => {
    expect(isUnlimited(true)).toBe(true)
    expect(isUnlimited('true')).toBe(true)
    expect(isUnlimited(1)).toBe(true)
    expect(isUnlimited('1')).toBe(true)
  })

  test('should return false for limited values', () => {
    expect(isUnlimited(false)).toBe(false)
    expect(isUnlimited('false')).toBe(false)
    expect(isUnlimited(0)).toBe(false)
    expect(isUnlimited(null)).toBe(false)
    expect(isUnlimited(undefined)).toBe(false)
    expect(isUnlimited('')).toBe(false)
  })
})

describe('isAdmin', () => {
  test('should return true for admin values', () => {
    expect(isAdmin(true)).toBe(true)
    expect(isAdmin('true')).toBe(true)
    expect(isAdmin(1)).toBe(true)
  })

  test('should return false for non-admin values', () => {
    expect(isAdmin(false)).toBe(false)
    expect(isAdmin('false')).toBe(false)
    expect(isAdmin(0)).toBe(false)
    expect(isAdmin(null)).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
    expect(isAdmin('1')).toBe(false) // String '1' is not admin
  })
})

