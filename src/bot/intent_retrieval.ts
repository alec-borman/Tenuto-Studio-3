// sprint:intent_retrieval

export interface VectorDBBridge {
  insert(id: string, vector: number[], metadata: any): void;
  query(vector: number[], topK: number): any[];
}

export class InMemoryVectorDB implements VectorDBBridge {
  private records: { id: string, vector: number[], metadata: any }[] = [];

  insert(id: string, vector: number[], metadata: any): void {
    this.records.push({ id, vector, metadata });
  }

  query(vector: number[], topK: number): any[] {
    const results = this.records.map(record => ({
      ...record,
      similarity: cosineSearchImpl(vector, record.vector)
    }));
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }
}

export function astChunking(ast: any): any[] {
  // Mock implementation of AST chunking
  const chunks: any[] = [];
  if (ast && typeof ast === 'object') {
    for (const key in ast) {
      if (typeof ast[key] === 'object') {
        chunks.push({ path: key, content: JSON.stringify(ast[key]) });
      }
    }
  }
  return chunks;
}

export function cosineSearchImpl(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
