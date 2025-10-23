<template>
    <div class="p-6 flex flex-col gap-6">
        <header class="flex justify-between items-center">
            <h1 class="text-xl font-semibold text-primary">Add Work Experience</h1>
        </header>

        <main class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
                <label for="jobTitle" class="text-sm font-medium text-muted-foreground">Job Title</label>
                <input id="jobTitle" placeholder="Software Engineer I" v-model="jobTitle" class="h-9 px-3 py-2 text-sm bg-transparent rounded-md border border-input ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
            </div>

            <div class="flex flex-col gap-1.5">
                <label for="jobEmployer" class="text-sm font-medium text-muted-foreground">Job Employer</label>
                <input id="jobEmployer" placeholder="Google" v-model="jobEmployer" class="h-9 px-3 py-2 text-sm bg-transparent rounded-md border border-input ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                    <label for="startMonth" class="text-sm font-medium text-muted-foreground">Start Month</label>
                    <select id="startMonth" v-model="startMonth" class="h-9 px-3 py-2 text-sm bg-transparent rounded-md border border-input ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                         <option v-for="option in months" :key="option" :value="option">{{ option }}</option>
                    </select>
                </div>
                <div class="flex flex-col gap-1.5">
                    <label for="startYear" class="text-sm font-medium text-muted-foreground">Start Year</label>
                    <input id="startYear" placeholder="2024" v-model="startYear" class="h-9 px-3 py-2 text-sm bg-transparent rounded-md border border-input ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                 <div class="flex flex-col gap-1.5">
                    <label for="endMonth" class="text-sm font-medium text-muted-foreground">End Month</label>
                    <select id="endMonth" v-model="endMonth" class="h-9 px-3 py-2 text-sm bg-transparent rounded-md border border-input ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <option v-for="option in months" :key="option" :value="option">{{ option }}</option>
                    </select>
                </div>
                <div class="flex flex-col gap-1.5">
                    <label for="endYear" class="text-sm font-medium text-muted-foreground">End Year</label>
                    <input id="endYear" placeholder="Present" v-model="endYear" class="h-9 px-3 py-2 text-sm bg-transparent rounded-md border border-input ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                </div>
            </div>
            
            <div class="flex flex-col gap-1.5">
                <label for="roleDescription" class="text-sm font-medium text-muted-foreground">Description</label>
                <textarea id="roleDescription" placeholder="• Spearheaded the development of a new feature..." v-model="roleDescription" rows="5" class="p-3 text-sm bg-transparent rounded-md border border-input ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none" />
            </div>
        </main>

        <footer class="flex justify-end gap-3 pt-2">
            <button @click="exit" class="h-9 px-4 inline-flex items-center justify-center rounded-md text-sm font-medium border border-border bg-transparent hover:bg-muted">Cancel</button>
            <button @click="saveData" class="h-9 px-4 inline-flex items-center justify-center rounded-md text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90">Save Experience</button>
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
        const jobTitle = ref('');
        const jobEmployer = ref('');
        const startMonth = ref('');
        const startYear = ref('');
        const endMonth = ref('');
        const endYear = ref('');
        const roleDescription = ref('');
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June', 'July',
            'August', 'September', 'October', 'November', 'December'
        ];

        const clearFields = () => {
            jobTitle.value = '';
            jobEmployer.value = '';
            startMonth.value = '';
            startYear.value = '';
            endMonth.value = '';
            endYear.value = '';
            roleDescription.value = '';
        }

        const exit = () => {
            clearFields();
            emit('close');
        }

        const saveData = () => {
            const experience = {
                "jobTitle": jobTitle.value.trim(),
                "jobEmployer": jobEmployer.value.trim(),
                "jobDuration": `${startMonth.value} ${startYear.value.trim()} - ${endMonth.value} ${endYear.value.trim()}`,
                "isCurrentEmployer": (endYear.value.toLowerCase().includes('present') || endYear.value.toLowerCase().includes('current')),
                "roleBulletsString": roleDescription.value.trim()
            };

            if (!chrome.storage || !experience.jobTitle || !experience.jobEmployer) {
                return; // Basic validation
            };

            chrome.storage.local.get(['Resume_details'], (data) => {
                const resumeDetails = data['Resume_details'] || { skills: [], experiences: [] };
                
                const existingExperiences = (resumeDetails.experiences || []).filter((exp: any) => exp && exp.jobTitle);

                const updatedDetails = {
                    ...resumeDetails,
                    experiences: [...existingExperiences, experience]
                };

                chrome.storage.local.set({ 'Resume_details': updatedDetails }, () => {
                    console.log(`'Resume_details' updated:`, updatedDetails);
                    loadDetails();
                    emit('close');
                });
            });
        }
        return {
            jobTitle, jobEmployer, startMonth, startYear,
            endMonth, endYear, roleDescription, months,
            exit,
            saveData
        };
    },
};
</script>
