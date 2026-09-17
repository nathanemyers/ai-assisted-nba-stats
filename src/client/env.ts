interface Env {
    debug: boolean
}

export function getEnv(): Env {
    const env = process.env
    return {
        debug: env.DEBUG?.toLocaleLowerCase() === "true" ? true : false
    }
}