describe('Supabase Configuration', () => {
  test('should have required environment variables', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined()
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined()
  });

  test('should throw error if Supabase URL is missing', () => {
    const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    
    // Re-import to trigger the error
    jest.resetModules()
    
    expect(() => {
      require('@/lib/supabase')
    }).toThrow('Missing Supabase environment variables')
    
    // Restore
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv
  });

  test('should throw error if Supabase anon key is missing', () => {
    const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // Re-import to trigger the error
    jest.resetModules()
    
    expect(() => {
      require('@/lib/supabase')
    }).toThrow('Missing Supabase environment variables')
    
    // Restore
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv
  });
});

