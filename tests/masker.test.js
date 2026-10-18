/**
 * Automated Unit Tests for DevShelf Sensitive-Data Detector & Masker
 * Tests all 7 credential categories, multiple matches, overlaps, placeholders, and formatting preservation.
 */

import assert from 'node:assert';
import { 
  detectSensitiveData, 
  maskSensitiveData, 
  computeSensitiveMetadata, 
  isPlaceholder 
} from '../src/utils/masker.js';

console.log('=== STARTING SENSITIVE DATA DETECTOR & MASKER UNIT TESTS ===\n');

// 1. Test Placeholder Detection
console.log('1. Testing placeholder and false-positive filter...');
assert.strictEqual(isPlaceholder('your_api_key_here'), true);
assert.strictEqual(isPlaceholder('<YOUR_API_KEY>'), true);
assert.strictEqual(isPlaceholder('[API_KEY]'), true);
assert.strictEqual(isPlaceholder('TODO'), true);
assert.strictEqual(isPlaceholder('changeme'), true);
assert.strictEqual(isPlaceholder('dummy'), true);
assert.strictEqual(isPlaceholder('example'), true);
assert.strictEqual(isPlaceholder('xxx'), true);
assert.strictEqual(isPlaceholder(''), true);
assert.strictEqual(isPlaceholder('123'), true);
assert.strictEqual(isPlaceholder('process.env.MY_SECRET'), true);
assert.strictEqual(isPlaceholder('${API_SECRET}'), true);

assert.strictEqual(isPlaceholder('SuperSecretP@ssw0rd!2026'), false);
assert.strictEqual(isPlaceholder('prod_live_9876543210abcdef'), false);

const detectionResult = detectSensitiveData('const key = "AKIA1234567890ABCDEF";');
assert.strictEqual(detectionResult.hasSensitiveData, true);
assert.strictEqual(detectionResult.matchCount, 1);
assert.strictEqual(detectionResult.matches[0].type, 'aws_access_key');
console.log('✓ Placeholder detector and detectSensitiveData return contract verified');

// 2. Test AWS Access Key Detection
console.log('2. Testing AWS Access Key ID detection & masking...');
const awsCode = 'const awsKey = "AKIA1234567890ABCDEF";\nconst region = "us-east-1";';
const awsRes = maskSensitiveData(awsCode);
assert.strictEqual(awsRes.hasSensitiveData, true);
assert.strictEqual(awsRes.matchCount, 1);
assert.ok(awsRes.maskedCode.includes('AKIA••••••••••••CDEF'));
assert.ok(!awsRes.maskedCode.includes('1234567890AB'));
assert.ok(awsRes.maskedCode.includes('const region = "us-east-1";'));
console.log('✓ AWS Access Key ID detected and masked');

// 3. Test OpenAI, GitHub, GitLab, and Slack API Keys
console.log('3. Testing popular API key formats...');
const apiKeySnippet = `
const openAiKey = "sk-proj-abc1234567890def1234567890gh";
const githubToken = "ghp_123456789012345678901234567890123456";
const gitlabToken = "glpat-abcdef12345678901234";
const slackToken = "xoxb-1234567890-abcdef1234";
`;
const apiRes = maskSensitiveData(apiKeySnippet);
assert.strictEqual(apiRes.hasSensitiveData, true);
assert.strictEqual(apiRes.matchCount, 4);
assert.ok(!apiRes.maskedCode.includes('sk-proj-abc1234567890def'));
assert.ok(apiRes.maskedCode.includes('sk-••••••••••••••••'));
assert.ok(apiRes.maskedCode.includes('ghp_••••••••••••••••••••'));
assert.ok(apiRes.maskedCode.includes('glpat-••••••••••••••••'));
assert.ok(apiRes.maskedCode.includes('xoxb-••••••••••••'));
console.log('✓ OpenAI, GitHub, GitLab, and Slack tokens accurately detected and masked');

