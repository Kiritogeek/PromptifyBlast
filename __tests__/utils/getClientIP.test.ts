import { getClientIP } from '@/lib/utils'

describe('getClientIP', () => {
  test('should return IP from x-forwarded-for header', () => {
    const headers = new Headers({
      'x-forwarded-for': '192.168.1.1',
    })
    const request = new Request('http://localhost', { headers })
    expect(getClientIP(request)).toBe('192.168.1.1')
  });

  test('should return first IP from x-forwarded-for with multiple IPs', () => {
    const headers = new Headers({
      'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1',
    })
    const request = new Request('http://localhost', { headers })
    expect(getClientIP(request)).toBe('192.168.1.1')
  });

  test('should return IP from x-real-ip header when x-forwarded-for is missing', () => {
    const headers = new Headers({
      'x-real-ip': '10.0.0.1',
    })
    const request = new Request('http://localhost', { headers })
    expect(getClientIP(request)).toBe('10.0.0.1')
  });

  test('should prioritize x-forwarded-for over x-real-ip', () => {
    const headers = new Headers({
      'x-forwarded-for': '192.168.1.1',
      'x-real-ip': '10.0.0.1',
    })
    const request = new Request('http://localhost', { headers })
    expect(getClientIP(request)).toBe('192.168.1.1')
  });

  test('should return 127.0.0.1 as fallback when no headers present', () => {
    const request = new Request('http://localhost')
    expect(getClientIP(request)).toBe('127.0.0.1')
  });

  test('should trim whitespace from IPs', () => {
    const headers = new Headers({
      'x-forwarded-for': '  192.168.1.1  ',
    })
    const request = new Request('http://localhost', { headers })
    expect(getClientIP(request)).toBe('192.168.1.1')
  });
});

