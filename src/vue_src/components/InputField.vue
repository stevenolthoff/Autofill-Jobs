<template>
    <div class="inputFieldDiv">
        <h2>{{ label }}</h2>
        <input type="text" :placeholder="placeHolder">
    </div>
</template>

<script lang="ts">

export default {
    props: [
        "label",
        "placeHolder"
    ]
}

</script>