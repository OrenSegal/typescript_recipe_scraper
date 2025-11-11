#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { CodebaseConsolidator, ConsolidationReport } from './codebaseConsolidator.js';

interface Args {
  root: string;
  report?: string;
  remove?: boolean;
  backup?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { root: process.cwd() } as Args;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root' && argv[i + 1]) {
      args.root = path.resolve(argv[++i]);
    } else if (a === '--report' && argv[i + 1]) {
      args.report = path.resolve(argv[++i]);
    } else if (a === '--remove') {
      args.remove = true;
    } else if (a === '--backup' && argv[i + 1]) {
      args.backup = path.resolve(argv[++i]);
    } else if (a === '--help' || a === '-h') {
      printHelpAndExit();
    }
  }
  return args;
}

function printHelpAndExit(code = 0) {
  console.log(`\nCodebase Consolidator Runner\n\nUsage:\n  npx tsx src/utils/run-codebaseConsolidator.ts [options]\n\nOptions:\n  --root <path>      Root directory to analyze (default: cwd)\n  --report <file>    Write JSON report to file\n  --remove           Remove files classified as safe\n  --backup <path>    Optional backup directory before removal\n  -h, --help         Show this help\n`);
  process.exit(code);
}

(async () => {
  const args = parseArgs(process.argv);
  const root = args.root;

  console.log(`\n🚀 Running Codebase Consolidator on: ${root}`);
  const report: ConsolidationReport = await CodebaseConsolidator.analyzeCodebase(root);

  // Print human summary
  console.log('\n===== Consolidation Summary =====');
  console.log(`Total files: ${report.totalFiles}`);
  console.log(`Safe to remove: ${report.safeToRemove.length}`);
  console.log(`Requires review: ${report.requiresReview.length}`);
  console.log(`Must keep: ${report.mustKeep.length}`);
  if (report.estimatedSpaceSaved > 0) {
    const kb = (report.estimatedSpaceSaved / 1024).toFixed(1);
    console.log(`Estimated space saved: ${kb} KB`);
  }
  if (report.recommendations.length) {
    console.log('\nRecommendations:');
    for (const r of report.recommendations) console.log(` - ${r}`);
  }

  // Optionally write report
  if (args.report) {
    await fs.promises.writeFile(args.report, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n📝 Report written to: ${args.report}`);
  }

  // Optionally remove files
  if (args.remove) {
    if (args.backup) {
      await CodebaseConsolidator.createBackup(root, args.backup);
    }
    await CodebaseConsolidator.removeRedundantFiles(root, report.safeToRemove);
  }

  // Domain-specific identification (optional informational)
  const domain = await CodebaseConsolidator.identifyRecipeParsingRedundancies(root);
  console.log('\nDomain-specific findings:');
  console.log(` - Duplicate tests: ${domain.duplicateTests.length}`);
  console.log(` - Old parsers: ${domain.oldParsers.length}`);
  console.log(` - Build artifacts: ${domain.buildArtifacts.length}`);
  console.log(` - Temp files: ${domain.tempFiles.length}`);

  console.log('\n✅ Codebase Consolidation run complete.');
})();
