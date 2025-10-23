<template>
    <div class="p-6 flex flex-col gap-6">
        <header class="flex justify-between items-center">
            <h1 class="text-xl font-semibold text-primary">Add Skill</h1>
        </header>

        <main class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
                <label for="skillName" class="text-sm font-medium text-muted-foreground">Skill</label>
                <input id="skillName" placeholder="JavaScript" v-model="inputValue" class="h-9 px-3 py-2 text-sm bg-transparent rounded-md border border-input ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            </div>
        </main>
        
        <footer class="flex justify-end gap-3 pt-2">
            <button @click="exit" class="h-9 px-4 inline-flex items-center justify-center rounded-md text-sm font-medium border border-border bg-transparent hover:bg-muted">Cancel</button>
            <button @click="saveData" class="h-9 px-4 inline-flex items-center justify-center rounded-md text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90">Save Skill</button>
        </footer>
    </div>
</template>

<script lang="ts">
import { ref } from 'vue';
import { useResumeDetails } from '@/composables/ResumeDetails';
export default {
    emits: ['close'],
    setup(props, { emit }) {
        const { loadDetails } = useResumeDetails();
        const inputValue = ref('');

        const exit = () => {
            inputValue.value = '';
            emit('close');
        }

        const saveData = () => {
            const newSkill = inputValue.value.trim();
            if (!chrome.storage || !newSkill) return;
            
            chrome.storage.local.get(['Resume_details'], (data) => {
                const resumeDetails = data['Resume_details'] || { skills: [], experiences: [] };
                
                const existingSkills = resumeDetails.skills || [];

                if (!existingSkills.includes(newSkill)) {
                    const updatedDetails = {
                        ...resumeDetails,
                        skills: [...existingSkills, newSkill]
                    };
                    
                    chrome.storage.local.set({ 'Resume_details': updatedDetails }, () => {
                        console.log(`'Resume_details' updated:`, updatedDetails);
                        loadDetails();
                        emit('close');
                    });
                } else {
                    emit('close'); // Skill already exists, just close
                }
            });
        }
        return {
            inputValue,
            exit, 
            saveData
        };
    },
};
</script>
