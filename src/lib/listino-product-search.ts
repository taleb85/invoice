/**
 * Ricerca prodotti listino multilingua (IT/EN) con sinonimi catering.
 * Espande la query per ILIKE e filtra con gruppi concetto per evitare falsi positivi.
 */

const SEARCH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'con',
  'da',
  'de',
  'del',
  'della',
  'di',
  'e',
  'for',
  'il',
  'in',
  'la',
  'le',
  'lo',
  'of',
  'per',
  'the',
  'un',
  'una',
  'with',
])

/** Gruppi di termini equivalenti (italiano ↔ inglese, varianti OCR). */
const PRODUCT_SYNONYM_GROUPS: readonly string[][] = [
  ['mozzarella', 'mozz'],
  ['bufala', 'buffalo', 'buffala'],
  ['farina', 'flour'],
  ['burro', 'butter'],
  ['formaggio', 'cheese'],
  ['panna', 'cream'],
  ['latte', 'milk'],
  ['uova', 'uovo', 'eggs', 'egg'],
  ['olio', 'oil'],
  ['oliva', 'olive'],
  ['extravergine', 'extra', 'virgin'],
  ['pomodoro', 'tomato', 'tomatoes'],
  ['basilico', 'basil'],
  ['aglio', 'garlic'],
  ['cipolla', 'onion', 'onions'],
  ['patata', 'patate', 'potato', 'potatoes'],
  ['riso', 'rice'],
  ['pasta'],
  ['pane', 'bread'],
  ['vino', 'wine'],
  ['birra', 'beer'],
  ['acqua', 'water'],
  ['gassata', 'sparkling'],
  ['frizzante', 'sparkling'],
  ['succo', 'juice'],
  ['limone', 'lemon'],
  ['arancia', 'orange'],
  ['mela', 'apple'],
  ['pera', 'pear'],
  ['fragola', 'strawberry', 'strawberries'],
  ['mirtillo', 'blueberry', 'blueberries'],
  ['lamponi', 'raspberry', 'raspberries'],
  ['more', 'blackberry', 'blackberries'],
  ['pesca', 'peach'],
  ['albicocca', 'apricot'],
  ['uva', 'grape', 'grapes'],
  ['banana', 'bananas'],
  ['ananas', 'pineapple'],
  ['avocado'],
  ['melanzana', 'aubergine', 'eggplant'],
  ['zucchina', 'zucchini', 'courgette'],
  ['carota', 'carrots', 'carrot'],
  ['sedano', 'celery'],
  ['insalata', 'lettuce', 'salad'],
  ['rucola', 'rocket', 'arugula'],
  ['spinaci', 'spinach'],
  ['funghi', 'mushroom', 'mushrooms'],
  ['tartufo', 'truffle'],
  ['pollo', 'chicken'],
  ['tacchino', 'turkey'],
  ['manzo', 'beef'],
  ['vitello', 'veal'],
  ['maiale', 'pork'],
  ['agnello', 'lamb'],
  ['salmone', 'salmon'],
  ['tonno', 'tuna'],
  ['gamberi', 'gambero', 'shrimp', 'prawn', 'prawns'],
  ['cozze', 'mussel', 'mussels'],
  ['vongole', 'clam', 'clams'],
  ['calamari', 'squid'],
  ['acciughe', 'anchovy', 'anchovies'],
  ['prosciutto', 'ham'],
  ['salame', 'salami'],
  ['mortadella'],
  ['pancetta', 'bacon'],
  ['salsiccia', 'sausage'],
  ['speck'],
  ['parmigiano', 'parmesan', 'grana'],
  ['pecorino'],
  ['gorgonzola'],
  ['ricotta'],
  ['mascarpone'],
  ['yogurt', 'yoghurt'],
  ['zucchero', 'sugar'],
  ['sale', 'salt'],
  ['pepe', 'pepper'],
  ['caffe', 'coffee'],
  ['te', 'tea'],
  ['cioccolato', 'chocolate'],
  ['vaniglia', 'vanilla'],
  ['cannella', 'cinnamon'],
  ['menta', 'mint'],
  ['prezzemolo', 'parsley'],
  ['rosmarino', 'rosemary'],
  ['salvia', 'sage'],
  ['origano', 'oregano'],
  ['timo', 'thyme'],
  ['capperi', 'capers'],
  ['olive'],
  ['tonno'],
  ['surgelato', 'frozen'],
  ['fresco', 'fresh'],
  ['bio', 'organic'],
  ['integrale', 'wholemeal', 'wholegrain'],
]

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .trim()
}

