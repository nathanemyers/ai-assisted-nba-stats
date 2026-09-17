enum Model {
  // can be quite sluggish
  GEMMA4_26B = 'gemma4:26b',
  QWEN3_27B_K2 = 'hf.co/unsloth/Qwen3.8-27B-GGUF:UD-IQ2_XXS',
  // actually runs on my graphics card
  QWEN3_4B_K_M = 'hf.co/unsloth/Qwen3-4B-GGUF:Q4_K_M'
}

interface Config {
  ollamaHost: string
  model: Model
}
const config: Config = {
  ollamaHost: 'http://127.0.0.1:11434',
  model: Model.QWEN3_4B_K_M,
}

export default config
