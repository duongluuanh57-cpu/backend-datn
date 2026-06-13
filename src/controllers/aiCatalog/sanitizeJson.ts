/**
 * Sanitize JSON string — aggressively fixes common AI malformations:
 * - Unescaped quotes inside string values
 * - Newlines inside strings
 * - Strip invalid control characters
 * - Any remaining parse issues use regex fallback
 */
export function sanitizeJsonString(str: string): string {
  // Step 1: Normalize newlines
  let s = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Step 2: Remove BOM and other garbage
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');

  // Step 3: Handle unescaped quotes inside string values
  // Parse character by character tracking string boundaries
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === '\\' && inString) { result += ch; escaped = true; continue; }
    if (ch === '\\' && !inString) { result += ch; continue; }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
      } else {
        // Look ahead to determine if this " closes the string or is unescaped content
        let j = i + 1;
        while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n' || s[j] === '\r')) j++;
        const next = j < s.length ? s[j] : '\0';
        if (next === ',' || next === '}' || next === ']' || next === ':' || j >= s.length) {
          inString = false;
          result += ch;
        } else {
          // It's an unescaped quote inside a string — escape it
          result += '\\"';
        }
      }
      continue;
    }
    if (inString && (ch === '\n' || ch === '\r')) { result += '\\n'; continue; }
    if (inString && ch === '\t') { result += '\\t'; continue; }
    // Skip invalid control chars inside strings
    if (inString && ch.charCodeAt(0) < 32 && ch !== '\t') continue;
    result += ch;
  }

  return result;
}

/**
 * Aggressive JSON extraction: tries to find and parse a valid JSON object
 * from a messy string using regex + progressive fallback
 */
export function extractAndFixJson(raw: string): any {
  // Step 1: Try direct parse
  const clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch { /* continue */ }

  // Step 2: Sanitize + retry
  let fixed = clean.replace(/,(\s*[}\]])/g, '$1');
  fixed = sanitizeJsonString(fixed);
  try {
    return JSON.parse(fixed);
  } catch { /* continue */ }

  // Step 3: Aggressive regex — try to match { ... } object
  const objMatch = clean.match(/\{[\s\S]*\}/);
  if (!objMatch) throw new Error('No JSON object found in response');
  let jsonStr = objMatch[0];

  // Escape ALL unescaped quotes inside string values aggressively
  // by wrapping text values in backtick-like heuristic
  jsonStr = jsonStr
    // Remove any leftover markdown
    .replace(/^```[a-z]*\n?/g, '')
    .replace(/\n?```$/g, '')
    // Replace double backslash with placeholder
    .replace(/\\\\/g, '\x00')
    // Replace all single backslashes that aren't escaping a valid char
    .replace(/\\([^"\\\/bfnrtu])/g, '/$1')
    // Restore double backslash
    .replace(/\x00/g, '\\\\');

  // Re-escape newlines inside string values
  jsonStr = sanitizeJsonString(jsonStr);

  try {
    return JSON.parse(jsonStr);
  } catch {
    // Step 4: Last resort — strip all control chars and try once more
    jsonStr = jsonStr
      .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(jsonStr);
  }
}
