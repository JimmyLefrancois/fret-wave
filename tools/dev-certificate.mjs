/** Certificat de développement local, conservé hors Git. Nécessite OpenSSL. */
import { mkdirSync, readFileSync } from 'node:fs';
import { X509Certificate, createPrivateKey, createPublicKey } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = new URL('../.certs/', import.meta.url);
const key = new URL('localhost-key.pem', dir);
const cert = new URL('localhost.pem', dir);
let valid = false;
try {
  const certificate = new X509Certificate(readFileSync(cert));
  const privateKey = createPrivateKey(readFileSync(key));
  valid = Date.parse(certificate.validTo) > Date.now() + 7 * 86400000
    && !!certificate.checkHost('localhost') && !!certificate.checkIP('127.0.0.1')
    && !!certificate.checkIP('::1')
    && certificate.publicKey.equals(createPublicKey(privateKey));
} catch { /* Première utilisation ou certificat à renouveler. */ }

if (!valid) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365',
    '-keyout', fileURLToPath(key), '-out', fileURLToPath(cert),
    '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  console.log('Certificat HTTPS local créé dans .certs/ (auto-signé).');
}
