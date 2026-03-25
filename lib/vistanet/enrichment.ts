/**
 * Pipeline Enxuto de Enriquecimento Orbit
 * Implementa as 9 etapas de processamento conforme especificado.
 */

export interface RawVistaProperty {
  Codigo: string;
  Cidade?: string;
  Bairro?: string;
  ValorVenda?: string;
  Dormitorios?: string;
  Suites?: string;
  AreaPrivativa?: string;
  AreaTotal?: string;
  TituloSite?: string;
  DescricaoWeb?: string;
  [key: string]: any;
}

export interface EnrichedProperty {
  id: string;
  title: string;
  price: number | null;
  city: string;
  neighborhood: string;
  area_privativa: number;
  area_total: number;
  bedrooms: number;
  suites: number;
  description: string;
  features: string[];
  type: string;
  location_tags: string[];
  semantic_summary: string;
  score: number;
}

/** 🧱 ETAPA 3 — LIMPEZA DE TEXTO */
export function cleanText(text: string = ''): string {
  if (!text) return '';
  return text
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 🧱 ETAPA 2 — NORMALIZAÇÃO */
export function normalize(v: RawVistaProperty) {
  return {
    id: v.Codigo,
    title: cleanText(v.TituloSite || ''),
    price: parseMoney(v.ValorVenda),

    city: cleanText(v.Cidade || ''),
    neighborhood: cleanText(v.Bairro || ''),

    area_privativa: toNumber(v.AreaPrivativa),
    area_total: toNumber(v.AreaTotal),

    bedrooms: toNumber(v.Dormitorios),
    suites: toNumber(v.Suites),

    description: cleanText(v.DescricaoWeb || '')
  };
}

function parseMoney(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseFloat(value.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : Math.round(n);
}

function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value.replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/** 🧱 ETAPA 4 — EXTRAÇÃO DE FEATURES (SEM IA) */
const FEATURE_MAP = {
  churrasqueira: ['churrasqueira', 'churrasqueir'],
  lareira: ['lareira'],
  mobiliado: ['mobiliado', 'mobilia'],
  piscina: ['piscina'],
  patio: ['pátio', 'patio'],
  sacada: ['sacada'],
  vista_mar: ['vista para o mar', 'vista mar', 'frente mar', 'vista panorâmica']
};

export function extractFeatures(description: string): string[] {
  const text = description.toLowerCase();
  const found: string[] = [];

  for (const [key, variations] of Object.entries(FEATURE_MAP)) {
    if (variations.some(v => text.includes(v))) {
      found.push(key);
    }
  }

  return found;
}

/** 🧱 ETAPA 5 — CLASSIFICAÇÃO */
export function inferType(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase();

  if (text.includes('duplex')) return 'Duplex';
  if (text.includes('apartamento') || text.includes('apt')) return 'Apartamento';
  if (text.includes('casa')) return 'Casa';

  return 'Desconhecido';
}

export function inferLocationTags(description: string): string[] {
  const text = description.toLowerCase();
  const tags: string[] = [];

  if (text.includes('próximo ao mar') || text.includes('quadra do mar')) tags.push('próximo_ao_mar');
  if (text.includes('centro')) tags.push('central');
  if (text.includes('região de moradores')) tags.push('residencial');

  return tags;
}

/** 🧱 ETAPA 6 — SEMANTIC SUMMARY */
export function buildSummary(data: any, features: string[], type: string, locationTags: string[]): string {
  const parts: string[] = [];

  if (type !== 'Desconhecido') parts.push(type);

  if (data.bedrooms) parts.push(`${data.bedrooms} dormitórios`);
  if (data.suites) parts.push(`${data.suites} suíte`);

  if (data.area_privativa) parts.push(`${data.area_privativa}m²`);

  if (features.length) parts.push(features.join(', '));

  if (locationTags.includes('próximo_ao_mar')) parts.push('próximo ao mar');

  if (data.neighborhood && data.city) {
    parts.push(`${data.neighborhood}, ${data.city}`);
  }

  return parts.join(', ') + '.';
}

/** 🧱 ETAPA 7 — DESCRIÇÃO (Limpando clichês) */
export function cleanDescription(text: string = ''): string {
  return text
    .replace(/\n+/g, ' ')
    .replace(/\b(lindo|excelente|ótimo|imperd[ií]vel|maravilhoso|oportunidade|incrivel)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 🧱 ETAPA 8 — SCORE */
export function computeScore(data: any, features: string[], locationTags: string[]): number {
  let score = 0;

  score += data.bedrooms || 0;
  score += (data.suites || 0) * 2;

  if (features.includes('churrasqueira')) score += 2;
  if (features.includes('piscina')) score += 3;

  if (locationTags.includes('próximo_ao_mar')) score += 3;

  return score;
}

/** 🧱 ETAPA 9 — OBJETO FINAL */
export function enrichmentPipeline(v: RawVistaProperty): EnrichedProperty {
  const data = normalize(v);

  const features = extractFeatures(data.description);
  const type = inferType(data.title, data.description);
  const locationTags = inferLocationTags(data.description);

  const summary = buildSummary(data, features, type, locationTags);
  const coreDescription = cleanDescription(data.description);
  const score = computeScore(data, features, locationTags);

  return {
    ...data,
    description: coreDescription,
    features,
    type,
    location_tags: locationTags,
    semantic_summary: summary,
    score
  };
}

/** 🔧 Regra de fallback IA */
export function shouldUseAI(features: string[], description: string): boolean {
  if (!description || description.length < 40) return false;
  return features.length < 2;
}
