<template>
    <div class="flex items-center gap-1.5 bg-muted text-muted-foreground text-sm font-medium h-7 px-2.5 rounded-md">
        <h1 v-if="content" class="font-normal">{{ content }}</h1>
        <button v-if="!isLast" @click="deleteSelf" class="flex items-center justify-center w-4 h-4 rounded-full hover:bg-muted-foreground/20">
            <svg xmlns="http://www.w3.org/2000/svg" height="12px" viewBox="0 -960 960 960" width="12px" fill="currentColor">
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
            </svg>
        </button>
        <button v-if="isLast" @click="toggleIsOn" class="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
             <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
            </svg>
        </button>
    </div>
</template>

<script lang="ts">
import { ref, watch } from 'vue';

import { useSkills } from '@/composables/Skills.ts';
import { useWorkExperience } from '@/composables/WorkExperience.ts';
import { useResumeDetails } from '@/composables/ResumeDetails';
export default {
    props: ['content', 'isLast', 'type'],
    setup(props) {

        const { toggleIsOn } = props.type === "Work Experience" ? useWorkExperience() : useSkills();
        const { loadDetails } = useResumeDetails();

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
                        let employer = props.content.split('@')[1].trim();
                        let job = props.content.split('@')[0].trim();
                        res.experiences = res.experiences.filter((exp: any) => (exp.jobEmployer != employer && exp.jobTitle != job));
                        chrome.storage.local.set({ ['Resume_details']: res }, () => {
                            console.log(`'Resume_details' saved:`);
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
            toggleIsOn, deleteSelf
        };
    },
};
</script>
