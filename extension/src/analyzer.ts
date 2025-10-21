// Code analysis logic will be merged from PR

// Example: Path alias usage (@/types instead of ./types)
import type { TestType } from '@/types';

export function testAnalyzer(): TestType {
  return { message: 'Path alias works!' };
}
