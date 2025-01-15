
import { ref, computed } from 'vue';

const privacy = ref(false);

// Create a composable to expose the state and a toggle function
export function usePrivacy() {
  const togglePrivacy = () => {
    privacy.value = !privacy.value;
  };
  const setPrivacy = (value:boolean) => {
    privacy.value = value;
  };
  // Return the state and actions
  return {
    privacy: computed(() => privacy.value), // Read-only computed
    togglePrivacy,
    setPrivacy
  };
}
