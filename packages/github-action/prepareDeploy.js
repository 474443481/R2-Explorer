// @ts-ignore
const fs = require("node:fs");

const R2EXPLORER_WORKER_NAME = process.env.R2EXPLORER_WORKER_NAME;
const R2EXPLORER_BUCKETS = process.env.R2EXPLORER_BUCKETS;
const R2EXPLORER_CONFIG = process.env.R2EXPLORER_CONFIG;
const R2EXPLORER_DOMAIN = process.env.R2EXPLORER_DOMAIN;

let baseDir = __dirname;

console.log("=== prepareDeploy.js Debug Info ===");
console.log("R2EXPLORER_WORKER_NAME:", R2EXPLORER_WORKER_NAME);
console.log("R2EXPLORER_CONFIG type:", typeof R2EXPLORER_CONFIG);
console.log("R2EXPLORER_CONFIG value:", R2EXPLORER_CONFIG);
console.log("R2EXPLORER_BUCKETS:", R2EXPLORER_BUCKETS);
console.log("R2EXPLORER_DOMAIN:", R2EXPLORER_DOMAIN);
console.log("baseDir:", baseDir);
console.log("====================================\n");

// Validate required environment variables
if (!R2EXPLORER_WORKER_NAME) {
	console.error("❌ R2EXPLORER_WORKER_NAME variable is required!");
	process.exit(1);
}

if (!R2EXPLORER_BUCKETS) {
	console.error("❌ R2EXPLORER_BUCKETS variable is required!");
	process.exit(1);
}

if (!R2EXPLORER_CONFIG) {
	console.error("❌ R2EXPLORER_CONFIG variable is required!");
	process.exit(1);
}

// Build wrangler.toml configuration
let wranglerConfig = `name = "${R2EXPLORER_WORKER_NAME}"
compatibility_date = "2024-11-06"
main = "src/index.ts"
assets = { directory = "node_modules/r2-explorer/dashboard", binding = "ASSETS", html_handling = "auto-trailing-slash", not_found_handling = "single-page-application", run_worker_first = ["/api/*", "/share/*"] }
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

// Process buckets
const buckets = R2EXPLORER_BUCKETS.split("\n").filter(line => line.trim());
for (const rawBucket of buckets) {
  const bucket = rawBucket.trim();
  if (!bucket) continue;
  
  const split = bucket.split(":");
  if (split.length !== 2 && split.length !== 3) {
    console.error("❌ Invalid bucket format:", bucket);
    process.exit(1);
  }

  const [alias, bucketName, jurisdiction] = split;

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

// Write wrangler.toml
console.log("Writing wrangler.toml to:", `${baseDir}/wrangler.toml`);
fs.writeFileSync(`${baseDir}/wrangler.toml`, wranglerConfig);
console.log("✅ wrangler.toml written\n");

// Create src directory
if (!fs.existsSync(`${baseDir}/src/`)) {
	fs.mkdirSync(`${baseDir}/src/`, { recursive: true });
}

// Create index.ts
// R2EXPLORER_CONFIG is a TS object literal, inserted as-is (upstream design)
const indexTsContent = `import { R2Explorer } from "r2-explorer";

export default R2Explorer(${R2EXPLORER_CONFIG});
`;

console.log("Generated index.ts content:");
console.log(indexTsContent);
console.log("\n");

fs.writeFileSync(`${baseDir}/src/index.ts`, indexTsContent);
console.log("✅ src/index.ts written\n");

console.log("✅ prepareDeploy.js completed successfully");
