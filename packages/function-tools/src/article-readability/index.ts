import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { logger } from '@krobert/utils';

/**
 * A utility type that makes all properties of T optional and allows them to be null.
 */
export type NullablePartial<T> = {
  [P in keyof T]?: T[P] | null;
};

/**
 * Result of the article extraction.
 */
export interface ArticleResult {
  title: string;
  content: string;
  textContent: string;
  length: number;
  excerpt: string;
  byline: string;
  dir: string;
  siteName: string;
  lang: string;
  publishedTime: string;
}

/**
 * Extracts the main content from an HTML string using @mozilla/readability.
 *
 * @param html The HTML content of the article.
 * @param url Optional URL of the article (helps resolve relative links).
 * @returns The parsed article content or null if parsing fails.
 */
export function extractArticleContent(
  html: string,
  url?: string,
): NullablePartial<ArticleResult> | null {
  try {
    const dom = new JSDOM(html, {
      url: url,
    });

    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return null;
    }

    // Since readability fields can be null or missing, NullablePartial handles this correctly
    return {
      title: article.title,
      content: article.content,
      textContent: article.textContent,
      length: article.length,
      excerpt: article.excerpt,
      byline: article.byline,
      dir: article.dir,
      siteName: article.siteName,
      lang: (article as any).lang, // Some fields might not be in ParseResult but are in the actual object
      publishedTime: (article as any).publishedTime,
    };
  } catch (error) {
    logger.error('[Tools] Error parsing article content:', error);

    return null;
  }
}
