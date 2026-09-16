// @ts-ignore
const fs = require("node:fs");

const R2EXPLORER_WORKER_NAME = process.env.R2EXPLORER_WORKER_NAME;
const R2EXPLORER_BUCKETS = process.env.R2EXPLORER_BUCKETS;
const R2EXPLORER_CONFIG = process.env.R2EXPLORER_CONFIG;
const R2EXPLORER_DOMAIN = process.env.R2EXPLORER_DOMAIN;

let baseDir = __dirname;

// Validate required environment variables
if (!R2EXPLORER_WORKER_NAME) {
	console.error("❌ R2EXPLORER_WORKER_NAME variable is required to continue!");
	process.exit(1);
}

if (!R2EXPLORER_BUCKETS) {
	console.error("❌ R2EXPLORER_BUCKETS variable is required to continue!");
	process.exit(1);
}

if (!R2EXPLORER_CONFIG) {
	console.error("❌ R2EXPLORER_CONFIG variable is required to continue!");
	process.exit(1);
}

console.log("✅ All required environment variables are set");
console.log("=== Starting prepareDeploy.js ===\n");

// Validate and prepare config
console.log("Validating R2EXPLORER_CONFIG...");
let configObj;
try {
	configObj = JSON.parse(R2EXPLORER_CONFIG);
	console.log("✅ R2EXPLORER_CONFIG is valid JSON");
} catch (e) {
	console.error("❌ R2EXPLORER_CONFIG is not valid JSON:");
	console.error("   Error:", e.message);
	console.error("   Value:", R2EXPLORER_CONFIG);
	process.exit(1);
}

// Generate wrangler.toml - ONLY TOML CONFIG, NO JSON
console.log("\nGenerating wrangler.toml...");
let wranglerConfig = `name = "${R2EXPLORER_WORKER_NAME}"
compatibility_date = "2024-11-06"
main = "src/index.ts"
assets = { directory = "node_modules/r2-explorer/dashboard", binding = "ASSETS", html_handling = "auto-trailing-slash", not_found_handling = "single-page-application", run_worker_first = ["/api/*"] }
`;

if (R2EXPLORER_DOMAIN) {
	wranglerConfig += `
workers_dev = false
routes = [
  { pattern = "${R2EXPLORER_DOMAIN}", custom_domain = true }
]
`;
} else {
	wranglerConfig += `
workers_dev = true
`;
}

// Add R2 bucket bindings
console.log("Processing R2EXPLORER_BUCKETS...");
const buckets = R2EXPLORER_BUCKETS.split("\n").filter(line => line.trim());
console.log(`Found ${buckets.length} bucket(s)`);

for (const rawBucket of buckets) {
  const bucket = rawBucket.trim();
  if (!bucket) continue;
  
  const split = bucket.split(":");
  if (split.length !== 2 && split.length !== 3) {
    console.error("❌ R2EXPLORER_BUCKETS format error!");
    console.error(`   "${bucket}" is not in the correct format => ALIAS:BUCKET_NAME[:JURISDICTION]`);
    process.exit(1);
  }

  const [alias, bucketName, jurisdiction] = split;
  console.log(`  - Adding bucket: ${alias} -> ${bucketName}${jurisdiction ? ` (${jurisdiction})` : ''}`);

  wranglerConfig += `
[[r2_buckets]]
binding = '${alias}'
bucket_name = '${bucketName}'
preview_bucket_name = '${bucketName}'
`;
  if (jurisdiction) {
    wranglerConfig += `jurisdiction = '${jurisdiction}'
`;
  }
}

console.log("\n📄 Writing wrangler.toml...");
fs.writeFileSync(`${baseDir}/wrangler.toml`, wranglerConfig);
console.log(`✅ wrangler.toml written successfully`);

// Create src directory if needed
if (!fs.existsSync(`${baseDir}/src/`)) {
	fs.mkdirSync(`${baseDir}/src/`, { recursive: true });
	console.log("✅ Created src/ directory");
}

// Generate index.ts - Pass config as JSON string
console.log("\n📝 Creating src/index.ts...");
const configJsonString = JSON.stringify(R2EXPLORER_CONFIG);
const indexTsContent = `import { R2Explorer } from "r2-explorer";

export default R2Explorer(${configJsonString});
`;

fs.writeFileSync(`${baseDir}/src/index.ts`, indexTsContent);
console.log("✅ src/index.ts created successfully");

console.log("\n=== prepareDeploy.js completed successfully ===");
console.log("\n📦 Generated files:");
console.log("   - wrangler.toml");
console.log("   - src/index.ts\n");
