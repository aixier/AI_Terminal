<template>
  <div class="home-container">
    <h1>终端能力友好化系统</h1>
    <p>通过友好的Web界面执行复杂的终端命令</p>
    <el-button type="primary" @click="$router.push('/card-generator')">
      开始使用
    </el-button>
  </div>
</template>

<script setup>

</script>

<style scoped>
.home-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

p {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 2rem;
}
</style>