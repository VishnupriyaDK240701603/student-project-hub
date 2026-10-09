const fs = require("fs");
const path = require("path");

const SECRET_PATTERNS = [
  { name: "Private Key", regex: /-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----/ },
  { name: "Generic API Key / Secret", regex: /(api_key|apikey|secret_key|secretkey|auth_token)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i },
  { name: "Supabase Service Role Key", regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\-]{30,}\.[A-Za-z0-9_\-]{30,}/ },
  { name: "Resend Live API Key", regex: /re_[0-9a-zA-Z]{24,}/ },
  { name: "Hugging Face Live Token", regex: /hf_[0-9a-zA-Z]{34,}/ },
];

const IGNORE_DIRS = ["node_modules", ".next", ".git", "coverage", "playwright-report"];
const IGNORE_FILES = [".env.example", "package-lock.json", "scan-secrets.js"];

let foundSecrets = false;

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        scanDirectory(fullPath);
      }
    } else {
      if (IGNORE_FILES.includes(file) || (file.startsWith(".env") && file !== ".env.example")) continue;
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(content)) {
        console.error(`[SECRET SCAN FAILURE] Potential ${pattern.name} found in: ${filePath}`);
        foundSecrets = true;
      }
    }
  } catch (err) {
    // Ignore binary or unreadable files
  }
}

console.log("Running secret scanner...");
scanDirectory(process.cwd());

if (foundSecrets) {
  console.error("Secret scan failed: Secrets detected in repo!");
  process.exit(1);
} else {
  console.log("Secret scan passed: No secrets detected.");
  process.exit(0);
}
