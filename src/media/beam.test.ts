import { describe, expect, it } from 'vitest';
import { b64u, beamToHash, decodeBeam, encodeBeam, expandSdp, minifySdp, parseBeamHash, unb64u } from './beam';

const FP = 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89';
// trimmed real Chrome offer (data channel only)
const CHROME_OFFER = [
  'v=0',
  'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:3967339870 1 udp 2113937151 0c5ff8b1-2b6e-4d0f-9a7a-3f2c5b1e9d44.local 54321 typ host generation 0 network-cost 999',
  'a=candidate:1 1 udp 2113937151 192.168.1.23 50000 typ host generation 0',
  'a=candidate:2 1 tcp 1518280447 192.168.1.23 9 typ host tcptype active generation 0',
  'a=candidate:3 2 udp 2113937150 192.168.1.23 50001 typ host generation 0',
  'a=candidate:4 1 udp 2113937151 fe80::1:2 50002 typ host generation 0',
  'a=ice-ufrag:Xy7+',
  'a=ice-pwd:aBcDeFgHiJkLmNoPqRsTuV/+12',
  'a=ice-options:trickle',
  `a=fingerprint:sha-256 ${FP}`,
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
].join('\r\n');

describe('sdp minify / expand', () => {
  it('keeps only the essentials (udp, component 1)', () => {
    const d = minifySdp(CHROME_OFFER, 'o')!;
    expect(d.ufrag).toBe('Xy7+');
    expect(d.pwd).toBe('aBcDeFgHiJkLmNoPqRsTuV/+12');
    expect(d.setup).toBe('actpass');
    expect(d.fp.length).toBe(32);
    expect(d.cands).toEqual([
      { ip: '0c5ff8b1-2b6e-4d0f-9a7a-3f2c5b1e9d44.local', port: 54321 },
      { ip: '192.168.1.23', port: 50000 },
      { ip: 'fe80::1:2', port: 50002 },
    ]);
  });

  it('expands to an SDP that minifies back to the same essentials', () => {
    const d = minifySdp(CHROME_OFFER, 'o')!;
    const sdp = expandSdp(d);
    expect(sdp).toContain('m=application 9 UDP/DTLS/SCTP webrtc-datachannel');
    expect(sdp).toContain(`a=fingerprint:sha-256 ${FP}`);
    expect(sdp.endsWith('\r\n')).toBe(true);
    expect(minifySdp(sdp, 'o')).toEqual(d);
  });

  it('rejects SDPs without the essentials or with another hash', () => {
    expect(minifySdp('v=0\r\n', 'o')).toBeNull();
    expect(minifySdp(CHROME_OFFER.replace('sha-256', 'sha-1'), 'o')).toBeNull();
    expect(minifySdp(CHROME_OFFER.replace('a=setup:actpass', 'a=setup:bogus'), 'o')).toBeNull();
  });
});

describe('beam code', () => {
  const offer = minifySdp(CHROME_OFFER, 'o')!;
  const answer = { ...minifySdp(CHROME_OFFER.replace('actpass', 'active'), 'a')!, cands: [{ ip: '10.0.0.7', port: 6000 }] };

  it('round-trips offer and answer', () => {
    expect(decodeBeam(encodeBeam(offer))).toEqual(offer);
    expect(decodeBeam(encodeBeam(answer), 'a')).toEqual(answer);
  });

  it('is short and URL-fragment safe', () => {
    const code = encodeBeam(offer);
    expect(code.length).toBeLessThan(250);
    expect(code).toMatch(/^[A-Za-z0-9~!,.:+/_-]+$/);
  });

  it('packs mDNS names', () => {
    expect(encodeBeam(offer)).not.toContain('.local');
  });

  it('checks the expected kind', () => {
    expect(decodeBeam(encodeBeam(offer), 'a')).toBeNull();
    expect(decodeBeam(encodeBeam(answer), 'o')).toBeNull();
  });

  it('survives percent-encoding by a scanner', () => {
    expect(decodeBeam(encodeURIComponent(encodeBeam(offer)))).toEqual(offer);
  });

  it('round-trips through the hash', () => {
    expect(parseBeamHash(beamToHash(encodeBeam(offer)))).toEqual(offer);
    expect(parseBeamHash('beam=' + encodeBeam(offer))).toEqual(offer);
    expect(parseBeamHash(beamToHash(encodeBeam(answer)))).toBeNull();
  });

  const good = encodeBeam(offer).split('~');
  const swap = (i: number, v: string) => good.map((p, j) => (j === i ? v : p)).join('~');
  it.each([
    ['empty', ''],
    ['studio', '#studio'],
    ['look', '#look=strip.portrait.4.honey.dots'],
    ['version', swap(0, 'B9')],
    ['kind', swap(1, 'x')],
    ['short ufrag', swap(2, 'ab')],
    ['ufrag chars', swap(2, 'ab<>cd')],
    ['short pwd', swap(3, 'short')],
    ['fingerprint', swap(4, 'AAAA')],
    ['setup', swap(5, 'a')],
    ['no candidates', swap(6, '')],
    ['bad ip', swap(6, '999.1.1.1,5000')],
    ['host name', swap(6, 'evil.example.com,5000')],
    ['bad port', swap(6, '10.0.0.1,70000')],
    ['too many', swap(6, Array.from({ length: 9 }, (_, i) => `10.0.0.${i},5000`).join('!'))],
    ['extra field', good.join('~') + '~x'],
    ['huge', 'B1~o~' + 'a'.repeat(2000)],
  ])('rejects %s', (_n, code) => {
    expect(decodeBeam(code)).toBeNull();
    expect(parseBeamHash('#beam=' + code)).toBeNull();
  });
});

describe('base64url', () => {
  it('round-trips', () => {
    const b = Uint8Array.from({ length: 33 }, (_, i) => i * 7);
    expect(unb64u(b64u(b))).toEqual(b);
    expect(unb64u('*')).toBeNull();
  });
});
