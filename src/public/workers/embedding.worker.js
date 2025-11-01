import { pipeline, cos_sim } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';

console.log('🤖 Embedding Worker: Starting up...');

// Singleton instance of the feature extraction pipeline
let extractor = null;

console.log('🤖 Embedding Worker: Imports loaded');

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    console.log('🤖 Embedding Worker: Message received:', event.data);
    // Initialize the extractor if it hasn't been already
    if (extractor === null) {
        console.log('🤖 Embedding Worker: Initializing AI model...');
        try {
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });
            console.log('✅ Embedding Worker: AI model loaded successfully');
        } catch (error) {
            console.error('💥 Embedding Worker: Failed to load AI model:', error);
            self.postMessage({ type: 'error', payload: { error: error.message } });
            return;
        }
    }

    const { type, payload } = event.data;

    if (type === 'generateEmbedding') {
        const output = await extractor(payload.text, { pooling: 'mean', normalize: true });
        self.postMessage({
            type: 'embeddingComplete',
            payload: { id: payload.id, embedding: Array.from(output.data) }
        });
    } else if (type === 'findSimilar') {
        const { queryEmbedding, savedAnswers } = payload;
        console.log('🤖 Embedding Worker: findSimilar called');
        console.log('🤖 Embedding Worker: queryEmbedding type:', typeof queryEmbedding, 'length:', queryEmbedding?.length);
        console.log('🤖 Embedding Worker: savedAnswers:', savedAnswers);
        
        if (!queryEmbedding || savedAnswers.length === 0) {
            console.log('🤖 Embedding Worker: No query embedding or saved answers');
            self.postMessage({ type: 'similarityResult', payload: [] });
            return;
        }

        const queryVector = new Float32Array(queryEmbedding);
        console.log('🤖 Embedding Worker: Query vector length:', queryVector.length);
        console.log('🤖 Embedding Worker: Saved answers count:', savedAnswers.length);

        let matches = [];

        for (const item of savedAnswers) {
            console.log('🤖 Embedding Worker: Processing item:', item);
            if (item.embedding) {
                console.log('🤖 Embedding Worker: Processing saved answer:', item.question);
                console.log('🤖 Embedding Worker: Saved embedding type:', typeof item.embedding);
                console.log('🤖 Embedding Worker: Saved embedding is array:', Array.isArray(item.embedding));
                console.log('🤖 Embedding Worker: Saved embedding keys:', Object.keys(item.embedding));
                
                let embeddingArray;
                
                if (Array.isArray(item.embedding)) {
                    // Already an array
                    embeddingArray = item.embedding;
                } else if (item.embedding.data && Array.isArray(item.embedding.data)) {
                    // It's a tensor-like object with .data property
                    embeddingArray = item.embedding.data;
                } else if (typeof item.embedding === 'object') {
                    // Try to convert object to array
                    embeddingArray = Object.values(item.embedding);
                } else {
                    console.log('🤖 Embedding Worker: Unknown embedding format, skipping');
                    continue;
                }
                
                console.log('🤖 Embedding Worker: Converted embedding length:', embeddingArray.length);
                console.log('🤖 Embedding Worker: First few values:', embeddingArray.slice(0, 5));
                
                if (embeddingArray.length > 0) {
                    const savedVector = new Float32Array(embeddingArray);
                    const similarity = cos_sim(queryVector, savedVector);
                    console.log('🤖 Embedding Worker: Similarity calculated:', similarity);
                    
                    // Show all matches regardless of similarity threshold
                    matches.push({ ...item, similarity });
                } else {
                    console.log('🤖 Embedding Worker: Empty embedding array, skipping');
                }
            } else {
                console.log('🤖 Embedding Worker: Skipping item with no embedding:', item.question);
            }
        }
        
        // Sort by similarity descending
        matches.sort((a, b) => b.similarity - a.similarity);
        
        // Deduplicate by answer text, keeping the highest similarity score for each unique answer
        const uniqueAnswers = new Map();
        for (const match of matches) {
            const answerKey = match.answer.trim().toLowerCase();
            if (!uniqueAnswers.has(answerKey) || uniqueAnswers.get(answerKey).similarity < match.similarity) {
                uniqueAnswers.set(answerKey, match);
            }
        }
        
        // Convert back to array and take top 5
        const deduplicatedMatches = Array.from(uniqueAnswers.values()).slice(0, 5);
        console.log(`🤖 Embedding Worker: Found ${matches.length} total matches, ${deduplicatedMatches.length} unique answers`);
        self.postMessage({ type: 'similarityResult', payload: deduplicatedMatches });
    }
});
