export function computeMatch(property: any, lead: any) {
  if (!lead || !property) return null;
  
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. Orçamento (Peso 3)
  const propPrice = property.value || 0;
  const leadBudget = lead.budget || 0;
  if (leadBudget > 0 && propPrice > 0) {
    if (propPrice <= leadBudget) {
      score += 3;
      reasons.push("Dentro do orçamento");
    } else if (propPrice <= leadBudget * 1.1) {
      score += 1;
      warnings.push("Levemente acima do budget");
    } else {
      warnings.push("Acima do orçamento");
    }
  }

  // 2. Dormitórios (Peso 2)
  const propBeds = property.bedrooms || 0;
  const leadBeds = lead.desired_bedrooms || lead.bedrooms || 0;
  if (leadBeds > 0) {
    if (propBeds >= leadBeds) {
      score += 2;
      reasons.push(`${propBeds} dormitórios`);
    } else {
      warnings.push("Menos dormitórios que o ideal");
    }
  }

  // 3. Características (Peso 2 por match)
  const propFeatures = property.features || [];
  const leadFeatures = (lead.preferred_features || lead.desired_features || []) as string[];
  if (leadFeatures.length > 0) {
    const matchedFeatures = propFeatures.filter((f: string) => 
      leadFeatures.some((lf: string) => f.toLowerCase().includes(lf.toLowerCase()))
    );
    if (matchedFeatures.length > 0) {
      score += matchedFeatures.length * 2;
      matchedFeatures.forEach((f: string) => reasons.push(f));
    }
  }

  // 4. Localização (Peso 2)
  const propNeighborhood = property.neighborhood?.toLowerCase() || "";
  const propLocationText = property.locationText?.toLowerCase() || "";
  // preferred_area pode ser string ou array
  const leadArea = lead.preferred_area || "";
  const leadLocations = Array.isArray(leadArea) ? leadArea : leadArea ? [leadArea] : [];
  if (leadLocations.length > 0) {
    if (leadLocations.some((loc: string) => 
      propNeighborhood.includes(loc.toLowerCase()) || propLocationText.includes(loc.toLowerCase())
    )) {
      score += 2;
      reasons.push("Localização desejada");
    }
  }

  return {
    score: Math.min(score, 10),
    scorePercentage: Math.min(score * 10, 100),
    reasons,
    warnings
  };
}
