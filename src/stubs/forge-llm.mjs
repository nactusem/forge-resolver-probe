// Stand-in for @forge/llm. A probe is about authorization and storage, so by default a
// model call is an error rather than a silent empty answer: if your resolver reaches the
// model on the path you are probing, you want to know.
export const chat = async () => {
    throw new Error('the probe does not answer model calls; stub @forge/llm yourself if you need one');
};
export const list = async () => ({ data: [] });
export default { chat, list };
