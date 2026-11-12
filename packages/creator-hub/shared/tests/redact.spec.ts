import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { redactForSharing, redactText, truncateMiddle } from '../redact';

const SEED = 'abandon ability able about above absent absorb abstract absurd abuse access accident';

describe('when text holds a secret', () => {
  const cases: Array<[string, string, string]> = [
    ['an Anthropic key', 'use sk-ant-api03-exampleexampleexample00 please', 'api_key'],
    ['an OpenAI project key', 'key: sk-proj-exampleexampleexample1234', 'api_key'],
    ['a Google key', 'AIzaExampleExampleExampleExample12345', 'api_key'],
    ['a GitHub token', 'ghp_exampleexampleexampleexample1234', 'api_key'],
    ['a GitHub fine-grained token', 'github_pat_exampleexampleexample_1234', 'api_key'],
    ['a Slack token', 'xoxb-example-123456', 'api_key'],
    ['a Stripe live key', 'sk_live_exampleexample1234', 'api_key'],
    ['an AWS access key id', 'AKIAEXAMPLE000000000', 'api_key'],
    ['a wallet private key', `0x${'ab'.repeat(32)}`, 'private_key'],
    [
      'a PEM private key',
      '-----BEGIN PRIVATE KEY-----\nMIIexample\n-----END PRIVATE KEY-----',
      'private_key',
    ],
    ['a keystore ciphertext', `"ciphertext": "${'0f'.repeat(32)}"`, 'private_key'],
    ['a JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJleGFtcGxlIn0.ZXhhbXBsZXNpZw', 'jwt'],
    ['a .env line', 'OPENAI_API_KEY=example-value-123', 'credential'],
    ['a quoted .env line', 'DB_PASSWORD="example-pass"', 'credential'],
    ['a double-quoted passphrase', 'DB_PASSWORD="correct horse battery staple"', 'credential'],
    ['a single-quoted passphrase', "DB_PASSWORD='correct horse battery staple'", 'credential'],
    ['a JSON password', '{ "password": "hunter2!!" }', 'credential'],
    ['a YAML password', 'password: correct-horse-1', 'credential'],
    ['a camelCase API key with spaces', '{ "apiKey": "correct horse battery" }', 'credential'],
    ['a lowercase client secret', "client_secret = 'example-secret-value'", 'credential'],
    ['a lowercase Windows home folder', 'open c:\\users\\jane\\scenes', 'home_path'],
    ['URL credentials', 'https://jane:example-pass@db.example.com/x', 'credential'],
    [
      'a token in a query string',
      'https://api.example.com/v1?token=example123&page=2',
      'credential',
    ],
    ['a bearer token', 'Authorization: Bearer example.token-123', 'credential'],
    ['an email address', 'mail me at jane.doe@example.com', 'email'],
    ['an international phone number', 'call +1 555 010 0100', 'phone'],
    ['a dashed phone number', 'call 555-010-0100', 'phone'],
    ['an IP address', 'server at 203.0.113.42', 'ip'],
    ['a macOS home folder', 'open /Users/jane/scenes/mine/src/index.ts', 'home_path'],
    ['a Windows home folder', 'open C:\\Users\\jane\\scenes\\mine', 'home_path'],
    ['a seed phrase', `my wallet words are ${SEED} thanks`, 'seed_phrase'],
    ['a seed phrase with punctuation', `"${SEED.split(' ').join(', ')}".`, 'seed_phrase'],
    ['an unrecognised random token', 'token Zx9Q2mL7vK4pR8tW1nB6yH3jF5cD0sA2eG', 'secret'],
    ['a raw private key, as wallets export it', `key ${'ab'.repeat(32)} here`, 'private_key'],
    ['a seed phrase as a JSON array', JSON.stringify(SEED.split(' ')), 'seed_phrase'],
    ['a seed phrase joined by commas', SEED.split(' ').join(','), 'seed_phrase'],
    [
      'a seed phrase as a numbered list',
      SEED.split(' ')
        .map((w, i) => `${i + 1}. ${w}`)
        .join(' '),
      'seed_phrase',
    ],
    [
      'a seed phrase one word per line',
      SEED.split(' ')
        .map((w, i) => `${i + 1}) ${w}`)
        .join('\n'),
      'seed_phrase',
    ],
    [
      'a seed phrase as a markdown list',
      SEED.split(' ')
        .map(w => `- ${w}`)
        .join('\n'),
      'seed_phrase',
    ],
    ['a seed phrase joined by pipes', SEED.split(' ').join(' | '), 'seed_phrase'],
    ['a seed phrase joined by hyphens', SEED.split(' ').join('-'), 'seed_phrase'],
    [
      'a seed phrase numbered without dots',
      SEED.split(' ')
        .map((w, i) => `${i + 1} ${w}`)
        .join(' '),
      'seed_phrase',
    ],
    [
      'a seed phrase with JSON-escaped line breaks',
      JSON.stringify(SEED.split(' ').join('\n')),
      'seed_phrase',
    ],
    ['a base64 secret with slashes', 'secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', 'secret'],
    ['an escaped Windows home folder', '"C:\\\\Users\\\\jane\\\\scenes"', 'home_path'],
  ];

  it.each(cases)('should redact %s', (_name, input, kind) => {
    const { text, redactions } = redactText(input);

    expect(redactions[kind]).toBeGreaterThan(0);
    expect(text).not.toBe(input);
  });

  it('should keep the surrounding words', () => {
    const { text } = redactText('please use sk-ant-api03-exampleexampleexample00 for this');

    expect(text).toBe('please use <api_key> for this');
  });

  it('should replace a quoted passphrase whole, keeping its key', () => {
    expect(redactText('DB_PASSWORD="correct horse battery staple" next').text).toBe(
      'DB_PASSWORD=<credential> next',
    );
    expect(redactText('{ "password": "hunter2!!" }').text).toBe('{ "password": <credential> }');
  });

  it('should count a value both credential rules see only once', () => {
    expect(redactText('DB_PASSWORD="correct horse battery staple"').redactions).toEqual({
      credential: 1,
    });
  });

  it('should not run past an unterminated quote into the next line', () => {
    const text = 'API_KEY="never closed\nconst door = engine.addEntity()';

    expect(redactText(text).text.split('\n')[1]).toBe('const door = engine.addEntity()');
  });

  it('should name only the user in a home path, not the rest of it', () => {
    expect(redactText('/Users/jane/scenes/mine').text).toBe('/Users/<user>/scenes/mine');
  });

  it('should keep the parameter name of a redacted query value', () => {
    expect(redactText('https://x.example.com/?token=abc123def&page=2').text).toBe(
      'https://x.example.com/?token=<credential>&page=2',
    );
  });

  it('should be safe to run twice', () => {
    const once = redactText(`key sk-ant-api03-exampleexampleexample00 and ${SEED}`).text;

    expect(redactText(once).text).toBe(once);
  });
});