function singularizeToken(token: string): string {
  if (token.length <= 3) return token
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2)
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1)
  return token
}

export function tokenizeProductSearchQuery(query: string): string[] {
  const tokens = normalizeSearchText(query)
    .replace(/[+&/]/g, ' ')
    .split(/\s+/)
    .map((t) => singularizeToken(t))
    .filter((t) => t.length >= 2 && !SEARCH_STOP_WORDS.has(t))

  return [...new Set(tokens)]
}

function groupForToken(token: string): string[] {
  const normalized = singularizeToken(normalizeSearchText(token))
  for (const group of PRODUCT_SYNONYM_GROUPS) {
    const hit = group.some((term) => {
      const t = normalizeSearchText(term)
      return (
        normalized === t ||
        normalized.includes(t) ||
        t.includes(normalized)
      )
    })
    if (hit) return [...group]
  }
  return [normalized]
}

/** Gruppi concetto: ogni gruppo deve comparire nel nome prodotto (anche in lingua diversa). */
export function getSearchConceptGroups(query: string): string[][] {
  const tokens = tokenizeProductSearchQuery(query)
  if (tokens.length === 0) {
    const whole = normalizeSearchText(query)
    return whole.length >= 2 ? [[whole]] : []
  }
  return tokens.map((token) => groupForToken(token))
}

export function expandProductSearchTerms(query: string): string[] {
  const terms = new Set<string>()
  const whole = normalizeSearchText(query)
  if (whole.length >= 2) terms.add(whole)

  for (const group of getSearchConceptGroups(query)) {
    for (const term of group) {
      const t = normalizeSearchText(term)
      if (t.length >= 2) terms.add(t)
    }
  }

  return [...terms]
    .filter((t) => t.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, 12)
}

function productTokens(productName: string): string[] {
  return normalizeSearchText(productName)
    .replace(/[+&/]/g, ' ')
    .split(/\s+/)
    .map((t) => singularizeToken(t))
    .filter((t) => t.length >= 2)
}

function termMatchesProduct(term: string, tokens: string[], productNorm: string): boolean {
  const t = normalizeSearchText(term)
  if (t.length < 2) return false
  if (productNorm.includes(t)) return true
  return tokens.some(
    (pt) => pt === t || pt.includes(t) || t.includes(pt),
  )
}

export function matchesSearchConceptGroups(productName: string, groups: string[][]): boolean {
  if (!productName.trim() || groups.length === 0) return false
  const productNorm = normalizeSearchText(productName)
  const tokens = productTokens(productName)
  return groups.every((group) =>
    group.some((term) => termMatchesProduct(term, tokens, productNorm)),
  )
}

export function matchesProductSearchQuery(query: string, productName: string): boolean {
  const groups = getSearchConceptGroups(query)
  if (groups.length === 0) return false
  return matchesSearchConceptGroups(productName, groups)
}

export function buildProductSearchOrFilter(
  query: string,
  escape: (raw: string) => string,
): string {
  const terms = expandProductSearchTerms(query)
  if (terms.length === 0) {
    return `prodotto.ilike.%${escape(query)}%`
  }
  return terms
    .map((term) => `prodotto.ilike.%${escape(term)}%`)
    .join(',')
}
