import type { Command } from 'commander';
import { mcpCall } from '../mcp.js';
import { print, FORMAT_OPTION, SELECT_OPTION } from '../output.js';

interface FeedbackOptions {
  message: string;
  category: string;
  format?: string;
  select?: string;
}

const FEEDBACK_CATEGORIES = ['DATA_QUALITY', 'FEATURE_REQUEST', 'ACCESS_ENTITLEMENT_ISSUE', 'OTHER'] as const;

export function registerFeedback(program: Command): void {
  const feedback = program.command('feedback').description('Submit feedback to ZoomInfo');

  feedback
    .command('submit')
    .description('Submit feedback on the GTM AI MCP')
    .requiredOption('--message <text>', 'Feedback content')
    .requiredOption('--category <category>', `Category: ${FEEDBACK_CATEGORIES.join(' | ')}`)
    .option(...FORMAT_OPTION)
    .option(...SELECT_OPTION)
    .action(async (opts: FeedbackOptions) => {
      if (!(FEEDBACK_CATEGORIES as readonly string[]).includes(opts.category)) {
        console.error(`Error: --category must be one of: ${FEEDBACK_CATEGORIES.join(', ')}`);
        process.exit(1);
      }
      const data = await mcpCall('submit_feedback', {
        feedback: opts.message,
        category: opts.category,
      });
      print(data, opts.format, opts.select);
    });
}
