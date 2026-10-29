// Load each section independently so one unavailable collection does not hide others.
export async function loadMemberSections(loaders, { isCurrent = () => true, onSection = () => {}, onError = () => {} } = {}) {
    return Promise.allSettled(Object.entries(loaders).map(async ([section, load]) => {
        try {
            const value = await load();
            if (isCurrent()) await onSection(section, value);
            return { section, value };
        } catch (error) {
            if (isCurrent()) await onError(section, error);
            throw error;
        }
    }));
}
