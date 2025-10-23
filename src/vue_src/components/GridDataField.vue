<template>
    <div class="grid grid-cols-3 items-start gap-4">
        <h2 class="text-sm font-medium text-muted-foreground text-right pt-2 col-span-1">{{ label }}</h2>
        <div class="flex flex-wrap gap-2 col-span-2">
            <GridDataItem v-for="option in dataRef" :key="option" :value="option" :content="option" :type="label">
            </GridDataItem>
            <GridDataItem :type="label" isLast=true updateData="loadData" @add-item="$emit('add-item')" />
        </div>
    </div>
</template>

<script lang="ts">
import { ref, watch } from 'vue';
import GridDataItem from '@/components/GridDataItem.vue';
import { useResumeDetails } from '@/composables/ResumeDetails';
export default {
    props: ['label'],
    emits: ['add-item'],
    components: {
        GridDataItem
    },
    setup(props) {
        // Declare a reactive input value using Vue's ref
        const inputValue = ref('');
        const dataRef = ref([]);
        const { details } = useResumeDetails();

        watch(details, (newData: any) => {
            console.log(newData)
            dataRef.value = props.label == "Work Experience" ? parseExperience(newData.experiences) : newData.skills;
        });
        const parseExperience = (experiences: any) => {
            let returnArr = <string[]>[];
            for (let experience of experiences) {
                returnArr.push(`${experience.jobTitle} @ ${experience.jobEmployer}`)
            }
            return returnArr;
        }

        return {
            inputValue,
            dataRef,
        };
    },
};
</script>
