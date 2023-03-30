export type UguisuOptions = {
    stdin?: () => string,
    stdout?: (buf: string) => void,
};
