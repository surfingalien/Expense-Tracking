// Default categories, icon/color maps and keyword-based category matching.

export interface DefaultCategory {
  name: string
  icon: string
  color: string
  budget: number | null
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Food & Dining', icon: 'UtensilsCrossed', color: '#f59e0b', budget: 400 },
  { name: 'Groceries', icon: 'ShoppingCart', color: '#84cc16', budget: 500 },
  { name: 'Shopping', icon: 'ShoppingBag', color: '#ec4899', budget: 300 },
  { name: 'Transportation', icon: 'Car', color: '#f97316', budget: 200 },
  { name: 'Entertainment', icon: 'Film', color: '#8b5cf6', budget: 150 },
  { name: 'Bills & Utilities', icon: 'Receipt', color: '#0d9488', budget: 450 },
  { name: 'Health', icon: 'HeartPulse', color: '#ef4444', budget: 200 },
  { name: 'Travel', icon: 'Plane', color: '#14b8a6', budget: 300 },
  { name: 'Education', icon: 'GraduationCap', color: '#a855f7', budget: 150 },
  { name: 'Other', icon: 'MoreHorizontal', color: '#6b7280', budget: null },
]

export const CATEGORY_PALETTE = DEFAULT_CATEGORIES.map((c) => c.color)

export const ALL_ICON_NAMES = [
  'UtensilsCrossed', 'ShoppingCart', 'ShoppingBag', 'Car', 'Film', 'Receipt',
  'HeartPulse', 'Plane', 'GraduationCap', 'MoreHorizontal', 'Tag', 'Coffee',
  'Zap', 'Home', 'Briefcase', 'Gift', 'Music', 'Dumbbell', 'Wrench',
  'PawPrint', 'Baby', 'BookOpen', 'Laptop', 'Shirt',
]

interface KeywordRule {
  category: string
  pattern: RegExp
}

// Ordered rules: first match wins.
const KEYWORD_RULES: KeywordRule[] = [
  {
    category: 'Groceries',
    pattern: /grocery|supermarket|whole foods|kroger|trader|safeway|aldi|costco|wegmans|publix|food lion|harris teeter|sprouts|walmart|market/i,
  },
  {
    category: 'Food & Dining',
    pattern: /starbucks|coffee|cafe|caf[eé]|restaurant|mcdonald|mc donald|burger|pizza|chipotle|kfc|taco|sandwich|deli|bakery|dunkin|domino|panera|subway|wingstop|dining|chick-?fil|five guys|shake shack|sushi|noodle|grill|bar & kitchen|diner/i,
  },
  {
    category: 'Transportation',
    pattern: /\buber\b|lyft|taxi|cab\b|gas station|\bshell\b|chevron|exxon|\bbp\b|fuel|metro|transit|subway card|parking|toll|harley|petrol/i,
  },
  {
    category: 'Entertainment',
    pattern: /netflix|spotify|cinema|\bamc\b|theater|theatre|movie|steam|playstation|xbox|hulu|disney|concert|game|arcade|bowling/i,
  },
  {
    category: 'Bills & Utilities',
    pattern: /electric|water bill|internet|utilit|comcast|xfinity|verizon|at&t|t-?mobile|mobile plan|phone bill|insurance|rent\b|cable|gas company/i,
  },
  {
    category: 'Health',
    pattern: /pharmac|cvs|walgreens|clinic|hospital|dental|dentist|medical|doctor|gym|fitness|optician|optical|therapy|labcorp/i,
  },
  {
    category: 'Travel',
    pattern: /airline|airways|\bdelta\b|hotel|airbnb|flight|marriott|hilton|hyatt|booking|expedia|resort|vacation|rental car|amtrak|air port|airport/i,
  },
  {
    category: 'Education',
    pattern: /udemy|coursera|bookstore|book shop|\bbooks\b|course|tuition|school|university|college|udacity|edx|kindle|barnes & noble|training/i,
  },
  {
    category: 'Shopping',
    pattern: /amazon|target|\bmall\b|best buy|ikea|home depot|lowe'?s|h&m|zara|nike|adidas|sephora|ulta|macy|etsy|ebay|apple store|apple|store|shop|boutique|clothing/i,
  },
]

/**
 * Match a scanned receipt to one of the available categories.
 * 1. exact / partial name match with the VLM's suggestion
 * 2. keyword rules against the VLM suggestion + merchant + item names
 * 3. fallback category (usually "Other")
 */
export function matchCategory(
  suggested: string | null | undefined,
  merchant: string,
  itemNames: string[],
  available: { id: string; name: string }[],
): string | null {
  const names = available.map((c) => ({ id: c.id, lower: c.name.toLowerCase() }))
  if (suggested) {
    const s = suggested.toLowerCase().trim()
    const exact = names.find((c) => c.lower === s)
    if (exact) return exact.id
    const partial = names.find((c) => c.lower.includes(s) || s.includes(c.lower))
    if (partial) return partial.id
  }
  const haystack = [suggested || '', merchant, ...itemNames].join(' ')
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(haystack)) {
      const hit = names.find((c) => c.lower === rule.category.toLowerCase())
      if (hit) return hit.id
    }
  }
  const fallback = names.find((c) => c.lower === 'other')
  return fallback?.id ?? available[0]?.id ?? null
}
