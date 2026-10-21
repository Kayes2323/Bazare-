/**
 * Category registry. The engine is category-agnostic: adding a category = adding an entry here
 * (aliases for understanding queries, `catalogNames` for matching legacy free-text `category` values).
 * Brand lists are hints for query understanding only; they are never shown as catalog facts.
 */
export interface CategoryDef {
  key: string;
  label: string;
  aliases: string[];        // words in user queries (normalised)
  catalogNames: string[];   // legacy values of products.category that belong here
  brands: { name: string; aliases: string[] }[];
  /** Optional regex (on normalised text) that implies this category and captures a model number. */
  modelPattern?: RegExp;
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: 'calculator',
    label: 'ক্যালকুলেটর',
    aliases: ['calculator', 'calculators', 'calculater', 'calc', 'ক্যালকুলেটর', 'ক্যাল্কুলেটর', 'কালকুলেটর', 'ক্যালকুলেটার', 'kalkuleytor', 'calculetor'],
    catalogNames: ['ক্যালকুলেটর', 'Calculator', 'calculator', 'Calculators', 'Scientific Calculator'],
    brands: [
      { name: 'casio', aliases: ['casio', 'ক্যাসিও', 'কাসিও', 'kasio'] },
      { name: 'citizen', aliases: ['citizen', 'সিটিজেন'] },
      { name: 'sharp', aliases: ['sharp', 'শার্প'] },
      { name: 'canon', aliases: ['canon', 'ক্যানন'] },
      { name: 'texas instruments', aliases: ['texas instruments', 'texas', 'ti'] },
      { name: 'kenko', aliases: ['kenko', 'কেনকো'] },
    ],
    modelPattern: /\b(fx|cs|sl|dj|hr|mj|jf|ms|kk)[\s-]?\d{2,4}[\s-]?(es|ex|ms|cw|sg|de|ce|w)?(\s?plus(\s?(2|ii))?)?\b/,
  },
];

export const categoryByKey = (key: string | null | undefined) => CATEGORIES.find((c) => c.key === key) ?? null;
