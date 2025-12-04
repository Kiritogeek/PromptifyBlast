import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-server';
import { cleanOptimizedResponse, isUnlimited, getClientIP } from '@/lib/utils';

// Configuration Groq (gratuit et rapide)
const groqApiKey = process.env.GROQ_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

// Client Groq
const groqClient = groqApiKey ? new OpenAI({
  apiKey: groqApiKey,
  baseURL: "https://api.groq.com/openai/v1",
}) : null;

// Client OpenAI (fallback)
const openaiClient = openaiApiKey && openaiApiKey !== "ta_clef_ici" ? new OpenAI({
  apiKey: openaiApiKey,
}) : null;

// Fonction pour vérifier et incrémenter le compteur de générations
async function checkAndIncrementGenerations(userId: string | null, userEmail: string | null, req: Request): Promise<{ allowed: boolean; error?: string }> {
  // Vérifier les variables d'environnement Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[GENERATE] Variables d\'environnement Supabase manquantes:', {
      NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnonKey
    });
    return { allowed: false, error: 'Configuration serveur incomplète. Veuillez contacter le support.' };
  }

  const cookieStore = cookies();
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  } as any);
  
  const today = new Date().toISOString().split('T')[0];

  try {
    // IMPORTANT : Si l'utilisateur est connecté, utiliser UNIQUEMENT son profil (pas l'IP)
    // Cela empêche la création de plusieurs comptes pour contourner la limite
    if (userId && userEmail) {
      // Utilisateur connecté : vérifier dans la table profiles
      // IMPORTANT: Utiliser supabaseAdmin pour bypasser RLS et récupérer toutes les données
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
        return { allowed: false, error: 'Erreur lors de la vérification du profil' };
      }

      if (!profile) {
        // Créer le profil s'il n'existe pas
        const { error: insertError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            daily_generations: 0,
            last_reset: today,
            is_premium: false,
            unlimited_prompt: false, // Par défaut, générations limitées
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
          return { allowed: false, error: 'Erreur lors de la création du profil' };
        }

        // Première génération autorisée
        await supabaseAdmin
          .from('profiles')
          .update({
            daily_generations: 1,
            last_reset: today,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        return { allowed: true };
      }

      // ⚠️⚠️⚠️ VÉRIFICATION CRITIQUE : Vérifier unlimited_prompt AVANT toute autre vérification
      // Cette vérification doit être la PREMIÈRE chose à faire pour les utilisateurs connectés
      // Si unlimited_prompt = TRUE, on retourne immédiatement { allowed: true } sans aucune autre vérification
      const hasUnlimited = isUnlimited(profile.unlimited_prompt);
      
      if (hasUnlimited) {
        // unlimited_prompt = TRUE = illimité, pas de vérification de limite, pas d'incrémentation du compteur
        // On retourne immédiatement sans toucher au compteur daily_generations
        return { allowed: true };
      }
      

      // Vérifier si réinitialisation nécessaire (si last_reset n'est pas aujourd'hui)
      let dailyGenerations = profile.daily_generations || 0;
      if (profile.last_reset !== today) {
        // Réinitialiser le compteur dans la BDD
        const { error: resetError } = await supabaseAdmin
          .from('profiles')
          .update({
            daily_generations: 0,
            last_reset: today,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        
        if (resetError) {
          console.error('Error resetting daily generations:', resetError);
        } else {
          console.log('[GENERATE] Compteur réinitialisé pour userId:', userId, 'today:', today, 'last_reset était:', profile.last_reset);
        }
        dailyGenerations = 0;
      }

      // Log pour déboguer le problème de quota
      console.log('[GENERATE] Vérification quota: userId=', userId, 'dailyGenerations=', dailyGenerations, 'today=', today, 'last_reset=', profile.last_reset, 'unlimited_prompt=', profile.unlimited_prompt);

      // Vérifier la limite (3 par jour) - on bloque seulement si >= 3 (donc 4ème génération)
      if (dailyGenerations >= 3) {
        console.log('[GENERATE] Limite atteinte: dailyGenerations=', dailyGenerations, '>= 3');
        return { allowed: false, error: 'Vous avez atteint votre limite de 3 générations gratuites aujourd\'hui. Passez à Premium pour des générations illimitées !' };
      }

      // Incrémenter le compteur
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          daily_generations: dailyGenerations + 1,
          last_reset: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return { allowed: false, error: 'Erreur lors de la mise à jour du compteur' };
      }

      return { allowed: true };
    } else {
      // Utilisateur NON connecté : vérifier par IP uniquement
      // Note: Si l'utilisateur est connecté, on ne devrait JAMAIS arriver ici
      const ipAddress = getClientIP(req);
      
      // Log pour déboguer en production
      console.log('[GENERATE] Utilisateur non connecté, IP détectée:', ipAddress);
      
      const { data: ipUsage, error: ipError } = await supabaseAdmin
        .from('ip_usage')
        .select('*')
        .eq('ip_address', ipAddress)
        .maybeSingle();

      if (ipError && ipError.code !== 'PGRST116') {
        console.error('[GENERATE] Error fetching IP usage:', ipError);
        console.error('[GENERATE] IP address:', ipAddress);
        return { allowed: false, error: 'Erreur lors de la vérification IP' };
      }
      
      console.log('[GENERATE] IP usage trouvé:', ipUsage ? `daily_generations=${ipUsage.daily_generations}, last_reset=${ipUsage.last_reset}, today=${today}` : 'aucun');

      if (!ipUsage) {
        // Créer l'entrée IP avec 1 génération
        const { error: insertError } = await supabaseAdmin
          .from('ip_usage')
          .insert({
            ip_address: ipAddress,
            daily_generations: 1,
            last_reset: today,
            is_premium: false,
            unlimited_prompt: false, // Par défaut, générations limitées
          });

        if (insertError) {
          console.error('Error creating IP usage:', insertError);
          return { allowed: false, error: 'Erreur lors de la création de l\'entrée IP' };
        }

        return { allowed: true };
      }

      // Vérifier si unlimited_prompt = TRUE
      const hasUnlimited = isUnlimited(ipUsage.unlimited_prompt);
      if (hasUnlimited) {
        return { allowed: true }; // unlimited_prompt = TRUE = illimité
      }

      // Vérifier si réinitialisation nécessaire (si last_reset n'est pas aujourd'hui)
      let dailyGenerations = ipUsage.daily_generations || 0;
      if (ipUsage.last_reset !== today) {
        // Réinitialiser le compteur dans la BDD
        const { error: resetError } = await supabaseAdmin
          .from('ip_usage')
          .update({
            daily_generations: 0,
            last_reset: today,
            updated_at: new Date().toISOString(),
          })
          .eq('ip_address', ipAddress);
        
        if (resetError) {
          console.error('Error resetting IP daily generations:', resetError);
        } else {
        }
        dailyGenerations = 0;
      }

      // Vérifier la limite (3 par jour)
      console.log('[GENERATE] Vérification limite: dailyGenerations=', dailyGenerations, 'today=', today, 'last_reset=', ipUsage.last_reset);
      if (dailyGenerations >= 3) {
        console.log('[GENERATE] Limite atteinte pour IP:', ipAddress);
        return { allowed: false, error: 'Vous avez atteint votre limite de 3 générations gratuites aujourd\'hui. Connectez-vous et passez à Premium pour des générations illimitées !' };
      }

      // Incrémenter le compteur
      const { error: updateError } = await supabaseAdmin
        .from('ip_usage')
        .update({
          daily_generations: dailyGenerations + 1,
          last_reset: today,
          updated_at: new Date().toISOString(),
        })
        .eq('ip_address', ipAddress);

      if (updateError) {
        console.error('Error updating IP usage:', updateError);
        return { allowed: false, error: 'Erreur lors de la mise à jour du compteur IP' };
      }

      return { allowed: true };
    }
  } catch (error: any) {
    console.error('Error in checkAndIncrementGenerations:', error);
    return { allowed: false, error: 'Erreur serveur lors de la vérification' };
  }
}

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // Debug: vérifier les clés chargées

    const { text, mode, targetModel } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Aucun texte fourni" }, { status: 400 });
    }

    // Vérifier les variables d'environnement Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[GENERATE] Variables d\'environnement Supabase manquantes:', {
        NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnonKey
      });
      return NextResponse.json(
        { error: 'Configuration serveur incomplète. Les variables d\'environnement Supabase ne sont pas définies. Veuillez vérifier la configuration Vercel.' },
        { status: 500 }
      );
    }

    // Récupérer l'utilisateur connecté (si disponible)
    // Méthode 1: Depuis les headers (plus fiable que les cookies)
    const userIdFromHeader = req.headers.get('x-user-id');
    
    // Méthode 2: Depuis les cookies (fallback)
    const cookieStore = cookies();
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {}, // Pas besoin de set dans les API routes
        remove() {}, // Pas besoin de remove dans les API routes
      },
    } as any);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    let userId = user?.id || userIdFromHeader || null;
    let userEmail = user?.email || null;
    
    // Si on a l'ID depuis les headers mais pas l'email, récupérer l'email depuis la BDD
    if (userId && !userEmail) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (profile) {
        // Récupérer l'email depuis auth.users via supabaseAdmin
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        userEmail = authUser?.user?.email || null;
      }
    }

    // Vérifier et incrémenter le compteur AVANT de générer
    console.log('[GENERATE] Vérification avant génération: userId=', userId, 'userEmail=', userEmail);
    const { allowed, error: limitError } = await checkAndIncrementGenerations(userId, userEmail, req);
    
    if (!allowed) {
      console.log('[GENERATE] Génération refusée:', limitError);
      return NextResponse.json(
        { error: limitError || 'Limite de générations atteinte' },
        { status: 429 }
      );
    }
    
    console.log('[GENERATE] Génération autorisée, procédure...');

    // Map the mode from frontend to the format expected by the API
    const modeMap: Record<string, string> = {
      'basic': 'Basic Mode',
      'pro': 'Pro Mode',
      'ultra-optimized': 'Ultra-Optimized Mode'
    };

    const modeName = modeMap[mode] || 'Basic Mode';

    // Instructions spécifiques pour chaque mode
    let systemPrompt = '';
    let modeInstruction = '';

    if (mode === "basic") {
      systemPrompt = `
You are a professional AI Prompt Engineer.

Your job is to transform any user request into a better optimized prompt using classic optimization techniques.

CRITICAL LANGUAGE RULE:
- You MUST preserve the EXACT language of the original prompt.
- If the prompt is in French, write the optimized version in French.
- If the prompt is in English, write the optimized version in English.
- If the prompt is in another language, keep that language.
- Default to French if the language is unclear.

The optimized prompt must:
- add basic structure and clarity
- improve readability
- maintain the original intent
- be immediately usable

CRITICAL OUTPUT RULE:
- You MUST output ONLY the optimized prompt text, nothing else.
- Do NOT include any introductory phrases like "Voici la version optimisée du prompt :" or "Here is the optimized prompt:"
- Do NOT include any explanatory text after the prompt.
- Do NOT include phrases like "Cette version optimisée..." or "This optimized version..."
- Output ONLY the prompt itself, ready to be copied and used directly.

You NEVER answer the user's request.
You ONLY output the optimized prompt text, in the SAME LANGUAGE as the original, with NO additional commentary.
`;
      modeInstruction = "Apply classic optimization: improve structure, clarity, and readability while keeping it simple and straightforward.";
    } else if (mode === "pro") {
      systemPrompt = `
You are an expert AI Prompt Engineer specializing in comprehensive prompt optimization.

Your job is to deeply understand the user's intent and transform their request into a highly optimized, detailed, and professional prompt.

CRITICAL LANGUAGE RULE:
- You MUST preserve the EXACT language of the original prompt.
- If the prompt is in French, write the optimized version in French.
- If the prompt is in English, write the optimized version in English.
- If the prompt is in another language, keep that language.
- Default to French if the language is unclear.

The optimized prompt must:
- deeply understand and clarify the underlying need behind the user's request
- add comprehensive structure with clear sections
- define detailed constraints and requirements
- assign a specific AI role with context
- include formatting and output instructions
- add analytical depth and reasoning requirements
- consider edge cases and potential issues
- be immediately usable and professional

CRITICAL OUTPUT RULE:
- You MUST output ONLY the optimized prompt text, nothing else.
- Do NOT include any introductory phrases like "Voici la version optimisée du prompt :" or "Here is the optimized prompt:"
- Do NOT include any explanatory text after the prompt.
- Do NOT include phrases like "Cette version optimisée..." or "This optimized version..."
- Output ONLY the prompt itself, ready to be copied and used directly.

You NEVER answer the user's request.
You ONLY output the optimized prompt text, in the SAME LANGUAGE as the original, with NO additional commentary.
`;
      modeInstruction = "Make the prompt comprehensive, detailed, analytical, and professional. Deeply understand the user's underlying need and create a prompt that addresses it thoroughly.";
    } else {
      // ultra-optimized
      systemPrompt = `
You are a master AI Prompt Engineer specializing in ultra-optimized prompts for maximum AI performance.

Your job is to create the most complete, detailed, and perfectly optimized prompt possible, specifically tailored for the target AI model.

CRITICAL LANGUAGE RULE:
- You MUST preserve the EXACT language of the original prompt.
- If the prompt is in French, write the optimized version in French.
- If the prompt is in English, write the optimized version in English.
- If the prompt is in another language, keep that language.
- Default to French if the language is unclear.

The optimized prompt must:
- be extremely detailed and comprehensive
- include complete context and background information
- define all constraints, requirements, and edge cases
- assign a detailed AI role with full context
- include precise formatting, structure, and output specifications
- add advanced reasoning, analysis, and depth requirements
- optimize specifically for the target AI model's strengths
- include examples, guidelines, and best practices
- consider all possible scenarios and use cases
- be perfectly structured for maximum clarity and effectiveness

CRITICAL OUTPUT RULE:
- You MUST output ONLY the optimized prompt text, nothing else.
- Do NOT include any introductory phrases like "Voici la version optimisée du prompt :" or "Here is the optimized prompt:"
- Do NOT include any explanatory text after the prompt.
- Do NOT include phrases like "Cette version optimisée..." or "This optimized version..."
- Output ONLY the prompt itself, ready to be copied and used directly.

You NEVER answer the user's request.
You ONLY output the optimized prompt text, in the SAME LANGUAGE as the original, with NO additional commentary.
`;
      modeInstruction = "Push optimization to maximum: create an extremely detailed, comprehensive, and perfectly structured prompt with complete context, all constraints, advanced reasoning requirements, and specific optimizations for the target AI model.";
    }

    // Instructions spécifiques pour le modèle cible
    let targetModelInstruction = '';
    if (targetModel) {
      const modelInstructions: Record<string, string> = {
        'chatgpt': 'Optimize specifically for ChatGPT (GPT-4/GPT-3.5). Use clear instructions, structured format, and leverage ChatGPT\'s strengths in following detailed instructions and maintaining context.',
        'gemini': 'Optimize specifically for Google Gemini. Use clear, direct language, leverage Gemini\'s multimodal capabilities if relevant, and structure for Gemini\'s reasoning style.',
        'gork': 'Optimize specifically for Grok (xAI). Use conversational but structured format, leverage Grok\'s real-time knowledge and direct communication style.'
      };
      targetModelInstruction = modelInstructions[targetModel.toLowerCase()] || '';
    }

    const userMessage = `
User prompt to optimize:

"${text}"

IMPORTANT: Keep the EXACT same language as the original prompt above. If it's in French, respond in French. If it's in English, respond in English. Default to French if uncertain.

Rewrite it into the BEST possible optimized version, maintaining the original language.
Mode: ${modeName}
${targetModelInstruction ? `Target AI Model: ${targetModel}\n${targetModelInstruction}\n` : ''}
Instruction: ${modeInstruction}

REMEMBER: Output ONLY the optimized prompt text, with NO introductory phrases, NO explanatory text, and NO concluding remarks. Just the prompt itself.
    `;

    let optimized: string | null = null;
    let error: any = null;

    // Essayer d'abord avec Groq (gratuit et rapide)
    // Liste des modèles Groq à essayer dans l'ordre
    const groqModels = [
      "llama-3.1-8b-instant",  // Plus rapide et disponible
      "llama-3.1-70b-versatile",
      "mixtral-8x7b-32768",
      "llama-3-8b-8192"
    ];

    if (groqClient && groqApiKey) {
      for (const model of groqModels) {
        try {
          const completion = await groqClient.chat.completions.create({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            temperature: 0.4,
            max_tokens: 2000,
          });

          let rawOptimized = completion.choices[0].message.content;
          
          // Nettoyer la réponse : enlever les phrases d'introduction et de conclusion
          optimized = cleanOptimizedResponse(rawOptimized);
          break; // Sortir de la boucle si succès
        } catch (groqError: any) {
          error = groqError;
          // Continuer avec le modèle suivant si erreur 429 ou 404
          if (groqError.status === 429 || groqError.status === 404) {
            continue;
          } else {
            break; // Arrêter pour les autres erreurs
          }
        }
      }
    }

    // Fallback vers OpenAI si Groq échoue ou n'est pas configuré
    if (!optimized && openaiClient) {
      try {
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.4,
          max_tokens: 2000,
        });

        let rawOptimized = completion.choices[0].message.content;
        
        // Nettoyer la réponse : enlever les phrases d'introduction et de conclusion
        optimized = cleanOptimizedResponse(rawOptimized);
      } catch (openaiError: any) {
        error = openaiError;
      }
    }

    if (!optimized) {
      if (error?.status === 401) {
        return NextResponse.json(
          { error: "Clé API invalide. Vérifiez votre GROQ_API_KEY dans .env.local et redémarrez le serveur." },
          { status: 401 }
        );
      }
      
      if (error?.status === 429) {
        return NextResponse.json(
          { error: "Limite de requêtes atteinte. Attendez quelques secondes et réessayez. (Le fallback OpenAI sera tenté automatiquement)" },
          { status: 429 }
        );
      } else {
        return NextResponse.json(
          { error: `Erreur: ${error?.message || "Aucun service IA disponible"}. Vérifiez vos clés API dans .env.local et redémarrez le serveur.` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ result: optimized });
  } catch (error: any) {
    console.error("Erreur générale:", error);
    return NextResponse.json(
      { error: error?.message || "Erreur serveur lors de la génération" },
      { status: 500 }
    );
  }
}
