<template>
    <div class="grid grid-cols-3 items-start gap-4">
        <h2 class="text-sm font-medium text-muted-foreground text-right pt-2 col-span-1">{{ label }}</h2>
        <div class="flex flex-wrap gap-2 col-span-2">
            <GridDataItem v-for="(option, index) in dataRef" :key="index" :content="option" :type="label" :item-index="index" @edit-item="$emit('edit-item', $event)">
            </GridDataItem>
            <GridDataItem :type="label" isLast=true @add-item="$emit('add-item')" />
        </div>
    </div>
</template>

<script lang="ts">
import { ref, watch } from 'vue';
import GridDataItem from '@/components/GridDataItem.vue';
import { useResumeDetails } from '@/composables/ResumeDetails';
export default {
    props: ['label'],
    emits: ['add-item', 'edit-item'],
    components: {
        GridDataItem
    },
    setup(props) {
        // Declare a reactive input value using Vue's ref
        const inputValue = ref('');
        const dataRef = ref<string[]>([]);
        const { details } = useResumeDetails();

        watch(details, (newData: any) => {
            console.log(newData)
            if (props.label === "Work Experience") {
                dataRef.value = parseExperience(newData.experiences);
            } else if (newData.skills) {
                 dataRef.value = newData.skills;
            } else {
                dataRef.value = [];
            }
        });
        const parseExperience = (experiences: any[]) => {
            if (!Array.isArray(experiences)) return [];
            let returnArr = <string[]>[];
            for (const experience of experiences) {
                if (experience && experience.jobTitle && experience.jobEmployer) {
                    returnArr.push(`${experience.jobTitle} @ ${experience.jobEmployer}`);
                }
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
