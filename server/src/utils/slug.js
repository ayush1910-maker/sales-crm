import crypto from 'crypto';

/**
 * Generate a URL-friendly slug from a string with an optional unique suffix
 */
export const slugify = (text, addSuffix = true) => {
  const base = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text

  if (addSuffix) {
    const suffix = crypto.randomBytes(3).toString('hex');
    return `${base || 'org'}-${suffix}`;
  }

  return base || 'org';
};
