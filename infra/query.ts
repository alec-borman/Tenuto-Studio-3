/**
 * @file query.ts
 * @description Architectural component for the Tenuto Intelligence Layer.
 * This script serves as the Semantic Console for the local RAG pipeline.
 * It connects to the local LanceDB vector database, embeds user queries
 * using the Gemini API, and retrieves the most relevant codebase chunks.
 * It now supports AST-Aware hybrid querying with metadata pre-filtering,
 * adhering to the Hydrolix Standard for engineering excellence.
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
  // Example usage: npm run search "How does the lexer work?" "language = 'rust' AND node_type = 'impl_item'"
  const args = process.argv.slice(2);
  const queryText = args[0];
  const filterString = args[1]; // Optional pre-filter

  if (!queryText) {
    console.error("Usage: npm run search '<your question>' ['<optional filter string>']");
    console.error("Example: npm run search 'How does the lexer work?' \"language = 'rust' AND node_type = 'impl_item'\"");
    process.exit(1);
  }

  console.log(`[TEDP Query] Searching for: "${queryText}"`);
  if (filterString) {
    console.log(`[TEDP Query] Applying pre-filter: "${filterString}"`);
  }

  const db = await lancedb.connect('./.lancedb');
  
  const tableNames = await db.tableNames();
  if (!tableNames.includes('tenuto-rag')) {
    console.error('[TEDP Query] Table "tenuto-rag" does not exist. Please run "npm run index" first.');
    process.exit(1);
  }

  const table = await db.openTable('tenuto-rag');
  const queryVector = await embedQuery(queryText);

  // Build the query
  let queryBuilder = table.search(queryVector);
  
  // Apply pre-filtering if provided
  if (filterString) {
    queryBuilder = queryBuilder.filter(filterString).prefilter(true);
  }

  const results = await queryBuilder.limit(3).execute();

  console.log('\n[TEDP Query] Top Results:\n');
  
  if (results.length > 0) {
    const topResult = results[0];
    // Print the JSON payload of the top result
    console.log(JSON.stringify(topResult, null, 2));
  } else {
    console.log('No results found.');
  }
}

main().catch(console.error);
