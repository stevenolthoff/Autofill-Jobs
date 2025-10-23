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
        const SIMILARITY_THRESHOLD = 0.70; // Lowered from 0.80 to be more lenient 

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
        
        if (pendingEmbeddings.has(id)) {
            const { question, answer, sourceUrl, clusterIdToUpdate } = pendingEmbeddings.get(id);
            const savedAnswerClusters = await getSavedAnswers();

            if (clusterIdToUpdate) {
                // Add a new question variant to an existing cluster
                const newQuestionVariant = {
                    id: self.crypto.randomUUID(),
                    question,
                    sourceUrl,
                    embedding,
                    timestamp: new Date().toISOString(),
                };
                
                const clusterIndex = savedAnswerClusters.findIndex(c => c.id === clusterIdToUpdate);
                if (clusterIndex > -1) {
                    savedAnswerClusters[clusterIndex].questions.push(newQuestionVariant);
                    console.log('💾 Semantic Autofill: Added new question to cluster:', savedAnswerClusters[clusterIndex]);
                    await chrome.storage.local.set({ saved_answers: savedAnswerClusters });
                }
            } else {
                // Create a new answer cluster
                const newCluster = {
                    id: self.crypto.randomUUID(),
                    answer,
                    questions: [{
                        id: self.crypto.randomUUID(),
                        question,
                        sourceUrl,
                        embedding,
                        timestamp: new Date().toISOString(),
                    }],
                };
                console.log('💾 Semantic Autofill: Saving new answer cluster:', newCluster);
                await chrome.storage.local.set({ saved_answers: [...savedAnswerClusters, newCluster] });
            }
            pendingEmbeddings.delete(id);
        }
    } else if (type === 'similarityResult') {
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
    const answer = input.value.trim();

    const cleanupAttributes = () => {
        input.removeAttribute('data-suggested-cluster-id');
        input.removeAttribute('data-autofilled');
    };

    if (!answer || answer.length < 2) {
        cleanupAttributes();
        return;
    }

    const question = getQuestionForInput(input);
    if (!question || question.length <= 5) {
        cleanupAttributes();
        return;
    }
    
    const wasAutofilled = input.getAttribute('data-autofilled') === 'true';
    const suggestedClusterId = input.getAttribute('data-suggested-cluster-id');
    
    // Scenario 1: User accepted suggestion without editing. Link new question to the cluster.
    if (wasAutofilled && suggestedClusterId) {
        console.log('📝 Semantic Autofill: Linking new question to existing cluster.');
        const id = self.crypto.randomUUID();
        pendingEmbeddings.set(id, {
            question,
            answer: null, // Not a new answer
            sourceUrl: window.location.href,
            clusterIdToUpdate: suggestedClusterId,
        });
        worker.postMessage({ type: 'generateEmbedding', payload: { id, text: question } });
    } 
    // Scenario 2: User typed a new answer OR edited a suggestion. Create a new cluster.
    else if (!wasAutofilled) {
        console.log('📝 Semantic Autofill: Saving new answer/cluster.');
        const id = self.crypto.randomUUID();
        pendingEmbeddings.set(id, {
            question,
            answer: answer,
            sourceUrl: window.location.href,
        });
        worker.postMessage({ type: 'generateEmbedding', payload: { id, text: question } });
    }

    cleanupAttributes();
}

let currentFocusedElement = null;

async function findAndSuggestAnswer(event) {
    const input = event.target;
    currentFocusedElement = input;
    const question = getQuestionForInput(input);
    
    if (question && question.length > 5) {
        const savedAnswerClusters = await getSavedAnswers(); // This now returns AnswerCluster[]
        if (savedAnswerClusters.length > 0) {
            // Flatten clusters into a list of questions for the worker
            const allQuestions = savedAnswerClusters.flatMap(cluster => 
                (cluster.questions || []).map(q => ({
                    ...q, // id, question, sourceUrl, embedding, timestamp
                    answer: cluster.answer, // Add answer for suggestion
                    clusterId: cluster.id, // Keep track of origin cluster
                }))
            );

            if (allQuestions.length === 0) return;

            const tempWorker = new Worker(workerUrl, { type: 'module' });
            tempWorker.postMessage({type: 'generateEmbedding', payload: { id: 'query_lookup', text: question }});
            tempWorker.onmessage = (e) => {
                if (e.data.type === 'embeddingComplete' && e.data.payload.id === 'query_lookup') {
                    tempWorker.postMessage({ type: 'findSimilar', payload: { queryEmbedding: e.data.payload.embedding, savedAnswers: allQuestions }});
                } else if (e.data.type === 'similarityResult') {
                    const bestMatch = e.data.payload;
                    if (bestMatch && currentFocusedElement) {
                        console.log(`✅ Semantic Autofill: Match found with similarity ${bestMatch.similarity.toFixed(4)}. Suggesting answer: "${bestMatch.answer}"`);
                        // Store suggestion info on the element for captureAnswer to use
                        currentFocusedElement.setAttribute('data-suggested-cluster-id', bestMatch.clusterId);
                        suggestAnswer(currentFocusedElement, bestMatch.answer);
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
        
        input.setAttribute('data-autofilled', 'true');

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        const cleanup = () => {
            input.style.backgroundColor = '';
            // If the user edits, remove the 'autofilled' tag so captureAnswer knows it changed.
            // Do NOT remove 'data-suggested-cluster-id' here.
            if (input.getAttribute('data-autofilled')) {
                input.removeAttribute('data-autofilled');
            }
        };

        // Defer attaching the listener to prevent our own dispatched event from triggering it.
        setTimeout(() => {
            input.addEventListener('input', cleanup, { once: true });
        }, 0);
        
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
