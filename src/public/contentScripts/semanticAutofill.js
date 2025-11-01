console.log('🚀 Semantic Autofill: Script loaded');

const cspBlockedDomains = new Set([
    'jobs.ashbyhq.com',
    'boards.greenhouse.io',
    'job-boards.greenhouse.io'
]);
const isAIEnabled = !cspBlockedDomains.has(window.location.hostname);

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

const LOW_ENTROPY_ANSWERS = new Set([
    'yes', 'no', 'true', 'false', 'male', 'female', 
    'i agree', 'i accept', 'n/a', 'none',
    'decline to self identify', `i don't wish to answer`
]);

let worker = null;
let pendingEmbeddings = new Map();

if (isAIEnabled) {
    console.log('✅ Semantic Autofill: AI features are enabled for this site.');
    
    // Use inline worker script as blob URL (CSP may block this, but it's the only option)
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    worker = new Worker(workerUrl, { type: 'module' });
    pendingEmbeddings = new Map();
    
    console.log('🤖 Semantic Autofill: Worker created');
} else {
    console.log('⚠️ Semantic Autofill: AI features disabled due to strict CSP. Using text-based matching only.');
}

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
if (worker) {
    worker.onmessage = async (event) => {
        const { type, payload } = event.data;
        if (type === 'embeddingComplete') {
            const { id, embedding } = payload;
            
            if (pendingEmbeddings.has(id)) {
                const { question, answer, sourceUrl, clusterIdToUpdate } = pendingEmbeddings.get(id);
                const savedAnswerClusters = await getSavedAnswers();

                // SCENARIO 1: We were explicitly told to update a cluster (e.g., user picked a suggestion)
                if (clusterIdToUpdate) {
                    const clusterIndex = savedAnswerClusters.findIndex(c => c.id === clusterIdToUpdate);
                    if (clusterIndex > -1) {
                        const cluster = savedAnswerClusters[clusterIndex];
                        const questionKey = question.trim().toLowerCase();
                        
                        const existingQuestion = cluster.questions.find(q => 
                            q.question.trim().toLowerCase() === questionKey
                        );
                        
                        if (!existingQuestion) {
                            cluster.questions.push({
                                id: self.crypto.randomUUID(),
                                question, sourceUrl, embedding, timestamp: new Date().toISOString(),
                            });
                            console.log('💾 Semantic Autofill: Added new question variant to existing cluster:', cluster.id);
                            await chrome.storage.local.set({ saved_answers: savedAnswerClusters });
                        }
                    }
                } 
                // SCENARIO 2: A new Q&A pair needs to be saved. This is where the core intelligence lies.
                else {
                    const allQuestions = savedAnswerClusters.flatMap(cluster => 
                        (Array.isArray(cluster.questions) ? cluster.questions : []).map(q => ({
                            ...q, answer: cluster.answer, clusterId: cluster.id,
                        }))
                    );

                    // Find the most semantically similar existing question to decide which cluster to join
                    const bestMatches = await findSimilarAnswers(question, allQuestions);
                    const bestMatch = bestMatches?.[0];

                    // If a very similar question topic already exists, merge with that cluster.
                    if (bestMatch && bestMatch.similarity > 0.92) {
                        console.log(`✅ High similarity match found (${(bestMatch.similarity * 100).toFixed(1)}%). Merging with cluster ${bestMatch.clusterId}.`);
                        const clusterIndex = savedAnswerClusters.findIndex(c => c.id === bestMatch.clusterId);
                        if (clusterIndex > -1) {
                            const cluster = savedAnswerClusters[clusterIndex];
                            const questionKey = question.trim().toLowerCase();
                            
                            // Check if this exact question already exists in this cluster
                            const existingQuestion = cluster.questions.find(q => 
                                q.question.trim().toLowerCase() === questionKey
                            );
                            
                            if (!existingQuestion) {
                                // Add the new question as a variant only if it doesn't already exist
                                cluster.questions.push({
                                    id: self.crypto.randomUUID(),
                                    question, sourceUrl, embedding, timestamp: new Date().toISOString(),
                                });
                                console.log('💾 Semantic Autofill: Added new question variant to existing cluster:', cluster.id);
                            } else {
                                console.log('💾 Semantic Autofill: Question already exists in cluster, skipping duplicate');
                            }
                            
                            // The latest answer for a topic becomes the new canonical answer.
                            // This allows users to correct or update their answers over time.
                            if (cluster.answer !== answer) {
                                console.log(`📝 Updating cluster answer from "${cluster.answer}" to "${answer}".`);
                                cluster.answer = answer;
                            }
                            
                            await chrome.storage.local.set({ saved_answers: savedAnswerClusters });
                        }
                    } 
                    // Otherwise, this is a new topic. Create a new cluster.
                    else {
                        console.log(`ℹ️ No highly similar question cluster found. Creating a new cluster for this topic.`);
                        const newCluster = {
                            id: self.crypto.randomUUID(),
                            answer,
                            questions: [{
                                id: self.crypto.randomUUID(),
                                question, sourceUrl, embedding, timestamp: new Date().toISOString(),
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
}

const getSavedAnswers = async () => {
    const data = await chrome.storage.local.get('saved_answers');
    return data.saved_answers || [];
};

async function saveNewQuestionAnswerPairWithoutEmbedding(question, answer) {
    console.log(`💾 Saving new question/answer pair without embedding (CSP-blocked site).`);
    const savedAnswerClusters = await getSavedAnswers();
    
    // Use text-based similarity to find existing clusters
    const allQuestions = savedAnswerClusters.flatMap(cluster => 
        (Array.isArray(cluster.questions) ? cluster.questions : []).map(q => ({
            ...q, answer: cluster.answer, clusterId: cluster.id,
        }))
    );
    
    // Find similar existing questions using text matching
    const bestMatches = await findSimilarAnswers(question, allQuestions);
    const bestMatch = bestMatches?.[0];
    
    // If a very similar question exists, merge with that cluster
    if (bestMatch && bestMatch.similarity > 0.75) {
        console.log(`✅ High text similarity match found (${(bestMatch.similarity * 100).toFixed(1)}%). Merging with cluster ${bestMatch.clusterId}.`);
        const clusterIndex = savedAnswerClusters.findIndex(c => c.id === bestMatch.clusterId);
        if (clusterIndex > -1) {
            const cluster = savedAnswerClusters[clusterIndex];
            const questionKey = question.trim().toLowerCase();
            
            const existingQuestion = cluster.questions.find(q => 
                q.question.trim().toLowerCase() === questionKey
            );
            
            if (!existingQuestion) {
                cluster.questions.push({
                    id: self.crypto.randomUUID(),
                    question, 
                    sourceUrl: window.location.href, 
                    timestamp: new Date().toISOString(),
                });
                console.log('💾 Semantic Autofill: Added new question variant to existing cluster:', cluster.id);
            }
            
            // Update canonical answer if different
            if (cluster.answer !== answer) {
                console.log(`📝 Updating cluster answer from "${cluster.answer}" to "${answer}".`);
                cluster.answer = answer;
            }
            
            await chrome.storage.local.set({ saved_answers: savedAnswerClusters });
            return;
        }
    }
    
    // Otherwise, create a new cluster without embeddings
    console.log(`ℹ️ No highly similar question cluster found. Creating a new cluster for this topic.`);
    const newCluster = {
        id: self.crypto.randomUUID(),
        answer,
        questions: [{
            id: self.crypto.randomUUID(),
            question, 
            sourceUrl: window.location.href, 
            timestamp: new Date().toISOString(),
        }],
    };
    console.log('💾 Semantic Autofill: Saving new answer cluster:', newCluster);
    await chrome.storage.local.set({ saved_answers: [...savedAnswerClusters, newCluster] });
}

async function addQuestionToCluster(question, suggestedClusterId) {
    console.log('📝 Semantic Autofill: Linking new question to existing cluster (CSP-blocked site).');
    const savedAnswerClusters = await getSavedAnswers();
    const clusterIndex = savedAnswerClusters.findIndex(c => c.id === suggestedClusterId);
    
    if (clusterIndex > -1) {
        const cluster = savedAnswerClusters[clusterIndex];
        const questionKey = question.trim().toLowerCase();
        
        const existingQuestion = cluster.questions.find(q => 
            q.question.trim().toLowerCase() === questionKey
        );
        
        if (!existingQuestion) {
            cluster.questions.push({
                id: self.crypto.randomUUID(),
                question, 
                sourceUrl: window.location.href, 
                timestamp: new Date().toISOString(),
            });
            console.log('💾 Semantic Autofill: Added new question variant to existing cluster:', cluster.id);
            await chrome.storage.local.set({ saved_answers: savedAnswerClusters });
        }
    }
}

function getQuestionForInput(input) {
    // For radio buttons and checkboxes, we need to find the question text differently
    if (input.type === 'radio' || input.type === 'checkbox') {
        console.log('🔍 Getting question for', input.type, ':', input.name);
        console.log('🔍 Input DOM structure:');
        console.log('  Input:', input.outerHTML);
        console.log('  Parent:', input.parentElement?.outerHTML);
        console.log('  Grandparent:', input.parentElement?.parentElement?.outerHTML);
        
        // Look for common question text patterns around radio buttons and checkboxes
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
                    // Make sure it's not just the input label
                    if (text.length > 5 && !text.includes(input.value) && text !== input.value) {
                        console.log('🔍 Found question text via selector', selector, ':', text);
                        return text;
                    }
                }
            }
            
            // Also check the parent's text content directly
            if (parent.textContent) {
                const parentText = parent.textContent.trim();
                // Look for text that's not the input value
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
        
        console.log('❌ No question text found for', input.type);
        return null;
    }
    
    // Original logic for text inputs and textareas
    let label = document.querySelector(`label[for="${input.id}"]`);
    if (label && label.textContent) {
        const labelText = label.textContent.trim();
        // Make sure we get meaningful text, not just whitespace
        if (labelText.length > 2) {
            console.log('🔍 Found label text for', input.tagName, input.id, ':', labelText);
            return labelText;
        }
    }
    if (input.placeholder) return input.placeholder;
    if (input.ariaLabel) return input.ariaLabel;
    
    let parent = input.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
        const textElement = parent.querySelector('.text, .title, .label');
        if (textElement && textElement.textContent) {
            const text = textElement.textContent.trim();
            if (text.length > 2) {
                return text;
            }
        }
        parent = parent.parentElement;
    }
    
    return null;
}

async function captureAnswer(event) {
    const input = event.target;
    let answer;
    
    console.log('💾 captureAnswer called for:', input.type, input.name, input.value);
    
    // Handle radio buttons and checkboxes
    if (input.type === 'checkbox') {
        const groupName = input.name;
        if (!groupName) return; // Cannot identify group
        const checkedBoxes = document.querySelectorAll(`input[type="checkbox"][name="${groupName}"]:checked`);
        
        const answers = Array.from(checkedBoxes).map(cb => {
            const label = document.querySelector(`label[for="${cb.id}"]`) || cb.closest('label');
            // Use the visible label text as the answer, falling back to value
            return label ? label.textContent.trim() : cb.value.trim();
        });
        
        answer = answers.join(', '); // Join multiple answers into a single string
        console.log('✅ Checkbox answer extracted:', answer);

    } else if (input.type === 'radio') {
        const label = document.querySelector(`label[for="${input.id}"]`) || 
                     input.closest('label') || 
                     input.parentElement.querySelector('label');
        answer = label ? label.textContent.trim() : input.value.trim();
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
        if (isAIEnabled) {
            console.log('📝 Semantic Autofill: Linking new question to existing cluster.');
            const id = self.crypto.randomUUID();
            pendingEmbeddings.set(id, {
                question,
                answer: null, // Not a new answer
                sourceUrl: window.location.href,
                clusterIdToUpdate: suggestedClusterId,
            });
            worker.postMessage({ type: 'generateEmbedding', payload: { id, text: question } });
        } else {
            // CSP-blocked site: use text-based storage
            addQuestionToCluster(question, suggestedClusterId);
        }
    } 
    // Scenario 2: User typed a new answer OR edited a suggestion. Check if this question-answer combination already exists.
    else if (!wasAutofilled) {
        if (isAIEnabled) {
            console.log('📝 Semantic Autofill: Processing new answer - not autofilled. Kicking off embedding.');
            // The main worker will handle the clustering logic once the embedding is ready.
            saveNewQuestionAnswerPair(question, answer);
        } else {
            // CSP-blocked site: use text-based storage
            saveNewQuestionAnswerPairWithoutEmbedding(question, answer);
        }
    }

    cleanupAttributes();
}

function saveNewQuestionAnswerPair(question, answer) {
    console.log(`💾 Saving new question/answer pair as a new cluster.`);
    const id = self.crypto.randomUUID();
    pendingEmbeddings.set(id, {
        question,
        answer: answer,
        sourceUrl: window.location.href,
    });
    if (worker) {
        worker.postMessage({ type: 'generateEmbedding', payload: { id, text: question } });
    }
}

let currentFocusedElement = null;

async function findAndSuggestAnswer(event) {
    const input = event.target;

    // Do not show suggestion popups for radio buttons or checkboxes
    if (input.type === 'radio' || input.type === 'checkbox') {
        return;
    }
    
    // Add debugging for textarea elements
    if (input.tagName === 'TEXTAREA') {
        console.log('🔍 TEXTAREA focused:', input.id, input.name, input.placeholder);
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

// Handle radio button and checkbox changes (they don't trigger focus events)
document.addEventListener('change', (e) => {
    if (e.target.type === 'radio' || e.target.type === 'checkbox') {
        console.log(`📻 ${e.target.type} changed: ${e.target.name}`);
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

if (worker) {
    worker.onerror = (error) => {
        console.error('💥 Semantic Autofill: Worker error:', error);
    };
}

// A reusable function to find similar answers using text-based matching
// This is a fallback when the semantic AI worker is blocked by CSP
function findSimilarAnswers(questionText, allSavedAnswers) {
    if (!allSavedAnswers || allSavedAnswers.length === 0) {
        return Promise.resolve([]);
    }

    // Simple text-based similarity using word overlap
    const questionWords = new Set(questionText.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    
    let matches = [];
    
    for (const item of allSavedAnswers) {
        const savedQuestion = item.question || '';
        const savedWords = new Set(savedQuestion.toLowerCase().split(/\W+/).filter(w => w.length > 2));
        
        // Calculate Jaccard similarity (intersection over union)
        const intersection = new Set([...questionWords].filter(w => savedWords.has(w)));
        const union = new Set([...questionWords, ...savedWords]);
        const similarity = union.size > 0 ? intersection.size / union.size : 0;
        
        if (similarity > 0.3) { // Lower threshold for text matching
            matches.push({ ...item, similarity });
        }
    }
    
    // Sort by similarity descending
    matches.sort((a, b) => b.similarity - a.similarity);
    
    // Return top 3 matches
    return Promise.resolve(matches.slice(0, 3));
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
    const questionElements = Array.from(document.querySelectorAll('.application-question, .form-group, .form-field, .section.page-centered.application-form, .application-additional'));
    
    const autofillPromises = questionElements.map(async (el) => {
        const input = el.querySelector('input[type="text"], textarea, input[type="radio"], input[type="checkbox"]');
        if (!input) return;
        
        // Add debugging for textarea elements
        if (input.tagName === 'TEXTAREA') {
            console.log('🔍 Found textarea in scan:', input.id, input.name, input.placeholder);
        }

        // Skip fields that are already filled
        if (input.type !== 'radio' && input.type !== 'checkbox' && input.value) return;
        if (input.type === 'radio' && document.querySelector(`input[type="radio"][name="${input.name}"]:checked`)) return;
        if (input.type === 'checkbox' && document.querySelector(`input[type="checkbox"][name="${input.name}"]:checked`)) return;

        const questionText = getQuestionForInput(input);
        if (!questionText || questionText.length <= 5) return;

        const bestMatches = await findSimilarAnswers(questionText, allQuestions);
        const bestMatch = bestMatches?.[0];
        
        if (bestMatch && bestMatch.similarity >= AUTOFILL_CONFIDENCE_THRESHOLD) {
            console.log(`✅ High confidence match found for "${questionText}", attempting autofill.`);
            if (input.type === 'radio') {
                // Ensure no radio button in this group is already checked
                const groupName = input.name;
                if (groupName && !document.querySelector(`input[type="radio"][name="${groupName}"]:checked`)) {
                    suggestRadioAnswer(input, bestMatch);
                }
            } else if (input.type === 'checkbox') {
                // Ensure no checkbox in this group is already checked by the user
                const groupName = input.name;
                if (groupName && !document.querySelector(`input[type="checkbox"][name="${groupName}"]:checked`)) {
                    suggestCheckboxAnswer(input, bestMatch);
                }
            } else if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
                // Ensure we don't overwrite user input
                if (!input.value) {
                    suggestAnswer(input, bestMatch.answer);
                    input.setAttribute('data-suggested-cluster-id', bestMatch.clusterId);
                }
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

function suggestCheckboxAnswer(checkboxInput, match) {
    const groupName = checkboxInput.name;
    if (!groupName) return;

    const checkboxes = document.querySelectorAll(`input[type="checkbox"][name="${groupName}"]`);
    if (checkboxes.length === 0) return;

    // Normalize the saved answer into an array of lowercase strings
    const answersToSelect = match.answer.toLowerCase().split(',').map(s => s.trim());
    console.log(`✅ Attempting to select checkboxes for group ${groupName}:`, answersToSelect);

    for (const checkbox of checkboxes) {
        const label = document.querySelector(`label[for="${checkbox.id}"]`) || checkbox.closest('label');
        if (!label) continue;

        const labelText = label.textContent.toLowerCase().trim();
        const checkboxValue = checkbox.value.toLowerCase().trim();

        // Check if the label or value matches any of the desired answers
        if (answersToSelect.some(ans => labelText.includes(ans) || checkboxValue.includes(ans))) {
            console.log(`✅ Matching checkbox found: ${labelText}`);
            if (!checkbox.checked) {
                checkbox.checked = true;
                checkbox.style.outline = '2px solid #fef3c7'; // yellow-100 highlight
                checkbox.setAttribute('data-autofilled', 'true');
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                
                setTimeout(() => {
                    checkbox.style.outline = '';
                }, 2000);
            }
        }
    }
}

// *** Trigger for Proactive Page Scan ***
let scanHasRun = false;
const formObserver = new MutationObserver((mutations, observer) => {
    const applicationForm = document.querySelector('.application-form, #application-form, #mainContent form, .section.page-centered.application-form, #_ashby-app-root_');
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
