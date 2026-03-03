import { BrandProfile } from '../types';

export const NEXT_BRAND: BrandProfile = {
  id: 'next-default',
  name: 'NEXT',
  isDefault: true,

  logotype: `The NEXT logotype is uppercase, custom-drawn (not typed in a font).
Available in black on white and white on black — no other colour combinations.
Only approved rotation: 90 degrees clockwise (retail/carrier bags only; rarely digital).
Clear-space padding must always surround the logotype.
Never stretch, distort, recolour, add effects, or place on busy backgrounds.
Brand partnerships — Primary: "BRAND AVAILABLE AT NEXT", Secondary: "SHOP BRAND".`,

  typography: `Primary font: Next Display Extended (sans-serif) — Light, Regular, Book, Medium, Bold, Extrabold.
Condensed variant: Next Display — same 6 weights.
Serif: Next Serif — Light, Book, Regular, Medium, Bold.
Type hierarchy:
  Large Heading: Next Display Extended Bold, tracking 5%, line-height 100%
  Large Heading Alt: Next Display Extended Medium, tracking 2%, line-height 100%
  Medium Heading: Next Display Extended Bold, tracking 10%, line-height 100%
  Medium Heading Alt: Next Display Extended Regular, tracking 0%, line-height 150%
  Small Heading: Next Display Extended Medium, tracking 10%, line-height 150%
  Paragraph: Next Display Extended Regular, tracking 0%, line-height 150%
Uppercase headings are standard. Lowercase only for conversational/softer messaging.
Scale typography in 140% increments. Go up/down one weight for emphasis.`,

  colour: `Black and white — brand bedrock since 1982.
White: #FFFFFF, RGB 255/255/255, CMYK 0/0/0/0, Pantone Brilliant White.
Black: #000000, RGB 0/0/0, CMYK 0/0/0/100, Pantone Black.
Logo usage: white on black or black on white only.`,

  ctas: `Box height = 2.5x font size. Horizontal padding = 1.5em.
Font weight: Medium. Letter-spacing: 2%.
Underlined text CTAs use text-decoration-skip-ink: auto.`,

  assets: `Google Drive: 12WnbWJDY0vSitMdOGwar58McNeCf-b3y
BrandIdentity/Logo/ — Logo files (PNG, JPG, PSD, PDF) and templates.
BrandIdentity/Fonts/ — Next Display, Next Display Extended, NextLogoFont.
BrandIdentity/BrandGuidelines/ — Brand Guidelines PDFs, Advert Examples.
Corporate imagery: https://media.next.co.uk/section/corporate/corporate-imagery?lang=eng&collection=stores`,

  rawText: '',
};

NEXT_BRAND.rawText = [
  '# NEXT Brand Identity',
  '',
  '## Logotype', NEXT_BRAND.logotype,
  '',
  '## Typography', NEXT_BRAND.typography,
  '',
  '## Colour', NEXT_BRAND.colour,
  '',
  '## Calls to Action', NEXT_BRAND.ctas,
  '',
  '## Assets', NEXT_BRAND.assets,
].join('\n');

const STORAGE_KEY = 'tensorax_brands';
const ACTIVE_KEY = 'tensorax_active_brand';

export function loadBrands(): BrandProfile[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const custom: BrandProfile[] = stored ? JSON.parse(stored) : [];
    return [NEXT_BRAND, ...custom.filter(b => b.id !== 'next-default')];
  } catch {
    return [NEXT_BRAND];
  }
}

export function saveBrands(brands: BrandProfile[]) {
  const custom = brands.filter(b => b.id !== 'next-default');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

export function getActiveBrandId(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) || 'next-default';
  } catch {
    return 'next-default';
  }
}

export function setActiveBrandId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function parseBrandDocument(text: string, fileName: string): BrandProfile {
  const name = fileName
    .replace(/\.(docx|pdf|txt|md)$/i, '')
    .replace(/brand\s*identity|guidelines|brand\s*guide/gi, '')
    .trim() || 'Custom Brand';

  const sections = {
    logotype: '',
    typography: '',
    colour: '',
    ctas: '',
    assets: '',
  };

  const sectionPatterns: [keyof typeof sections, RegExp][] = [
    ['logotype', /(?:^|\n)##?\s*(?:logo(?:type)?|brand\s*mark)/im],
    ['typography', /(?:^|\n)##?\s*(?:typography|typeface|fonts?)/im],
    ['colour', /(?:^|\n)##?\s*(?:colou?rs?|palette)/im],
    ['ctas', /(?:^|\n)##?\s*(?:call[s]?\s*to\s*action|cta|buttons?)/im],
    ['assets', /(?:^|\n)##?\s*(?:assets?|downloads?|resources?|files?)/im],
  ];

  for (const [key, pattern] of sectionPatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      const start = match.index + match[0].length;
      const nextHeading = text.slice(start).search(/\n##?\s/);
      sections[key] = text.slice(start, nextHeading > -1 ? start + nextHeading : undefined).trim();
    }
  }

  const hasAnySections = Object.values(sections).some(v => v.length > 0);
  if (!hasAnySections) {
    sections.logotype = text.trim();
  }

  return {
    id: `brand-${Date.now()}`,
    name,
    logotype: sections.logotype,
    typography: sections.typography,
    colour: sections.colour,
    ctas: sections.ctas,
    assets: sections.assets,
    rawText: text,
  };
}
