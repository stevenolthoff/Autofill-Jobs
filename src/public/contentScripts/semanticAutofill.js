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
`;

const blob = new Blob([workerScript], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);
const worker = new Worker(workerUrl, { type: 'module' });
const pendingEmbeddings = new Map();

console.log('🤖 Semantic Autofill: Worker created');

// Listen for completed embeddings from the worker
worker.onmessage = async (event) => {
    console.log('📨 Semantic Autofill: Worker message received:', event.data);
    const { type, payload } = event.data;
    if (type === 'embeddingComplete') {
        console.log('✅ Semantic Autofill: Embedding completed for ID:', payload.id);
        const { id, embedding } = payload;
        if (pendingEmbeddings.has(id)) {
            const { question, answer, sourceUrl } = pendingEmbeddings.get(id);
            console.log('💾 Semantic Autofill: Saving Q&A pair:', { question, answer, sourceUrl });
            const savedAnswers = await getSavedAnswers();
            const newAnswer = {
                id: self.crypto.randomUUID(),
                question,
                answer,
                sourceUrl,
                embedding,
                timestamp: new Date().toISOString(),
            };
            await chrome.storage.local.set({ saved_answers: [...savedAnswers, newAnswer] });
            console.log('✅ Semantic Autofill: Successfully saved new Q&A:', newAnswer);
            pendingEmbeddings.delete(id);
        } else {
            console.log('⚠️ Semantic Autofill: No pending embedding found for ID:', id);
        }
    } else if (type === 'similarityResult') {
        console.log('🔍 Semantic Autofill: Similarity result:', payload);
        if (payload && currentFocusedElement) {
            suggestAnswer(currentFocusedElement, payload.answer);
        }
    }
};

const getSavedAnswers = async () => {
    const data = await chrome.storage.local.get('saved_answers');
    return data.saved_answers || [];
};

function captureAnswer(event) {
    console.log('🎯 Semantic Autofill: captureAnswer triggered');
    const input = event.target;
    console.log('📝 Semantic Autofill: Input element:', input);
    console.log('📝 Semantic Autofill: Input value:', input.value);
    console.log('📝 Semantic Autofill: Input value length:', input.value?.length);
    console.log('📝 Semantic Autofill: Input ID:', input.id);
    console.log('📝 Semantic Autofill: Input placeholder:', input.placeholder);
    console.log('📝 Semantic Autofill: Input ariaLabel:', input.ariaLabel);
    
    if (!input.value || input.value.length < 2) {
        console.log('❌ Semantic Autofill: Skipping - value too short or empty');
        return;
    }

    let label = document.querySelector(`label[for="${input.id}"]`);
    console.log('🏷️ Semantic Autofill: Label found:', label);
    console.log('🏷️ Semantic Autofill: Label text:', label?.textContent?.trim());
    
    // Try multiple methods to find the question
    let question = null;
    
    // Method 1: Direct label
    if (label) {
        question = label.textContent.trim();
    }
    
    // Method 2: Placeholder or aria-label
    if (!question) {
        question = input.placeholder || input.ariaLabel;
    }
    
    // Method 3: Look for nearby text elements
    if (!question) {
        console.log('🔍 Semantic Autofill: Looking for previous siblings...');
        // Look for previous sibling text
        let prevSibling = input.previousElementSibling;
        let siblingCount = 0;
        while (prevSibling && !question && siblingCount < 5) {
            console.log('🔍 Semantic Autofill: Checking sibling:', prevSibling, 'Text:', prevSibling.textContent?.trim());
            if (prevSibling.textContent && prevSibling.textContent.trim().length > 5) {
                question = prevSibling.textContent.trim();
                console.log('🔍 Semantic Autofill: Found question in sibling:', question);
                break;
            }
            prevSibling = prevSibling.previousElementSibling;
            siblingCount++;
        }
        console.log('🔍 Semantic Autofill: Sibling search complete, question found:', question);
        
        // Method 3b: Look for .text class in siblings (Lever-specific)
        if (!question) {
            console.log('🔍 Semantic Autofill: Looking for .text class in siblings...');
            let currentElement = input;
            for (let i = 0; i < 3; i++) {
                if (currentElement.parentElement) {
                    const textElement = currentElement.parentElement.querySelector('.text');
                    if (textElement && textElement.textContent && textElement.textContent.trim().length > 5) {
                        question = textElement.textContent.trim();
                        console.log('🔍 Semantic Autofill: Found question in .text element:', question);
                        break;
                    }
                    currentElement = currentElement.parentElement;
                }
            }
        }
        
        // Look for parent element text
        if (!question && input.parentElement) {
            console.log('🔍 Semantic Autofill: Checking parent element:', input.parentElement);
            const parentText = input.parentElement.textContent?.trim();
            console.log('🔍 Semantic Autofill: Parent text:', parentText);
            console.log('🔍 Semantic Autofill: Parent text length:', parentText?.length);
            
            if (parentText && parentText.length > 5 && parentText.length < 200) {
                // Extract just the question part (before the input)
                const inputIndex = parentText.indexOf(input.value);
                console.log('🔍 Semantic Autofill: Input value found at index:', inputIndex);
                
                if (inputIndex > 0) {
                    question = parentText.substring(0, inputIndex).trim();
                    console.log('🔍 Semantic Autofill: Extracted question from parent:', question);
                } else {
                    question = parentText;
                    console.log('🔍 Semantic Autofill: Using full parent text as question:', question);
                }
            } else {
                console.log('🔍 Semantic Autofill: Parent text too short/long or missing');
            }
        }
    }
    
    // Method 4: Look for data attributes or other attributes
    if (!question) {
        question = input.getAttribute('data-label') || 
                  input.getAttribute('data-question') ||
                  input.getAttribute('title');
    }
    
    console.log('❓ Semantic Autofill: Final question:', question);
    console.log('❓ Semantic Autofill: Question length:', question?.length);
    if (question && question.length > 5) { // Only save meaningful questions
        console.log('✅ Semantic Autofill: Question is valid, generating embedding...');
        const id = self.crypto.randomUUID();
        console.log('🆔 Semantic Autofill: Generated ID:', id);
        pendingEmbeddings.set(id, {
            question,
            answer: input.value,
            sourceUrl: window.location.href
        });
        console.log('📤 Semantic Autofill: Sending to worker:', { id, text: question });
        worker.postMessage({ type: 'generateEmbedding', payload: { id, text: question } });
    } else {
        console.log('❌ Semantic Autofill: Skipping - question too short or missing');
    }
}

let currentFocusedElement = null;

async function findAndSuggestAnswer(event) {
    const input = event.target;
    currentFocusedElement = input;

    let label = document.querySelector(`label[for="${input.id}"]`);
    const question = label ? label.textContent.trim() : (input.placeholder || input.ariaLabel);
    
    if (question && question.length > 5) {
        const savedAnswers = await getSavedAnswers();
        worker.postMessage({
            type: 'generateEmbedding',
            payload: {
                id: 'query', // special id for the query
                text: question
            }
        });

        // This is a simplified flow. A robust implementation would wait for the embedding, then search.
        // For this example, we'll fire and forget. The worker will post back when it has a result.
        // A better way is to manage a queue of requests.
        // A quick hack to get query embedding then find similar:
        const tempWorker = new Worker(workerUrl, { type: 'module' });
        tempWorker.postMessage({type: 'generateEmbedding', payload: { id: 'query_lookup', text: question }});
        tempWorker.onmessage = (e) => {
            if (e.data.type === 'embeddingComplete' && e.data.payload.id === 'query_lookup') {
                worker.postMessage({ type: 'findSimilar', payload: { queryEmbedding: e.data.payload.embedding, savedAnswers }});
                tempWorker.terminate();
            }
        }
    }
}

function suggestAnswer(input, answer) {
    input.value = answer;
    input.style.backgroundColor = '#fef3c7'; // yellow-100
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.addEventListener('input', () => {
        input.style.backgroundColor = ''; // Revert on edit
    }, { once: true });
}

// Attach listeners
document.addEventListener('focusin', (e) => {
    console.log('👀 Semantic Autofill: focusin event on:', e.target);
    console.log('👀 Semantic Autofill: Tag name:', e.target.tagName);
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        console.log('✅ Semantic Autofill: Valid input field, setting up listeners');
        findAndSuggestAnswer(e);
        e.target.addEventListener('blur', captureAnswer, { once: true });
        console.log('🎧 Semantic Autofill: Blur listener attached');
    } else {
        console.log('❌ Semantic Autofill: Not an input field, ignoring');
    }
});

// Add error handling for worker
worker.onerror = (error) => {
    console.error('💥 Semantic Autofill: Worker error:', error);
};

console.log('🎧 Semantic Autofill: Event listeners attached');
