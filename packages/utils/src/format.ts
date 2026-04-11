import { DateTime } from 'luxon';

export function escapeHTML(str: string) {
  const supportedTags = [
    'b',
    'strong',
    'bold',
    'i',
    'em',
    'code',
    's',
    'strike',
    'del',
    'u',
    'pre',
    'a',
  ];
  const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  return str.replace(/<\/?([a-z0-9]+)[^>]*>/gi, (match, tagName) => {
    if (match === '<li>') {
      return '- ';
    }
    if (match === '</li>') {
      return '';
    }
    if (headingTags.includes(tagName.toLowerCase())) {
      return `${match.replace(tagName, 'b')}`;
    }
    if (match === '</p>') {
      return '\n';
    }
    return supportedTags.includes(tagName.toLowerCase()) ? match : '';
  });
}

export function formatTime(
  date: Date | string,
  {
    format = 'yyyy-MM-dd HH:mm:ss ZZZZ',
    timezone = '',
  }: { format?: string; timezone?: string } = {},
) {
  const dateTime = typeof date === 'string' ? DateTime.fromISO(date) : DateTime.fromJSDate(date);

  if (timezone) {
    return dateTime.setZone(timezone).toFormat(format);
  }

  return dateTime.toFormat(format);
}
