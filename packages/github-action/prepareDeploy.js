// @ts-ignore
const fs = require("node:fs");

const WORKERS_CI = process.env.WORKERS_CI;
let R2EXPLORER_WORKER_NAME = process.env.R2EXPLORER_WORKER_NAME;
const R2EXPLORER_BUCKETS = process.env.R2EXPLORER_BUCKETS;
let R2EXPLORER_CONFIG = process.env.R2EXPLORER_CONFIG;
const R2EXPLORER_DOMAIN = process.env.R2EXPLORER_DOMAIN;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

let baseDir = __dirname;
if (WORKERS_CI === "1") {
	baseDir = process.env.PWD;
	R2EXPLORER_WORKER_NAME = R2EXPLORER_WORKER_NAME || "r2-explorer";
} else {
	if (!CF_API_TOKEN) {
		console.error("CF_API_TOKEN variable is required to continue!");
		process.exit(1);
	}
}

if (!R2EXPLORER_WORKER_NAME) {
	console.error("R2EXPLORER_WORKER_NAME variable is required to continue!");
	process.exit(1);
}

if (!R2EXPLORER_BUCKETS) {
	console.error("R2EXPLORER_BUCKETS variable is required to continue!");
	process.exit(1);
}

if (!R2EXPLORER_CONFIG) {
	console.error("R2EXPLORER_CONFIG variable is required to continue!");
	process.exit(1);
}

console.log("=== DEBUG INFO ===");
console.log("R2EXPLORER_CONFIG raw:", R2EXPLORER_CONFIG);
console.log("R2EXPLORER_CONFIG type:", typeof R2EXPLORER_CONFIG);

// Try to parse as JSON if it looks like JSON
let parsedConfig;
try {
	// If it's already a string representation of JSON, parse and re-stringify it
	if (typeof R2EXPLORER_CONFIG === 'string' && R2EXPLORER_CONFIG.trim().startsWith('{')) {
		parsedConfig = JSON.parse(R2EXPLORER_CONFIG);
		R2EXPLORER_CONFIG = JSON.stringify(parsedConfig);
	} else {
		// Treat it as a raw value and stringify it
		R2EXPLORER_CONFIG = JSON.stringify(R2EXPLORER_CONFIG);
	}
	console.log("R2EXPLORER_CONFIG after processing:", R2EXPLORER_CONFIG);
} catch (e) {
	console.error("Error processing R2EXPLORER_CONFIG:", e.message);
	// Fallback: just stringify whatever we have
	R2EXPLORER_CONFIG = JSON.stringify(R2EXPLORER_CONFIG);
	console.log("R2EXPLORER_CONFIG (fallback):", R2EXPLORER_CONFIG);
}

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

for (const rawBucket of R2EXPLORER_BUCKETS.split("\n")) {
  const bucket = rawBucket.trim();
  if (!bucket) continue; // skip empty lines
  const split = bucket.split(":");
  if (split.length !== 2 && split.length !== 3) {
    console.error("R2EXPLORER_BUCKETS is not set correctly!");
    console.error(`"${bucket}" is not in the correct format => ALIAS:BUCKET_NAME[:JURISDICTION]`);
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

console.log("=== Generated wrangler.toml ===");
console.log(wranglerConfig);
console.log("=== END wrangler.toml ===");

fs.writeFileSync(`${baseDir}/wrangler.toml`, wranglerConfig);
console.log(`✅ wrangler.toml written to ${baseDir}/wrangler.toml`);

if (!fs.existsSync(`${baseDir}/src/`)) {
	fs.mkdirSync(`${baseDir}/src/`);
	console.log(`✅ Created ${baseDir}/src/ directory`);
}

// Create index.ts - parse the config properly
let indexTsContent;
try {
	// Try to parse the config to validate it
	const configObj = JSON.parse(R2EXPLORER_CONFIG);
	console.log("✅ R2EXPLORER_CONFIG is valid JSON");
	indexTsContent = `import { R2Explorer } from "r2-explorer";

export default R2Explorer(${R2EXPLORER_CONFIG});
`;
} catch (e) {
	console.error("❌ Error: R2EXPLORER_CONFIG is not valid JSON:", e.message);
	console.error("Value:", R2EXPLORER_CONFIG);
	process.exit(1);
}

console.log("=== Generated src/index.ts ===");
console.log(indexTsContent);
console.log("=== END src/index.ts ===");

fs.writeFileSync(`${baseDir}/src/index.ts`, indexTsContent);
console.log(`✅ src/index.ts written to ${baseDir}/src/index.ts`);

console.log("\n✅ prepareDeploy.js completed successfully\n");
