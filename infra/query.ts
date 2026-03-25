/**
 * @file query.ts
 * @description Architectural component for the Tenuto Intelligence Layer.
 * This script serves as the Semantic Console for the local RAG pipeline.
 * It connects to the local LanceDB vector database, embeds user queries
 * using the Gemini API, and retrieves the most relevant codebase chunks.
 * This enables the AI agent to search the codebase for context before
 * writing new code.
 */

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import * as lancedb from 'vectordb';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is missing.');
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function embedQuery(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: text,
  });
  return result.embeddings[0].values;
}

async function main() {
  const queryText = process.argv.slice(2).join(' ');

  if (!queryText) {
    console.error("Usage: npm run search '<your question>'");
    process.exit(1);
  }

  console.log(`[TEDP Query] Searching for: "${queryText}"`);

  const db = await lancedb.connect('./.lancedb');
  
  const tableNames = await db.tableNames();
  if (!tableNames.includes('tenuto-rag')) {
    console.error('[TEDP Query] Table "tenuto-rag" does not exist. Please run "npm run index" first.');
    process.exit(1);
  }

  const table = await db.openTable('tenuto-rag');
  const queryVector = await embedQuery(queryText);

  const results = await table.search(queryVector).limit(3).execute();

  console.log('\n[TEDP Query] Top 3 Results:\n');
  
  for (const result of results) {
    console.log(`Domain: ${result.domain}`);
    console.log(`FilePath: ${result.filePath}`);
    console.log(`Distance: ${result._distance}`);
    console.log(`Content:\n${result.content}`);
    console.log('-----------');
  }
}

main().catch(console.error);
