#!/usr/bin/env node
/**
 * OpenClaw Skill Security Scanner
 * Scans SKILL.md files and associated scripts for security issues
 * 
 * Usage: node scan-skill.js <path-to-skill-folder-or-file>
 */

const fs = require('fs');
const path = require('path');

const SEVERITY = { CRITICAL: '🔴 CRITICAL', HIGH: '🟠 HIGH', MEDIUM: '🟡 MEDIUM', LOW: '🔵 LOW', INFO: '⚪ INFO' };

const findings = [];

function addFinding(severity, category, message, file, line = null, snippet = null) {
  findings.push({ severity, category, message, file, line, snippet });
}

// Dangerous shell patterns
const DANGEROUS_EXEC_PATTERNS = [
  { pattern: /\beval\s*\(/gi, severity: SEVERITY.CRITICAL, msg: 'eval() can execute arbitrary code' },
  { pattern: /\$\(.*\)/g, severity: SEVERITY.HIGH, msg: 'Command substitution detected - potential shell injection' },
  // Note: backticks in markdown are inline code, not shell substitution - only flag in .sh/.bash files
  { pattern: /`[^`]*\$[^`]*`/g, severity: SEVERITY.HIGH, msg: 'Backtick with variable - potential shell injection' },
  { pattern: /\brm\s+-rf?\s+[\/~]/gi, severity: SEVERITY.CRITICAL, msg: 'Dangerous recursive delete command' },
  { pattern: /\bsudo\b/gi, severity: SEVERITY.HIGH, msg: 'sudo usage - elevated privileges requested' },
  { pattern: /\bchmod\s+777\b/gi, severity: SEVERITY.MEDIUM, msg: 'World-writable permissions' },
  { pattern: />\s*\/dev\/null\s*2>&1.*&\s*$/gm, severity: SEVERITY.MEDIUM, msg: 'Silent background process - could hide malicious activity' },
];

// Data exfiltration patterns
const EXFIL_PATTERNS = [
  { pattern: /curl\s+[^|]*\|\s*sh/gi, severity: SEVERITY.CRITICAL, msg: 'curl piped to shell - remote code execution' },
  { pattern: /curl\s+[^|]*\|\s*bash/gi, severity: SEVERITY.CRITICAL, msg: 'curl piped to bash - remote code execution' },
  { pattern: /wget\s+[^|]*\|\s*sh/gi, severity: SEVERITY.CRITICAL, msg: 'wget piped to shell - remote code execution' },
  { pattern: /curl\s+.*-d\s*["']?\$\{?[A-Z_]+/gi, severity: SEVERITY.HIGH, msg: 'curl POST with environment variable - potential secret exfiltration' },
  { pattern: /curl\s+.*--data.*\$\{?[A-Z_]+/gi, severity: SEVERITY.HIGH, msg: 'curl POST with variable data - potential exfiltration' },
  { pattern: /\bwebhook\b.*\bsecret\b|\bsecret\b.*\bwebhook\b/gi, severity: SEVERITY.HIGH, msg: 'Webhook + secret pattern - verify not leaking credentials' },
  { pattern: /base64\s+.*\|\s*curl/gi, severity: SEVERITY.HIGH, msg: 'Base64 encoding piped to curl - potential data exfiltration' },
];

// Credential/secret exposure
const SECRET_PATTERNS = [
  { pattern: /['"][A-Za-z0-9]{32,}['"]/g, severity: SEVERITY.MEDIUM, msg: 'Long string literal - could be hardcoded API key' },
  { pattern: /\b(api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token)\s*[=:]\s*['"][^'"]+['"]/gi, severity: SEVERITY.HIGH, msg: 'Hardcoded credential detected' },
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g, severity: SEVERITY.CRITICAL, msg: 'Private key embedded in file' },
  { pattern: /\bpassword\s*[=:]\s*['"][^'"]+['"]/gi, severity: SEVERITY.HIGH, msg: 'Hardcoded password' },
  { pattern: /\/\.secrets\//g, severity: SEVERITY.MEDIUM, msg: 'References .secrets directory - verify proper handling' },
  { pattern: /process\.env\.[A-Z_]+/g, severity: SEVERITY.INFO, msg: 'Environment variable access - verify not logging/exposing' },
];

// Prompt injection vectors
const PROMPT_INJECTION_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi, severity: SEVERITY.HIGH, msg: 'Prompt injection attempt pattern' },
  { pattern: /\byou\s+are\s+(now|actually)\b/gi, severity: SEVERITY.MEDIUM, msg: 'Role reassignment pattern - potential prompt injection' },
  { pattern: /\bsystem\s*:\s*/gi, severity: SEVERITY.MEDIUM, msg: 'System message injection pattern' },
  { pattern: /\[SYSTEM\]/gi, severity: SEVERITY.MEDIUM, msg: 'System tag injection pattern' },
  { pattern: /disregard\s+(your\s+)?(instructions?|rules?|guidelines?)/gi, severity: SEVERITY.HIGH, msg: 'Instruction override pattern' },
];

// Wallet/financial risks
const WALLET_PATTERNS = [
  { pattern: /\btransfer\b.*\ball\b|\ball\b.*\btransfer\b/gi, severity: SEVERITY.CRITICAL, msg: 'Transfer all pattern - verify intentional' },
  { pattern: /\bdrain\b/gi, severity: SEVERITY.CRITICAL, msg: 'Drain keyword detected' },
  { pattern: /\bprivate[_-]?key\b/gi, severity: SEVERITY.HIGH, msg: 'Private key reference - ensure not exposed' },
  { pattern: /\bseed[_-]?phrase\b|\bmnemonic\b/gi, severity: SEVERITY.CRITICAL, msg: 'Seed phrase/mnemonic reference' },
  { pattern: /max[_-]?amount|unlimited|no[_-]?limit/gi, severity: SEVERITY.MEDIUM, msg: 'Unlimited amount pattern - verify constraints exist' },
  { pattern: /\bslippage\s*[=:]\s*(100|[5-9]\d)\b/gi, severity: SEVERITY.HIGH, msg: 'High slippage tolerance - potential sandwich attack vector' },
];

// Network/URL risks
const NETWORK_PATTERNS = [
  { pattern: /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, severity: SEVERITY.MEDIUM, msg: 'IP address URL - verify legitimate endpoint' },
  { pattern: /https?:\/\/localhost/g, severity: SEVERITY.LOW, msg: 'Localhost URL reference' },
  { pattern: /\.(xyz|tk|ml|ga|cf|gq|top)\//gi, severity: SEVERITY.MEDIUM, msg: 'Suspicious TLD in URL' },
  { pattern: /ngrok\.io|serveo\.net|localtunnel/gi, severity: SEVERITY.MEDIUM, msg: 'Tunnel service URL - could be temporary malicious endpoint' },
  { pattern: /pastebin\.com|hastebin\.com|ghostbin/gi, severity: SEVERITY.MEDIUM, msg: 'Paste service URL - verify content source' },
];

// File operation risks
const FILE_PATTERNS = [
  { pattern: /\breadFile.*\/(etc\/passwd|etc\/shadow)/gi, severity: SEVERITY.CRITICAL, msg: 'System file read attempt' },
  { pattern: /\.\.\/\.\.\//g, severity: SEVERITY.HIGH, msg: 'Path traversal pattern' },
  { pattern: /\/root\/|~\//g, severity: SEVERITY.LOW, msg: 'Home directory access - verify scope' },
  { pattern: /writeFile.*\/usr\/|writeFile.*\/bin\/|writeFile.*\/etc\//gi, severity: SEVERITY.CRITICAL, msg: 'System path write attempt' },
];

function scanContent(content, filePath) {
  const lines = content.split('\n');
  
  const allPatterns = [
    ...DANGEROUS_EXEC_PATTERNS,
    ...EXFIL_PATTERNS,
    ...SECRET_PATTERNS,
    ...PROMPT_INJECTION_PATTERNS,
    ...WALLET_PATTERNS,
    ...NETWORK_PATTERNS,
    ...FILE_PATTERNS,
  ];
  
  for (const { pattern, severity, msg } of allPatterns) {
    // Reset regex state
    pattern.lastIndex = 0;
    
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Find line number
      const beforeMatch = content.substring(0, match.index);
      const lineNum = beforeMatch.split('\n').length;
      const snippet = lines[lineNum - 1]?.trim().substring(0, 100);
      
      addFinding(severity, msg.split(' ')[0], msg, filePath, lineNum, snippet);
    }
  }
}

function scanSkillMd(content, filePath) {
  // Additional SKILL.md specific checks
  
  // Check for missing description
  if (!content.includes('description:') && !content.includes('## Description')) {
    addFinding(SEVERITY.LOW, 'Structure', 'Missing skill description', filePath);
  }
  
  // Check for external script execution
  const scriptRefs = content.match(/```(bash|sh|shell|javascript|js|python|py)\n[\s\S]*?```/gi) || [];
  if (scriptRefs.length > 0) {
    addFinding(SEVERITY.INFO, 'Scripts', `Contains ${scriptRefs.length} embedded script block(s) - review manually`, filePath);
  }
  
  // Check for tool usage patterns
  if (content.includes('exec') && content.includes('command')) {
    addFinding(SEVERITY.INFO, 'Tools', 'Uses exec tool - verify commands are safe', filePath);
  }
  
  // Check for browser automation
  if (content.includes('browser') && (content.includes('evaluate') || content.includes('javascript'))) {
    addFinding(SEVERITY.MEDIUM, 'Browser', 'Browser JS evaluation - potential XSS/data access', filePath);
  }
  
  scanContent(content, filePath);
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();
    
    if (basename === 'skill.md') {
      scanSkillMd(content, filePath);
    } else {
      scanContent(content, filePath);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}: ${err.message}`);
  }
}

function scanDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and hidden dirs
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanDirectory(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const scannable = ['.md', '.js', '.ts', '.py', '.sh', '.bash', '.json', '.yaml', '.yml', '.toml'];
      if (scannable.includes(ext) || entry.name === 'SKILL.md') {
        scanFile(fullPath);
      }
    }
  }
}

function printReport() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 SKILL SECURITY SCAN REPORT');
  console.log('='.repeat(60) + '\n');
  
  if (findings.length === 0) {
    console.log('✅ No security issues detected!\n');
    return 0;
  }
  
  // Group by severity
  const bySeverity = {};
  for (const f of findings) {
    if (!bySeverity[f.severity]) bySeverity[f.severity] = [];
    bySeverity[f.severity].push(f);
  }
  
  // Print in severity order
  const order = [SEVERITY.CRITICAL, SEVERITY.HIGH, SEVERITY.MEDIUM, SEVERITY.LOW, SEVERITY.INFO];
  
  for (const sev of order) {
    const items = bySeverity[sev];
    if (!items || items.length === 0) continue;
    
    console.log(`\n${sev} (${items.length})`);
    console.log('-'.repeat(40));
    
    for (const f of items) {
      console.log(`  📍 ${f.file}${f.line ? `:${f.line}` : ''}`);
      console.log(`     ${f.message}`);
      if (f.snippet) {
        console.log(`     > ${f.snippet}...`);
      }
      console.log();
    }
  }
  
  // Summary
  const criticals = (bySeverity[SEVERITY.CRITICAL] || []).length;
  const highs = (bySeverity[SEVERITY.HIGH] || []).length;
  
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log(`  Total findings: ${findings.length}`);
  console.log(`  Critical: ${criticals}, High: ${highs}`);
  
  if (criticals > 0) {
    console.log('\n⛔ CRITICAL issues found - DO NOT USE this skill without review!');
    return 2;
  } else if (highs > 0) {
    console.log('\n⚠️  HIGH severity issues found - careful review recommended');
    return 1;
  }
  
  return 0;
}

// Main
const target = process.argv[2];

if (!target) {
  console.log('Usage: node scan-skill.js <path-to-skill-folder-or-file>');
  console.log('\nExamples:');
  console.log('  node scan-skill.js ./my-skill/');
  console.log('  node scan-skill.js ./my-skill/SKILL.md');
  process.exit(1);
}

const targetPath = path.resolve(target);

if (!fs.existsSync(targetPath)) {
  console.error(`Error: Path not found: ${targetPath}`);
  process.exit(1);
}

const stat = fs.statSync(targetPath);

console.log(`🔍 Scanning: ${targetPath}`);

if (stat.isDirectory()) {
  scanDirectory(targetPath);
} else {
  scanFile(targetPath);
}

const exitCode = printReport();
process.exit(exitCode);
