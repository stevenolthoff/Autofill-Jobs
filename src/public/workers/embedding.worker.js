console.log('🤖 Embedding Worker: Starting up...');

import { pipeline, cos_sim } from '@xenova/transformers';

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
            self.postMessage({
                type: 'error',
                payload: { error: error.message }
            });
            return;
        }
    }

    const { type, payload } = event.data;

    if (type === 'generateEmbedding') {
        console.log('🤖 Embedding Worker: Generating embedding for:', payload.text);
        try {
            const output = await extractor(payload.text, { pooling: 'mean', normalize: true });
            console.log('✅ Embedding Worker: Embedding generated successfully');
            self.postMessage({
                type: 'embeddingComplete',
                payload: {
                    id: payload.id,
                    embedding: Array.from(output.data)
                }
            });
        } catch (error) {
            console.error('💥 Embedding Worker: Failed to generate embedding:', error);
            self.postMessage({
                type: 'error',
                payload: { error: error.message }
            });
        }
    } else if (type === 'findSimilar') {
        const { queryEmbedding, savedAnswers } = payload;
        
        if (!queryEmbedding || savedAnswers.length === 0) {
            self.postMessage({ type: 'similarityResult', payload: null });
            return;
        }

        let bestMatch = null;
        let highestSimilarity = -1;
        const SIMILARITY_THRESHOLD = 0.90; // Confidence threshold

        for (const item of savedAnswers) {
            if (item.embedding) {
                const similarity = cos_sim(queryEmbedding, item.embedding);
                if (similarity > highestSimilarity) {
                    highestSimilarity = similarity;
                    bestMatch = item;
                }
            }
        }

        if (highestSimilarity >= SIMILARITY_THRESHOLD) {
            self.postMessage({ type: 'similarityResult', payload: bestMatch });
        } else {
            self.postMessage({ type: 'similarityResult', payload: null });
        }
    }
});
