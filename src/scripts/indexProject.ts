import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import mongoose from 'mongoose';
import { Content } from '../models/Content.ts';
import { AIService } from '../services/AIService.ts';

// Cấu hình đường dẫn
let DOCS_DIR = path.resolve('Docs');
if (!fs.existsSync(DOCS_DIR)) {
  DOCS_DIR = path.resolve('..', 'Docs');
}
const SRC_DIR = path.resolve('src');
const FRONTEND_DIR = path.resolve('..', 'frontend-client', 'src');
const CACHE_FILE = path.resolve('src', 'data', 'index-cache.json');
const TENANT_ID = 'system_core';

// Cấu hình Chunking
const MAX_CHUNK_SIZE = 1500; 
const CHUNK_OVERLAP = 200;  

interface IndexCache {
  [filePath: string]: {
    hash: string;
    lastIndexed: string;
  };
}

let cache: IndexCache = {};

if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch (e) {
    console.warn('⚠️ Cache file corrupted, starting fresh.');
  }
}

function getFileHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

function createChunks(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + size;
    const chunk = text.substring(start, end);
    chunks.push(chunk);
    start += (size - overlap);
    if (end >= text.length) break;
  }

  return chunks;
}

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('❌ MONGO_URI is missing for indexing');
  await mongoose.connect(uri);
}

async function indexFile(filePath: string, titlePrefix: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const hash = getFileHash(content);
    const relativePath = path.relative(process.cwd(), filePath);

    if (cache[relativePath] && cache[relativePath].hash === hash) {
      console.log(`⏩ Skipping: ${relativePath}`);
      return;
    }

    const body = content.trim();
    if (!body) return;

    console.log(`⏳ Đang xử lý: ${relativePath}...`);
    const chunks = createChunks(body, MAX_CHUNK_SIZE, CHUNK_OVERLAP);
    
    await Content.deleteMany({ sourceFile: relativePath, tenantId: TENANT_ID });

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const title = chunks.length > 1 ? `${titlePrefix} (Part ${i + 1})` : titlePrefix;
      const embedding = await AIService.generateEmbedding(chunkText);

      await new Content({
        title,
        body: chunkText,
        embedding,
        tenantId: TENANT_ID,
        sourceFile: relativePath,
        chunkIndex: i,
        metadata: {
          totalChunks: chunks.length,
          hash: hash
        }
      }).save();
    }

    cache[relativePath] = {
      hash: hash,
      lastIndexed: new Date().toISOString()
    };
    
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`✅ Đã index (${chunks.length} chunks): ${relativePath}`);

  } catch (err: any) {
    if (err.message?.includes('429')) {
      console.error(`🛑 QUOTA EXCEEDED! Vui lòng chờ reset.`);
      process.exit(1);
    }
    console.error(`❌ Lỗi index file ${filePath}:`, err);
  }
}

async function scanAndIndex() {
  await connectDB();
  console.log('🚀 Bắt đầu Train AI (Indexing Documents)...');

  if (fs.existsSync(DOCS_DIR)) {
    const docsFiles = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
    for (const file of docsFiles) {
      await indexFile(path.join(DOCS_DIR, file), `DOC: ${file}`);
    }
  }

  console.log('\n✨ HOÀN TẤT TRAIN AI!');
  process.exit(0);
}

scanAndIndex().catch(err => {
  console.error('💥 Lỗi hệ thống:', err);
  process.exit(1);
});
