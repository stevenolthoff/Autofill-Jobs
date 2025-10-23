<template>
    <div class="flex items-center gap-0 bg-muted text-muted-foreground text-sm font-medium h-7 rounded-md">
        <button 
            v-if="!isLast && type === 'Work Experience'" 
            @click="onEdit" 
            class="h-full px-2.5 flex-grow text-left rounded-l-md hover:bg-muted-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            :title="'Edit ' + content"
        >
            <h1 class="font-normal truncate">{{ content }}</h1>
        </button>
        <div v-else-if="content" class="h-full px-2.5 flex-grow text-left flex items-center">
            <h1 class="font-normal truncate">{{ content }}</h1>
        </div>

        <button v-if="!isLast" @click="deleteSelf" class="flex-shrink-0 flex items-center justify-center w-7 h-full hover:bg-muted-foreground/20 rounded-r-md" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" height="12px" viewBox="0 -960 960 960" width="12px" fill="currentColor">
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
            </svg>
        </button>
        <button v-if="isLast" @click="$emit('add-item')" class="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground hover:bg-primary/90" title="Add new">
             <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
            </svg>
        </button>
    </div>
</template>

<script lang="ts">
import { ref, watch } from 'vue';

import { useResumeDetails } from '@/composables/ResumeDetails';
export default {
    props: ['content', 'isLast', 'type', 'itemIndex'],
    emits: ['add-item', 'edit-item'],
    setup(props, { emit }) {

        const { loadDetails } = useResumeDetails();

        const onEdit = () => {
            emit('edit-item', props.itemIndex);
        }

        const deleteSelf = () => {
            if (!chrome.storage) return;
            chrome.storage.local.get(['Resume_details'], (data) => {
                let val = data['Resume_details'];
                let res;
                if (val) {
                    if (typeof val === "string") {
                        let jsonData = JSON.parse(val);
                        res = jsonData;

                    } else {
                        res = val;
                    }

                }
                if (res) {
                    if (props.type == "Work Experience" && res.experiences) {
                        res.experiences.splice(props.itemIndex, 1);
                        chrome.storage.local.set({ ['Resume_details']: res }, () => {
                            console.log(`'Resume_details' updated after deletion:`);
                            loadDetails();
                        });

                    }
                    if (props.type == "Skills" && res.skills) {
                        const index = res.skills.indexOf(props.content);
                        if (index > -1) {
                            res.skills.splice(index, 1);
                            chrome.storage.local.set({ ['Resume_details']: res }, () => {
                                console.log(`'Resume_details' saved:`);
                                loadDetails();
                            });

                        }
                    }



                }
            });
        }
        return {
            onEdit, deleteSelf
        };
    },
};
</script>
