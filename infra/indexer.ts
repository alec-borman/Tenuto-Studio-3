/**
 * @file indexer.ts
 * @description Architectural component for the Tenuto Intelligence Layer.
 * This script serves as the Retrieval-Augmented Generation (RAG) indexer.
 * It uses AST-Aware Chunking via web-tree-sitter to parse Rust and TypeScript
 * files into functional semantic nodes before embedding them. This preserves
 * semantic context and prevents AI hallucinations, adhering to the Hydrolix Standard.
 */

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import * as lancedb from 'vectordb';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import Parser from 'web-tree-sitter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is missing.');
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * Rigid TypeScript interface for our LanceDB table that includes hybrid-search metadata.
 */
export interface TenutoNode {
  id: string;
  file_path: string;
  language: string;
  node_type: string;
  node_name: string;
  content: string;
  vector: number[];
}

/**
 * Target node types for AST extraction.
 */
const TARGET_NODES = {
  rust: ['struct_item', 'impl_item'],
  typescript: ['interface_declaration', 'class_declaration'],
};

/**
 * Initializes web-tree-sitter and returns a configured parser.
 * @param language The language to load ('rust' or 'typescript').
 */
async function getParser(language: 'rust' | 'typescript'): Promise<Parser> {
  await Parser.init();
  const parser = new Parser();
  
  // Use the WASM files downloaded into infra/parsers/
  const wasmPath = language === 'rust' 
    ? path.resolve(__dirname, 'parsers', 'tree-sitter-rust.wasm') 
    : path.resolve(__dirname, 'parsers', 'tree-sitter-typescript.wasm');
  
  try {
    const lang = await Parser.Language.load(wasmPath);
    parser.setLanguage(lang);
  } catch (err) {
    console.warn(`[TEDP Indexer] Could not load ${wasmPath}. Ensure you have built the WASM grammar.`);
    // Fallback or re-throw based on environment setup
  }
  
  return parser;
}

/**
 * Extracts the name of a node if available.
 */
function getNodeName(node: Parser.SyntaxNode): string {
  // Try to find a child node that represents the name/identifier
  const nameNode = node.childForFieldName('name') || node.children.find(c => c.type === 'identifier' || c.type === 'type_identifier');
  return nameNode ? nameNode.text : 'anonymous';
}

/**
 * Depth-First Search (DFS) traversal of the parsed AST.
 * Extracts target nodes and prevents traversing into their children.
 */
function traverseAST(node: Parser.SyntaxNode, targetTypes: string[], results: Parser.SyntaxNode[]) {
  if (targetTypes.includes(node.type)) {
    results.push(node);
    return; // Crucial Constraint: Do not traverse into children of target nodes
  }
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      traverseAST(child, targetTypes, results);
    }
  }
}

async function embedContent(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: text,
  });
  return result.embeddings[0].values;
}

function generateId(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log('[TEDP Indexer] Starting AST-Aware indexing process...');
  const db = await lancedb.connect('./.lancedb');

  const tableNames = await db.tableNames();
  if (tableNames.includes('tenuto-rag')) {
    console.log('[TEDP Indexer] Dropping existing table "tenuto-rag"...');
    await db.dropTable('tenuto-rag');
  }

  const files = await glob(['src/**/*.{ts,tsx}', 'tenutoc/src/**/*.rs']);
  console.log(`[TEDP Indexer] Found ${files.length} files to index.`);

  const records: TenutoNode[] = [];
  
  // Initialize parsers lazily
  let rustParser: Parser | null = null;
  let tsParser: Parser | null = null;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const ext = path.extname(file);
    const language = ext === '.rs' ? 'rust' : 'typescript';
    
    let parser: Parser;
    if (language === 'rust') {
      if (!rustParser) rustParser = await getParser('rust');
      parser = rustParser;
    } else {
      if (!tsParser) tsParser = await getParser('typescript');
      parser = tsParser;
    }

    // If parser failed to load language (e.g., missing WASM), skip
    if (!parser.getLanguage()) {
      continue;
    }

    const tree = parser.parse(content);
    const targetTypes = TARGET_NODES[language];
    const extractedNodes: Parser.SyntaxNode[] = [];
    
    traverseAST(tree.rootNode, targetTypes, extractedNodes);

    let embeddedChunks = 0;
    for (const node of extractedNodes) {
      const nodeText = node.text;
      if (!nodeText.trim()) continue;
      
      try {
        const vector = await embedContent(nodeText);
        records.push({
          id: generateId(nodeText),
          file_path: file,
          language,
          node_type: node.type,
          node_name: getNodeName(node),
          content: nodeText,
          vector,
        });
        embeddedChunks++;
      } catch (err) {
        console.error(`[TEDP Indexer] Error embedding node from ${file}:`, err);
      }
    }
    console.log(`[TEDP Indexer] Embedded ${file} - ${embeddedChunks} semantic nodes`);
  }

  if (records.length > 0) {
    console.log(`[TEDP Indexer] Creating table "tenuto-rag" with ${records.length} records...`);
    await db.createTable('tenuto-rag', records);
    console.log('[TEDP Indexer] AST-Aware Indexing complete.');
  } else {
    console.log('[TEDP Indexer] No records to index.');
  }
}

main().catch(console.error);
