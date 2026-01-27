import type { NextRequest } from 'next/server';
import type { BatchSaveBody, ValidationError } from './types';

export async function parseBatchSaveBody(req: NextRequest): Promise<BatchSaveBody> {
  let body: any;
  try {
    body = await req.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      const e: ValidationError = new Error('Malformed JSON in request body') as ValidationError;
      e.status = 400;
      throw e;
    }
    throw error;
  }

  const { collectionId, tags, tabs } = body;

  if (!collectionId) {
    const e: ValidationError = new Error('Missing collectionId') as ValidationError;
    e.status = 400;
    throw e;
  }

  if (!Array.isArray(tabs)) {
    const e: ValidationError = new Error('tabs must be an array') as ValidationError;
    e.status = 400;
    throw e;
  }

  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags) || tags.some(t => typeof t !== 'string')) {
      const e: ValidationError = new Error('Tags must be an array of strings') as ValidationError;
      e.status = 400;
      throw e;
    }
  }

  return { collectionId, tags, tabs };
}
