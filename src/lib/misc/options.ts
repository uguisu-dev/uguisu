export type UguisuOptions = {
	stdin?: () => Promise<string>,
	stdout?: (buf: string) => void,
};
