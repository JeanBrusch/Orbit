import { supabase } from './supabase';
import { normalizePhone } from './phone-utils';

/**
 * Calcula um score de similaridade entre dois imóveis sem usar IA.
 * Regras:
 * - Mesmo Bairro: +50 pontos
 * - Faixa de Preço (+/- 15%): +30 pontos
 * - Mesmo número de quartos: +20 pontos
 */
export async function calculateSimilarityScore(sourceProperty: any, targetProperty: any): Promise<number> {
  let score = 0;

  // Bairro (50%)
  if (sourceProperty.neighborhood && targetProperty.neighborhood && 
      sourceProperty.neighborhood.toLowerCase() === targetProperty.neighborhood.toLowerCase()) {
    score += 50;
  }

  // Preço (30%)
  if (sourceProperty.value && targetProperty.value) {
    const diff = Math.abs(sourceProperty.value - targetProperty.value);
    const fifteenPercent = sourceProperty.value * 0.15;
    if (diff <= fifteenPercent) {
      score += 30;
    }
  }

  // Quartos (20%)
  if (sourceProperty.bedrooms && targetProperty.bedrooms && 
      sourceProperty.bedrooms === targetProperty.bedrooms) {
    score += 20;
  }

  return score;
}

/**
 * Busca imóveis similares na base Atlas (properties) para um lead específico.
 */
export async function findSimilarProperties(propertyId: string | null, limit = 3) {
  if (!propertyId) return [];
  
  // 1. Busca o imóvel de referência
  const { data: source, error: sourceError } = await (supabase as any)
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (sourceError || !source) return [];

  // 2. Busca candidatos no mesmo bairro ou faixa de preço
  // Para performance e simplicidade, pegamos uma amostra e rankeamos via código
  const { data: candidates, error: candidateError } = await supabase
    .from('properties')
    .select('id, title, neighborhood, value, bedrooms, internal_name')
    .neq('id', propertyId)
    .eq('status', 'active')
    .limit(50);

  if (candidateError || !candidates) return [];

  const scoredCandidates = await Promise.all(
    candidates.map(async (candidate) => ({
      ...candidate,
      similarity_score: await calculateSimilarityScore(source, candidate)
    }))
  );

  // Ordena por score e pega os top 3
  return scoredCandidates
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .filter(c => c.similarity_score > 0)
    .slice(0, limit);
}

/**
 * Gera o link do WhatsApp com a mensagem personalizada.
 */
export function generateWhatsAppLink(phone: string, name: string, message: string): string {
  const cleanPhone = normalizePhone(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
