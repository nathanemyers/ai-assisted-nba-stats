interface Config {
    ollamaHost: string,
    model: string,
}
const config: Config = {
    ollamaHost: "http://127.0.0.1:11434",
    model: 'gemma4:26b',
}

export default config