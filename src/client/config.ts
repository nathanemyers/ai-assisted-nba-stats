enum Model {
    // can be quite sluggish
    GEMMA4_26B = 'gemma4:26b',
}

interface Config {
    ollamaHost: string,
    model: Model,
}
const config: Config = {
    ollamaHost: "http://127.0.0.1:11434",
    model: Model.GEMMA4_26B,
}

export default config