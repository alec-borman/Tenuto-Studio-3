/**
 * @file indexer.ts
 * @description Architectural component for the Tenuto Intelligence Layer.
 * This script serves as the Retrieval-Augmented Generation (RAG) indexer.
 * It chunks the Tenuto codebase, generates embeddings using the Gemini API,
 * and stores them in a local LanceDB vector database. This provides the AI agent
 * with permanent, semantic memory of the codebase, which is crucial as the
 * context window becomes a bottleneck during the porting of the TypeScript
 * compiler logic to Rust.
 */

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import * as lancedb from 'vectordb';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is missing.');
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function getDomain(filePath: string): string {
  if (filePath.includes('src/compiler/')) return 'compiler';
  if (filePath.includes('src/audio/')) return 'audio';
  if (filePath.includes('src/engraver/')) return 'visual';
  if (filePath.includes('tenutoc/')) return 'rust_core';
  return 'general';
}

function chunkText(text: string, maxLines: number = 75): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines).join('\n'));
  }
  return chunks;
}

async function embedContent(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: text,
  });
  return result.embeddings[0].values;
}

async function main() {
  console.log('[TEDP Indexer] Starting indexing process...');
  const db = await lancedb.connect('./.lancedb');

  const tableNames = await db.tableNames();
  if (tableNames.includes('tenuto-rag')) {
    console.log('[TEDP Indexer] Dropping existing table "tenuto-rag"...');
    await db.dropTable('tenuto-rag');
  }

  const files = await glob(['src/**/*.{ts,tsx}', 'tenutoc/src/**/*.rs']);
  console.log(`[TEDP Indexer] Found ${files.length} files to index.`);

  const records = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const domain = getDomain(file);
    const chunks = chunkText(content);

    let embeddedChunks = 0;
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      
      try {
        const vector = await embedContent(chunk);
        records.push({
          filePath: file,
          domain,
          content: chunk,
          vector,
        });
        embeddedChunks++;
      } catch (err) {
        console.error(`[TEDP Indexer] Error embedding chunk from ${file}:`, err);
      }
    }
    console.log(`[TEDP Indexer] Embedded ${file} - ${embeddedChunks} chunks`);
  }

  if (records.length > 0) {
    console.log(`[TEDP Indexer] Creating table "tenuto-rag" with ${records.length} records...`);
    await db.createTable('tenuto-rag', records);
    console.log('[TEDP Indexer] Indexing complete.');
  } else {
    console.log('[TEDP Indexer] No records to index.');
  }
}

main().catch(console.error);
