console.log('🚀 Semantic Autofill: Script loaded');

// Create worker using blob URL to avoid CORS issues
const workerScript = `
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
            self.postMessage({ type: 'similarityResult', payload: null });
            return;
        }

        let bestMatch = null;
        let highestSimilarity = -1;
        const SIMILARITY_THRESHOLD = 0.80; 

        // *** FIX: Convert plain arrays back to Float32Array before calculation ***
        const queryVector = new Float32Array(queryEmbedding);
        console.log('🤖 Embedding Worker: Query vector length:', queryVector.length);
        console.log('🤖 Embedding Worker: Saved answers count:', savedAnswers.length);

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
                    
                    if (similarity > highestSimilarity) {
                        highestSimilarity = similarity;
                        bestMatch = item;
                    }
                } else {
                    console.log('🤖 Embedding Worker: Empty embedding array, skipping');
                }
            } else {
                console.log('🤖 Embedding Worker: Skipping item with no embedding:', item.question);
            }
        }
        
        console.log(\`🤖 Embedding Worker: Highest similarity found: \${highestSimilarity}\`);

        if (highestSimilarity >= SIMILARITY_THRESHOLD) {
            self.postMessage({ type: 'similarityResult', payload: { ...bestMatch, similarity: highestSimilarity } });
        } else {
            self.postMessage({ type: 'similarityResult', payload: null });
        }
    }
});
`;

const blob = new Blob([workerScript], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);
const worker = new Worker(workerUrl, { type: 'module' });
const pendingEmbeddings = new Map();

console.log('🤖 Semantic Autofill: Worker created');

// Listen for completed embeddings from the worker
worker.onmessage = async (event) => {
    const { type, payload } = event.data;
    if (type === 'embeddingComplete') {
        const { id, embedding } = payload;
        console.log('📨 Semantic Autofill: Embedding completed for ID:', id);
        console.log('📨 Semantic Autofill: Embedding type:', typeof embedding);
        console.log('📨 Semantic Autofill: Embedding is array:', Array.isArray(embedding));
        console.log('📨 Semantic Autofill: Embedding length:', embedding?.length);
        console.log('📨 Semantic Autofill: First few values:', embedding?.slice(0, 5));
        
        if (pendingEmbeddings.has(id)) {
            const { question, answer, sourceUrl } = pendingEmbeddings.get(id);
            const savedAnswers = await getSavedAnswers();
            const newAnswer = {
                id: self.crypto.randomUUID(),
                question,
                answer,
                sourceUrl,
                embedding,
                timestamp: new Date().toISOString(),
            };
            console.log('💾 Semantic Autofill: Saving new answer with embedding:', newAnswer);
            await chrome.storage.local.set({ saved_answers: [...savedAnswers, newAnswer] });
            console.log('✅ Semantic Autofill: Successfully saved new Q&A:', newAnswer);
            pendingEmbeddings.delete(id);
        }
    } else if (type === 'similarityResult') {
        // *** FIX: Added comprehensive logging for match results ***
        if (payload && currentFocusedElement) {
            console.log(`✅ Semantic Autofill: Match found with similarity ${payload.similarity.toFixed(4)}. Suggesting answer: "${payload.answer}"`);
            suggestAnswer(currentFocusedElement, payload.answer);
        } else {
            console.log('❌ Semantic Autofill: No sufficiently similar answer found in the database.');
        }
    }
};

const getSavedAnswers = async () => {
    const data = await chrome.storage.local.get('saved_answers');
    return data.saved_answers || [];
};

function getQuestionForInput(input) {
    let label = document.querySelector(`label[for="${input.id}"]`);
    if (label && label.textContent) return label.textContent.trim();
    if (input.placeholder) return input.placeholder;
    if (input.ariaLabel) return input.ariaLabel;
    
    let parent = input.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
        const textElement = parent.querySelector('.text, .title, .label');
        if (textElement && textElement.textContent) return textElement.textContent.trim();
        parent = parent.parentElement;
    }
    
    return null;
}

function captureAnswer(event) {
    const input = event.target;

    // *** FIX: Check if the input was autofilled. If so, don't save it again. ***
    if (input.getAttribute('data-autofilled') === 'true') {
        input.removeAttribute('data-autofilled'); // Clean up the tag for future interactions
        console.log('📝 Semantic Autofill: Skipping save for autofilled answer.');
        return;
    }

    if (!input.value || input.value.length < 2) return;
    const question = getQuestionForInput(input);
    if (question && question.length > 5) {
        const id = self.crypto.randomUUID();
        pendingEmbeddings.set(id, {
            question,
            answer: input.value,
            sourceUrl: window.location.href
        });
        worker.postMessage({ type: 'generateEmbedding', payload: { id, text: question } });
    }
}

let currentFocusedElement = null;

async function findAndSuggestAnswer(event) {
    const input = event.target;
    currentFocusedElement = input;
    const question = getQuestionForInput(input);
    
    if (question && question.length > 5) {
        const savedAnswers = await getSavedAnswers();
        if (savedAnswers.length > 0) {
            // NOTE: The temporary worker pattern is inefficient but is what you currently have.
            // This fix focuses only on the logic, not a full refactor.
            const tempWorker = new Worker(workerUrl, { type: 'module' });
            tempWorker.postMessage({type: 'generateEmbedding', payload: { id: 'query_lookup', text: question }});
            tempWorker.onmessage = (e) => {
                if (e.data.type === 'embeddingComplete' && e.data.payload.id === 'query_lookup') {
                    tempWorker.postMessage({ type: 'findSimilar', payload: { queryEmbedding: e.data.payload.embedding, savedAnswers }});
                } else if (e.data.type === 'similarityResult') {
                    if (e.data.payload && currentFocusedElement) {
                        console.log(`✅ Semantic Autofill: Match found with similarity ${e.data.payload.similarity.toFixed(4)}. Suggesting answer: "${e.data.payload.answer}"`);
                        suggestAnswer(currentFocusedElement, e.data.payload.answer);
                    } else {
                         console.log('❌ Semantic Autofill: No sufficiently similar answer found in the database.');
                    }
                    tempWorker.terminate();
                }
            }
        }
    }
}

function suggestAnswer(input, answer) {
    if (!input.value || input.value.trim().length < 3) {
        input.value = answer;
        input.style.backgroundColor = '#fef3c7'; // yellow-100
        
        // *** FIX: Tag the input as autofilled ***
        input.setAttribute('data-autofilled', 'true');

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        const cleanup = () => {
            input.style.backgroundColor = '';
            // If the user edits the suggestion, remove the tag so it can be saved.
            if (input.getAttribute('data-autofilled')) {
                input.removeAttribute('data-autofilled');
            }
        };

        input.addEventListener('input', cleanup, { once: true });
        
        console.log('✅ Semantic Autofill: Answer field populated.');
    } else {
        console.log('⚠️ Semantic Autofill: Field already has content, not suggesting.');
    }
}

// *** FIX: Replace the old listener with two delegated listeners ***

// Use event delegation for both suggestion and capture. This is more performant and robust.
document.addEventListener('focusin', (e) => {
    // This runs when the user focuses ON any input on the page
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        findAndSuggestAnswer(e);
    }
});

document.addEventListener('focusout', (e) => {
    // This runs when the user focuses OUT of any input on the page
    // `focusout` is the bubbling version of `blur`
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        captureAnswer(e);
    }
});

worker.onerror = (error) => {
    console.error('💥 Semantic Autofill: Worker error:', error);
};

console.log('🎧 Semantic Autofill: Event listeners attached');
