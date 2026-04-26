const FORBIDDEN_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta'];

export type SanitizedHtml = {
  html: string;
  removed: string[];
  warnings: string[];
};

export function sanitizeEmailHtml(input: string): SanitizedHtml {
  let html = input;
  const removed: string[] = [];

  for (const tag of FORBIDDEN_TAGS) {
    const blockPattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    if (blockPattern.test(html)) {
      removed.push(tag);
      html = html.replace(blockPattern, '');
    }

    const selfPattern = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    if (selfPattern.test(html)) {
      removed.push(tag);
      html = html.replace(selfPattern, '');
    }
  }

  html = html.replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, () => {
    removed.push('event-attribute');
    return '';
  });
  html = html.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, () => {
    removed.push('event-attribute');
    return '';
  });
  html = html.replace(/\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, (_match, attr) => {
    removed.push(`${attr}:javascript`);
    return '';
  });
  html = html.replace(/\s+style\s*=\s*(['"])(?=[\s\S]*?javascript:)[\s\S]*?\1/gi, () => {
    removed.push('style:javascript');
    return '';
  });

  return {
    html,
    removed: [...new Set(removed)],
    warnings: removed.length ? ['HTML contained unsafe tags or attributes and was sanitized.'] : [],
  };
}
