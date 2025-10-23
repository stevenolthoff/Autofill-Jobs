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
        console.log(\`🤖 Embedding Worker: Found \${matches.length} total matches, \${deduplicatedMatches.length} unique answers\`);
        self.postMessage({ type: 'similarityResult', payload: deduplicatedMatches });
    }
});
`;

const blob = new Blob([workerScript], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);
const worker = new Worker(workerUrl, { type: 'module' });
const pendingEmbeddings = new Map();

console.log('🤖 Semantic Autofill: Worker created');

let suggestionPopup = null;
let currentTargetInput = null;
let isSelectingSuggestion = false;
let dismissedByClickOutside = false;

function createSuggestionPopup() {
    if (suggestionPopup) return;

    suggestionPopup = document.createElement('div');
    suggestionPopup.id = 'autofill-suggestion-popup';
    Object.assign(suggestionPopup.style, {
        position: 'absolute',
        zIndex: '2147483647',
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        display: 'none',
        maxHeight: '200px',
        overflowY: 'auto',
        fontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif`,
        fontSize: '14px',
    });
    document.body.appendChild(suggestionPopup);

    document.addEventListener('mousedown', (e) => {
        if (suggestionPopup.style.display === 'block' && !suggestionPopup.contains(e.target) && e.target !== currentTargetInput) {
            hideSuggestionPopup();
            // Mark that we're not selecting a suggestion to prevent popup from showing again
            isSelectingSuggestion = false;
            // Mark that popup was dismissed by clicking outside
            dismissedByClickOutside = true;
        }
    });
}

function hideSuggestionPopup() {
    if (suggestionPopup) {
        suggestionPopup.style.display = 'none';
        suggestionPopup.innerHTML = '';
    }
}

function showSuggestionPopup(suggestions, inputElement) {
    createSuggestionPopup();
    
    // Clear previous suggestions
    suggestionPopup.innerHTML = '';

    if (suggestions.length === 0) {
        hideSuggestionPopup();
        return;
    }

    suggestions.forEach(suggestion => {
        const item = document.createElement('button');
        Object.assign(item.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            padding: '8px 12px',
            textAlign: 'left',
            border: 'none',
            borderBottom: '1px solid #edf2f7',
            cursor: 'pointer',
            background: 'white',
        });
        item.onmouseover = () => item.style.backgroundColor = '#f7fafc';
        item.onmouseout = () => item.style.backgroundColor = 'white';
        
        const answerText = document.createElement('span');
        
        // Truncate to approximately 3 lines of text
        const maxChars = Math.min(suggestion.answer.length, 300);
        const truncatedAnswer = suggestion.answer.substring(0, maxChars);
        const finalAnswer = truncatedAnswer.length < suggestion.answer.length ? truncatedAnswer + '...' : truncatedAnswer;
        
        answerText.textContent = finalAnswer;
        answerText.style.marginRight = '16px';
        answerText.style.color = '#4a5568';
        answerText.style.flex = '1';
        answerText.style.minWidth = '0';
        answerText.style.lineHeight = '1.4';
        answerText.style.whiteSpace = 'pre-wrap';
        answerText.style.wordWrap = 'break-word';
        
        const score = document.createElement('span');
        score.textContent = `${(suggestion.similarity * 100).toFixed(0)}%`;
        score.style.fontWeight = '600';
        score.style.whiteSpace = 'nowrap';
        
        // Color code similarity scores: green for high, yellow for medium, red for low
        if (suggestion.similarity >= 0.7) {
            score.style.color = '#059669'; // green-600
        } else if (suggestion.similarity >= 0.5) {
            score.style.color = '#d97706'; // amber-600
        } else {
            score.style.color = '#dc2626'; // red-600
        }

        item.appendChild(answerText);
        item.appendChild(score);
        
        item.addEventListener('click', () => {
            // Mark that we're selecting a suggestion to prevent popup from showing again
            isSelectingSuggestion = true;
            
            // Only set cluster ID if the field doesn't already contain this exact answer
            if (inputElement.value.trim() !== suggestion.answer.trim()) {
                inputElement.setAttribute('data-suggested-cluster-id', suggestion.clusterId);
            }
            suggestAnswer(inputElement, suggestion.answer);
            hideSuggestionPopup();
            
            // Reset the flag after a short delay to allow normal popup behavior for future interactions
            setTimeout(() => {
                isSelectingSuggestion = false;
            }, 100);
        });

        suggestionPopup.appendChild(item);
    });

    const rect = inputElement.getBoundingClientRect();
    suggestionPopup.style.left = `${rect.left + window.scrollX}px`;
    suggestionPopup.style.top = `${rect.bottom + window.scrollY + 2}px`;
    suggestionPopup.style.minWidth = `${Math.max(rect.width, 400)}px`;
    suggestionPopup.style.maxWidth = '600px';
    suggestionPopup.style.display = 'block';
}

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
                const clusterIndex = savedAnswerClusters.findIndex(c => c.id === clusterIdToUpdate);
                if (clusterIndex > -1) {
                    const cluster = savedAnswerClusters[clusterIndex];
                    const questionKey = question.trim().toLowerCase();
                    
                    // Check if this exact question already exists in this cluster
                    const existingQuestion = cluster.questions.find(q => 
                        q.question.trim().toLowerCase() === questionKey
                    );
                    
                    if (!existingQuestion) {
                        const newQuestionVariant = {
                            id: self.crypto.randomUUID(),
                            question,
                            sourceUrl,
                            embedding,
                            timestamp: new Date().toISOString(),
                        };
                        
                        cluster.questions.push(newQuestionVariant);
                        console.log('💾 Semantic Autofill: Added new question to cluster:', cluster);
                        await chrome.storage.local.set({ saved_answers: savedAnswerClusters });
                    } else {
                        console.log('💾 Semantic Autofill: Question already exists in cluster, skipping');
                    }
                }
            } else {
                // Check if this exact answer already exists
                const answerKey = answer.trim().toLowerCase();
                const existingCluster = savedAnswerClusters.find(cluster => 
                    cluster.answer.trim().toLowerCase() === answerKey
                );
                
                if (existingCluster) {
                    // Answer already exists, add this question to the existing cluster
                    console.log('💾 Semantic Autofill: Answer already exists, adding question to existing cluster');
                    const clusterIndex = savedAnswerClusters.findIndex(c => c.id === existingCluster.id);
                    if (clusterIndex > -1) {
                        const cluster = savedAnswerClusters[clusterIndex];
                        const questionKey = question.trim().toLowerCase();
                        
                        // Check if this exact question already exists in this cluster
                        const existingQuestion = cluster.questions.find(q => 
                            q.question.trim().toLowerCase() === questionKey
                        );
                        
                        if (!existingQuestion) {
                            const newQuestionVariant = {
                                id: self.crypto.randomUUID(),
                                question,
                                sourceUrl,
                                embedding,
                                timestamp: new Date().toISOString(),
                            };
                            
                            cluster.questions.push(newQuestionVariant);
                            await chrome.storage.local.set({ saved_answers: savedAnswerClusters });
                        } else {
                            console.log('💾 Semantic Autofill: Question already exists in existing cluster, skipping');
                        }
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
            }
            pendingEmbeddings.delete(id);
        }
    } else if (type === 'similarityResult') {
        const results = payload;
        if (results && results.length > 0 && currentFocusedElement) {
            console.log(`✅ Semantic Autofill: Found ${results.length} potential matches.`);
            showSuggestionPopup(results, currentFocusedElement);
        } else {
            hideSuggestionPopup();
            console.log('❌ Semantic Autofill: No sufficiently similar answer found in the database.');
        }
    }
};

const getSavedAnswers = async () => {
    const data = await chrome.storage.local.get('saved_answers');
    return data.saved_answers || [];
};

function getQuestionForInput(input) {
    // For radio buttons, we need to find the question text differently
    if (input.type === 'radio') {
        console.log('🔍 Getting question for radio button:', input.name);
        console.log('🔍 Radio button DOM structure:');
        console.log('  Input:', input.outerHTML);
        console.log('  Parent:', input.parentElement?.outerHTML);
        console.log('  Grandparent:', input.parentElement?.parentElement?.outerHTML);
        
        // Look for common question text patterns around radio buttons
        let parent = input.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
            console.log('🔍 Checking parent level', i, ':', parent.tagName, parent.className, parent.id);
            
            // Look for question text in various common patterns
            const questionSelectors = [
                'label:not([for])', // Label that's not associated with a specific input
                '.question-text',
                '.field-label', 
                '.form-label',
                '.label-text',
                'legend', // Fieldset legend
                'h3', 'h4', 'h5', 'h6', // Headings
                '.title',
                '.text',
                'p:not(:has(input))', // Paragraph that doesn't contain inputs
                'div:not(:has(input))' // Div that doesn't contain inputs
            ];
            
            for (const selector of questionSelectors) {
                const questionElement = parent.querySelector(selector);
                if (questionElement && questionElement.textContent) {
                    const text = questionElement.textContent.trim();
                    // Make sure it's not just the radio button label
                    if (text.length > 5 && !text.includes(input.value) && text !== input.value) {
                        console.log('🔍 Found question text via selector', selector, ':', text);
                        return text;
                    }
                }
            }
            
            // Also check the parent's text content directly
            if (parent.textContent) {
                const parentText = parent.textContent.trim();
                // Look for text that's not the radio button value
                const lines = parentText.split('\n').map(line => line.trim()).filter(line => line.length > 5);
                for (const line of lines) {
                    if (!line.includes(input.value) && line !== input.value && !line.includes('U.S. Citizen') && !line.includes('Permanent Resident')) {
                        console.log('🔍 Found question text in parent:', line);
                        return line;
                    }
                }
            }
            
            parent = parent.parentElement;
        }
        
        console.log('❌ No question text found for radio button');
        return null;
    }
    
    // Original logic for text inputs
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

async function captureAnswer(event) {
    const input = event.target;
    let answer;
    
    console.log('💾 captureAnswer called for:', input.type, input.name, input.value);
    
    // Handle radio buttons differently - get the label text instead of value
    if (input.type === 'radio') {
        const label = document.querySelector(`label[for="${input.id}"]`) || 
                     input.closest('label') || 
                     input.parentElement.querySelector('label');
        answer = label ? label.textContent.trim() : input.value.trim();
        console.log('📻 Radio button label found:', label ? label.textContent.trim() : 'none');
        console.log('📻 Radio button answer extracted:', answer);
    } else {
        answer = input.value.trim();
    }

    const cleanupAttributes = () => {
        input.removeAttribute('data-suggested-cluster-id');
        input.removeAttribute('data-autofilled');
    };

    if (!answer || answer.length < 2) {
        console.log('❌ Answer too short or empty:', answer);
        cleanupAttributes();
        return;
    }

    const question = getQuestionForInput(input);
    console.log('❓ Question extracted:', question);
    if (!question || question.length <= 5) {
        console.log('❌ Question too short or empty:', question);
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
    // Scenario 2: User typed a new answer OR edited a suggestion. Check if this question-answer combination already exists.
    else if (!wasAutofilled) {
        console.log('📝 Semantic Autofill: Processing new answer - not autofilled');
        const savedAnswerClusters = await getSavedAnswers();
        console.log('📝 Current saved clusters count:', savedAnswerClusters.length);
        
        // Check if this question already exists in any cluster
        const questionKey = question.trim().toLowerCase();
        
        const existingCluster = savedAnswerClusters.find(cluster => {
            // Check if this question already exists in this cluster
            const questions = Array.isArray(cluster.questions) ? cluster.questions : [];
            return questions.some(q => q.question.trim().toLowerCase() === questionKey);
        });
        
        if (existingCluster) {
            console.log('📝 Semantic Autofill: Question already exists, updating existing cluster answer.');
            // Update the existing cluster's answer
            const clusterIndex = savedAnswerClusters.findIndex(c => c.id === existingCluster.id);
            if (clusterIndex > -1) {
                savedAnswerClusters[clusterIndex].answer = answer;
                await chrome.storage.local.set({ saved_answers: savedAnswerClusters });
                console.log('✅ Updated existing cluster with new answer:', answer);
            }
        } else {
            console.log('📝 Semantic Autofill: Saving new answer/cluster.');
            const id = self.crypto.randomUUID();
            pendingEmbeddings.set(id, {
                question,
                answer: answer,
                sourceUrl: window.location.href,
            });
            worker.postMessage({ type: 'generateEmbedding', payload: { id, text: question } });
            console.log('✅ Created new cluster for question:', question, 'answer:', answer);
        }
    }

    cleanupAttributes();
}

let currentFocusedElement = null;

async function findAndSuggestAnswer(event) {
    const input = event.target;

    // Do not show suggestion popups for radio buttons
    if (input.type === 'radio') {
        return;
    }
    
    if (isSelectingSuggestion) return;
    if (dismissedByClickOutside && input === currentTargetInput) return;
    
    if (input !== currentFocusedElement && suggestionPopup) {
        hideSuggestionPopup();
    }
    
    if (input !== currentTargetInput) {
        dismissedByClickOutside = false;
    }
    
    currentFocusedElement = input;
    currentTargetInput = input;
    const question = getQuestionForInput(input);
    
    if (question && question.length > 5) {
        const savedAnswerClusters = await getSavedAnswers();
        if (savedAnswerClusters.length > 0) {
            const allQuestions = savedAnswerClusters.flatMap(cluster => {
                const questions = Array.isArray(cluster.questions) ? cluster.questions : [];
                return questions.map(q => ({
                    ...q,
                    answer: cluster.answer,
                    clusterId: cluster.id,
                }));
            });

            if (allQuestions.length === 0) return;

            const bestMatches = await findSimilarAnswers(question, allQuestions);

            if (bestMatches && bestMatches.length > 0 && currentFocusedElement) {
                console.log(`✅ Semantic Autofill: Found ${bestMatches.length} potential answers.`);
                showSuggestionPopup(bestMatches, currentFocusedElement);
            } else {
                 hideSuggestionPopup();
                 console.log('❌ Semantic Autofill: No sufficiently similar answer found in the database.');
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

// Handle radio button changes (they don't trigger focus events)
document.addEventListener('change', (e) => {
    if (e.target.type === 'radio') {
        console.log('📻 Radio button changed:', e.target.name, e.target.value, e.target.checked);
        captureAnswer(e);
    }
});

// Handle radio button clicks for suggestions (they don't trigger focus events)
document.addEventListener('click', (e) => {
    if (e.target.type === 'radio') {
        console.log('📻 Radio button clicked:', e.target.name, e.target.value, e.target.checked);
        // Radio buttons don't need suggestion popups - they auto-fill directly
        // The change event will handle saving the answer
    }
});

// Reset dismissal flag when user starts typing
document.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        dismissedByClickOutside = false;
    }
});

worker.onerror = (error) => {
    console.error('💥 Semantic Autofill: Worker error:', error);
};

// A reusable function to find similar answers using a temporary worker
function findSimilarAnswers(questionText, allSavedAnswers) {
    return new Promise((resolve) => {
        if (!allSavedAnswers || allSavedAnswers.length === 0) {
            resolve([]);
            return;
        }

        const tempWorker = new Worker(workerUrl, { type: 'module' });
        const queryId = `query_${self.crypto.randomUUID()}`;

        tempWorker.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'embeddingComplete' && payload.id === queryId) {
                tempWorker.postMessage({ type: 'findSimilar', payload: { queryEmbedding: payload.embedding, savedAnswers: allSavedAnswers } });
            } else if (type === 'similarityResult') {
                resolve(payload); // payload is the array of matches
                tempWorker.terminate();
            } else if (type === 'error') {
                console.error('💥 Semantic Autofill: Temp worker error:', payload);
                resolve([]);
                tempWorker.terminate();
            }
        };

        tempWorker.onerror = (error) => {
            console.error('💥 Semantic Autofill: Temp worker failed to start:', error);
            resolve([]);
            tempWorker.terminate();
        };

        tempWorker.postMessage({ type: 'generateEmbedding', payload: { id: queryId, text: questionText } });
    });
}

// *** Proactive Autofill Scan for High-Confidence Matches ***

const AUTOFILL_CONFIDENCE_THRESHOLD = 0.95; // Use a high threshold for proactive autofill

async function scanAndAutofillPage() {
    console.log('🔍 Semantic Autofill: Scanning page for high-confidence autofill opportunities.');
    const savedAnswerClusters = await getSavedAnswers();
    if (savedAnswerClusters.length === 0) return;

    const allQuestions = savedAnswerClusters.flatMap(cluster => 
        (Array.isArray(cluster.questions) ? cluster.questions : []).map(q => ({
            ...q, answer: cluster.answer, clusterId: cluster.id,
        }))
    );
    if (allQuestions.length === 0) return;

    // A wider selector to catch more question containers
    const questionElements = Array.from(document.querySelectorAll('.application-question, .form-group, .form-field'));
    
    const autofillPromises = questionElements.map(async (el) => {
        const input = el.querySelector('input[type="text"], textarea, input[type="radio"]');
        if (!input) return;

        // Skip fields that are already filled
        if (input.type !== 'radio' && input.value) return;
        if (input.type === 'radio' && document.querySelector(`input[name="${input.name}"]:checked`)) return;

        const questionText = getQuestionForInput(input);
        if (!questionText || questionText.length <= 5) return;

        const bestMatches = await findSimilarAnswers(questionText, allQuestions);
        const bestMatch = bestMatches?.[0];
        
        if (bestMatch && bestMatch.similarity >= AUTOFILL_CONFIDENCE_THRESHOLD) {
            console.log(`✅ High confidence match found for "${questionText}", attempting autofill.`);
            if (input.type === 'radio') {
                suggestRadioAnswer(input, bestMatch);
            } else if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
                suggestAnswer(input, bestMatch.answer);
                input.setAttribute('data-suggested-cluster-id', bestMatch.clusterId);
            }
        }
    });

    await Promise.all(autofillPromises);
    console.log('✅ Semantic Autofill: Page scan complete.');
}

function suggestRadioAnswer(radioInput, match) {
    console.log('📻 suggestRadioAnswer called for group:', radioInput.name, 'looking for:', match.answer);
    
    // Find all radio buttons in the same group
    const groupName = radioInput.name;
    if (!groupName) {
        console.log('❌ No group name found for radio button');
        return;
    }
    
    const radioButtons = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
    console.log('📻 Found radio buttons in group:', radioButtons.length);
    const answerText = match.answer.toLowerCase().trim();
    
    // Look for a radio button whose label or value matches the answer
    for (const radio of radioButtons) {
        const label = document.querySelector(`label[for="${radio.id}"]`) || 
                     radio.closest('label') || 
                     radio.parentElement.querySelector('label');
        
        if (label) {
            const labelText = label.textContent.toLowerCase().trim();
            const radioValue = radio.value.toLowerCase().trim();
            
            console.log('📻 Checking radio:', labelText, 'value:', radioValue, 'against:', answerText);
            
            // Check if the label or value matches our answer
            if (labelText.includes(answerText) || 
                answerText.includes(labelText) ||
                radioValue.includes(answerText) ||
                answerText.includes(radioValue)) {
                
                console.log('📻 Match found! Selecting radio button');
                
                // Select this radio button
                radio.checked = true;
                radio.style.backgroundColor = '#fef3c7'; // yellow-100
                radio.setAttribute('data-autofilled', 'true');
                
                // Dispatch events to notify the form
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                radio.dispatchEvent(new Event('input', { bubbles: true }));
                
                console.log('✅ Semantic Autofill: Radio button selected:', labelText);
                
                // Clean up styling after a delay
                setTimeout(() => {
                    radio.style.backgroundColor = '';
                }, 2000);
                
                break;
            }
        } else {
            console.log('📻 No label found for radio button');
        }
    }
}

// *** Trigger for Proactive Page Scan ***
let scanHasRun = false;
const formObserver = new MutationObserver((mutations, observer) => {
    const applicationForm = document.querySelector('.application-form, #application-form, #mainContent form');
    console.log('🔍 Form observer checking for forms, found:', applicationForm ? 'yes' : 'no');
    if (applicationForm && !scanHasRun) {
        console.log('🔍 Application form detected, starting scan in 1 second');
        scanHasRun = true;
        // Delay slightly to ensure all dynamic elements have loaded
        setTimeout(scanAndAutofillPage, 1000);
        observer.disconnect();
    }
});

formObserver.observe(document.body, { childList: true, subtree: true });

console.log('🎧 Semantic Autofill: Event listeners attached');