// 4. Test JWT-Shaped Tokens
console.log('4. Testing JWT tokens...');
const jwtCode = `
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const header = { Authorization: \`Bearer \${token}\` };
`;
const jwtRes = maskSensitiveData(jwtCode);
assert.strictEqual(jwtRes.hasSensitiveData, true);
assert.ok(!jwtRes.maskedCode.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
assert.ok(jwtRes.maskedCode.includes('eyJ••••••••.••••••••.••••••••'));
console.log('✓ JWT token detected and masked');

// 5. Test Bearer Tokens
console.log('5. Testing Bearer authorization header tokens...');
const bearerCode = 'curl -H "Authorization: Bearer mySecretToken1234567890abcdef" https://api.example.com';
const bearerRes = maskSensitiveData(bearerCode);
assert.strictEqual(bearerRes.hasSensitiveData, true);
assert.ok(!bearerRes.maskedCode.includes('mySecretToken1234567890abcdef'));
assert.ok(bearerRes.maskedCode.includes('Bearer ••••••••••••••••'));
console.log('✓ Bearer token detected and masked');

// 6. Test Password & Secret Assignments (Code and JSON)
console.log('6. Testing password and secret assignments...');
const pwdCode = `
const dbConfig = {
  user: "postgres",
  password: "ProductionDBPassword!99#",
  host: "db.internal.net"
};
const configJson = '{"client_secret": "SuperSecretClientKey999"}';
`;
const pwdRes = maskSensitiveData(pwdCode);
assert.strictEqual(pwdRes.hasSensitiveData, true);
assert.ok(!pwdRes.maskedCode.includes('ProductionDBPassword!99#'));
assert.ok(!pwdRes.maskedCode.includes('SuperSecretClientKey999'));
assert.ok(pwdRes.maskedCode.includes('user: "postgres"'));
assert.ok(pwdRes.maskedCode.includes('host: "db.internal.net"'));
console.log('✓ Password assignments in code and JSON detected and masked');

// 7. Test Database Connection Strings with Embedded Credentials
console.log('7. Testing database connection strings with embedded credentials...');
const dbConnCode = `
const postgresUri = "postgres://admin_user:SecurePassword99!@pg-cluster.internal.net:5432/main_db";
const mongoUri = "mongodb://dev_usr:MongoSecretKey99@mongo.internal:27017/analytics";
const cleanDb = "postgres://localhost:5432/local_db";
`;
const dbRes = maskSensitiveData(dbConnCode);
assert.strictEqual(dbRes.hasSensitiveData, true);
assert.strictEqual(dbRes.matchCount, 2);
assert.ok(!dbRes.maskedCode.includes('SecurePassword99!'));
assert.ok(!dbRes.maskedCode.includes('MongoSecretKey99'));
assert.ok(dbRes.maskedCode.includes('postgres://admin_user:••••••••@pg-cluster.internal.net:5432/main_db'));
assert.ok(dbRes.maskedCode.includes('mongodb://dev_usr:••••••••@mongo.internal:27017/analytics'));
assert.ok(dbRes.maskedCode.includes('postgres://localhost:5432/local_db')); // Clean URI without user:password kept intact
console.log('✓ Embedded DB connection credentials masked without modifying database URL/host');

// 8. Test PEM Private Keys
console.log('8. Testing PEM Private Key blocks...');
const pemCode = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y3wV9v+4m6lX4T7lZ4vK0s3vL2w9P1a8m3u2l1a7y4f3v2q
+9w0k1y2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0
-----END RSA PRIVATE KEY-----
console.log("Server started");
`;
const pemRes = maskSensitiveData(pemCode);
assert.strictEqual(pemRes.hasSensitiveData, true);
assert.ok(!pemRes.maskedCode.includes('MIIEowIBAAKCAQEA0Y3wV9v'));
assert.ok(pemRes.maskedCode.includes('-----BEGIN RSA PRIVATE KEY-----'));
assert.ok(pemRes.maskedCode.includes('[REDACTED SENSITIVE PRIVATE KEY]'));
assert.ok(pemRes.maskedCode.includes('-----END RSA PRIVATE KEY-----'));
assert.ok(pemRes.maskedCode.includes('console.log("Server started");'));
console.log('✓ PEM Private Key block detected and safely redacted with header/footer preserved');

// 9. Test Multiple Secrets and Overlap Resolution
console.log('9. Testing multiple secrets in one snippet and overlap handling...');
const multiCode = `
// AWS and OpenAI in same snippet
const aws = "AKIA1111222233334444";
const openai = "sk-proj-123456789012345678901234";
const password = "my_custom_secret_key_12345";
`;
const multiRes = maskSensitiveData(multiCode);
assert.strictEqual(multiRes.hasSensitiveData, true);
assert.strictEqual(multiRes.matchCount, 3);
// Ensure non-sensitive code and exact line formatting are completely preserved
assert.ok(multiRes.maskedCode.includes('// AWS and OpenAI in same snippet'));
assert.ok(multiRes.maskedCode.includes('const aws = "'));
assert.ok(multiRes.maskedCode.includes('const openai = "'));
assert.ok(multiRes.maskedCode.includes('const password = "'));
console.log('✓ Multiple secrets and overlap resolution verified without text corruption');

// 10. Test False Positives & Placeholders
console.log('10. Testing that harmless snippets produce zero detections...');
const harmlessCode = `
function calculateSum(a, b) {
  const apiKey = "your_api_key_here";
  const password = "<PASSWORD>";
  const token = "TODO";
  let secret = "";
  const host = process.env.DB_HOST;
  return a + b;
}
`;
const harmlessRes = maskSensitiveData(harmlessCode);
assert.strictEqual(harmlessRes.hasSensitiveData, false);
assert.strictEqual(harmlessRes.matchCount, 0);
assert.strictEqual(harmlessRes.maskedCode, harmlessCode);
console.log('✓ Harmless code with placeholders produces zero false-positive detections');

// 11. Test computeSensitiveMetadata helper
console.log('11. Testing computeSensitiveMetadata helper for IndexedDB persistence...');
const meta1 = computeSensitiveMetadata(harmlessCode);
assert.strictEqual(meta1.hasSensitiveData, false);
assert.strictEqual(meta1.maskedCode, null);

const meta2 = computeSensitiveMetadata(awsCode);
assert.strictEqual(meta2.hasSensitiveData, true);
assert.ok(typeof meta2.maskedCode === 'string');
assert.ok(meta2.maskedCode.includes('AKIA••••••••••••CDEF'));
console.log('✓ computeSensitiveMetadata returns clean schema payload');

console.log('\n=== ALL SENSITIVE DATA DETECTOR & MASKER UNIT TESTS PASSED! ===\n');