describe('when text holds nothing secret', () => {
  const keep = [
    'Add a door that opens when the player clicks it',
    'Transform.create(entity, { position: Vector3.create(8, 0, 8), scale: Vector3.One() })',
    "Material.setPbrMaterial(door, { albedoColor: Color4.fromHexString('#FF8800FF') })",
    'GltfContainer.create(tree, { src: "assets/scene/Models/tree01/tree01_bark_02.glb" })',
    'entity 512 at 16, 0, 16 and 32, 0, 32',
    'wallet 0x1234567890abcdef1234567890abcdef12345678 owns parcel -12,34',
    'content hash bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy',
    'id ec1042f3-6877-4123-8604-5f42c4af73f8',
    'commit 4c4b4efe8a1b2c3d4e5f60718293a4b5c6d7e8f9',
    'localhost at 127.0.0.1:8000',
    'const createEntityWithTransformAndPointerEvents = () => {}',
    'images/button@2x.png and icons/close@3x.webp',
    'const binding = { key: "Enter", action: "jump" }',
    'pointerKey = "click here"',
    'const secretDoor = "hidden"',
    'GET https://api.example.com/users/42/profile',
    'position 10.123.4567',
    'requires @dcl/sdk@7.10.2.1 or v7.10.2.1',
    '"src": "{assetPath}/DocksModuleStairs_01/DocksModuleStairs_01.glb"',
    'https://cdn.example.com/ccea595a-b910-4de6-b160-092819db021d/playlist.m3u8',
    'eleven bip words: abandon ability able about above absent absorb abstract absurd abuse access',
  ];

  it.each(keep)('should leave "%s" unchanged', input => {
    expect(redactText(input)).toEqual({ text: input, redactions: {} });
  });

  // Real scene code: every smart item in the asset packs. A redactor that rewrites any of it
  // would make the shared data useless, so the only thing allowed through is a real token.
  it('should leave the asset-pack smart items unchanged', () => {
    const packs = path.resolve(__dirname, '../../../asset-packs/packs');
    const changed: string[] = [];
    for (const file of fs.readdirSync(packs, { recursive: true }) as string[]) {
      if (!/\.(ts|tsx|json)$/.test(file)) continue;
      const source = fs.readFileSync(path.join(packs, file), 'utf8');
      const { redactions } = redactText(source);
      const kinds = Object.keys(redactions);
      // The audio_stream sample URL carries a real stream token (`rj-tok=…`), correctly caught.
      if (kinds.length > 0 && !(file.includes('audio_stream') && kinds.join() === 'secret')) {
        changed.push(`${file}: ${kinds.join(', ')}`);
      }
    }
    expect(changed).toEqual([]);
  });
});

describe('when text is long and odd', () => {
  it('should scan a long run of dotted words quickly, with no email in it', () => {
    const text = 'a.'.repeat(40_000);
    const started = performance.now();
    redactText(text);

    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('should still find an email at the end of such a run', () => {
    expect(redactText(`${'a.'.repeat(5_000)} jane.doe@example.com`).redactions.email).toBe(1);
  });
});

describe('when text is longer than the limit', () => {
  it('should keep the head and tail around a marker, within the limit', () => {
    const { text, truncated } = truncateMiddle('a'.repeat(60) + 'b'.repeat(40), 40);

    expect(truncated).toBe(true);
    expect(text).toBe(`${'a'.repeat(17)}[… 78 chars cut …]${'b'.repeat(5)}`);
    expect(Array.from(text)).toHaveLength(40);
  });

  it.each([30, 100, 500, 16_000, 32_000])(
    'should never exceed a limit of %i characters, marker included',
    max => {
      for (const length of [max + 1, max + 9, max * 3, max * 1000]) {
        const { text } = truncateMiddle('x'.repeat(length), max);
        expect(Array.from(text).length).toBeLessThanOrEqual(max);
      }
    },
  );

  it('should still respect a limit shorter than the marker', () => {
    expect(truncateMiddle('x'.repeat(50), 5)).toEqual({ text: 'xxxxx', truncated: true });
  });

  it('should never split an emoji in half', () => {
    const { text } = truncateMiddle('😀'.repeat(50), 10);

    expect(text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(text.startsWith('😀'.repeat(7))).toBe(true);
  });

  it('should leave text within the limit alone', () => {
    expect(truncateMiddle('short', 10)).toEqual({ text: 'short', truncated: false });
  });
});

describe('when preparing text for sharing', () => {
  it('should redact before truncating, so a cut cannot leave half a secret', () => {
    const key = 'sk-ant-api03-exampleexampleexample00';
    const result = redactForSharing(`${'x'.repeat(27)} ${key} ${'y'.repeat(30)}`, 40);

    expect(result.text).not.toContain('sk-ant');
    expect(result.text).not.toContain('example');
    expect(result.redactions).toEqual({ api_key: 1 });
  });

  it('should report the original length in characters', () => {
    const result = redactForSharing('😀😀😀', 100);

    expect(result).toEqual({ text: '😀😀😀', originalLength: 3, truncated: false, redactions: {} });
  });
});
